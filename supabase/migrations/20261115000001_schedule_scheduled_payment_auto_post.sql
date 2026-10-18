-- Server-side auto-post for billers and remittances. A pg_cron job posts every auto-post occurrence due by
-- today (Asia/Manila) that has no payment yet. Devices keep posting offline with the same ids
-- (scheduledPaymentPostIds in apps/app/local-db/repositories/scheduledPayments.ts), so whichever posts first
-- wins: a later create of the same transaction or record is a no-op, both here and in the sync RPCs.
-- Credit-card billers are left to the device, which also routes the purchase into a billing cycle.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Must match SCHEDULED_PAYMENT_POST_NAMESPACE and the key format on the device.
CREATE OR REPLACE FUNCTION private.scheduled_payment_post_id(p_scheduled_payment_id uuid, p_due_date date, p_kind text)
RETURNS uuid
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT extensions.uuid_generate_v5(
    '7f4fa802-4c64-4370-aed4-ca25c703928f'::uuid,
    'scheduled-payment:' || p_scheduled_payment_id::text || ':' || to_char(p_due_date, 'YYYY-MM-DD') || ':' || p_kind
  );
$$;

-- Port of dueDatesBetween in apps/app/features/billers/schedule.ts: every due date in [p_from, p_to].
CREATE OR REPLACE FUNCTION private.scheduled_payment_due_dates(p_payment public.scheduled_payments, p_from date, p_to date)
RETURNS SETOF date
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  v_start date := GREATEST(p_from, p_payment.starts_on);
  v_end date := LEAST(p_to, COALESCE(p_payment.ends_on, p_to));
  v_first date;
BEGIN
  IF v_start > v_end THEN RETURN; END IF;

  IF p_payment.frequency = 'once' THEN
    IF p_payment.starts_on BETWEEN v_start AND v_end THEN RETURN NEXT p_payment.starts_on; END IF;
    RETURN;
  END IF;

  IF p_payment.frequency = 'daily' THEN
    RETURN QUERY SELECT day::date FROM generate_series(v_start, v_end, interval '1 day') AS day;
    RETURN;
  END IF;

  IF p_payment.frequency IN ('weekly', 'biweekly') THEN
    IF p_payment.due_day_of_week IS NULL THEN RETURN; END IF;
    v_first := p_payment.starts_on + ((p_payment.due_day_of_week - extract(dow FROM p_payment.starts_on)::int + 7) % 7);
    RETURN QUERY
      SELECT day::date FROM generate_series(v_first, v_end, CASE WHEN p_payment.frequency = 'weekly' THEN interval '7 days' ELSE interval '14 days' END) AS day
       WHERE day::date >= v_start;
    RETURN;
  END IF;

  IF p_payment.due_day_of_month IS NULL THEN RETURN; END IF;
  RETURN QUERY
    WITH months AS (
      SELECT month::date AS month_start, (month + interval '1 month - 1 day')::date AS month_end
        FROM generate_series(date_trunc('month', v_start), v_end, interval '1 month') AS month
    ), days AS (
      SELECT month_start, month_end, day_of_month
        FROM months
        CROSS JOIN LATERAL unnest(CASE
          WHEN p_payment.frequency = 'semi_monthly' THEN ARRAY[p_payment.due_day_of_month, p_payment.due_second_day_of_month]
          WHEN p_payment.frequency = 'monthly' THEN ARRAY[p_payment.due_day_of_month]
          WHEN p_payment.frequency = 'quarterly'
            AND ((extract(month FROM month_start)::int - extract(month FROM p_payment.starts_on)::int) % 3 + 3) % 3 = 0 THEN ARRAY[p_payment.due_day_of_month]
          WHEN p_payment.frequency = 'yearly' AND extract(month FROM month_start)::int = p_payment.due_month THEN ARRAY[p_payment.due_day_of_month]
          ELSE ARRAY[]::smallint[]
        END) AS day_of_month
       WHERE day_of_month IS NOT NULL
    )
    SELECT DISTINCT LEAST(month_start + day_of_month - 1, month_end) AS due_date
      FROM days
     WHERE LEAST(month_start + day_of_month - 1, month_end) BETWEEN v_start AND v_end
     ORDER BY due_date;
END;
$$;

-- Posts every unpaid auto-post occurrence due by p_today. Unlike the device there is no catch-up cap:
-- the job runs every few minutes, so a backlog only exists when auto-post has just been switched on.
CREATE OR REPLACE FUNCTION private.post_due_scheduled_payments(p_today date DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.scheduled_payments;
  v_due_date date;
  v_transaction_id uuid;
  v_record_id uuid;
  v_remaining bigint;
  v_posted integer := 0;
  v_payment_posted integer;
BEGIN
  FOR v_payment IN
    SELECT payment.*
      FROM public.scheduled_payments AS payment
      JOIN public.financial_accounts AS account ON account.id = payment.source_account_id AND account.user_id = payment.user_id
     WHERE payment.status = 'active' AND NOT payment.deleted AND payment.auto_post AND payment.auto_post_from IS NOT NULL
       AND account.kind <> 'credit_card' AND account.status = 'active' AND NOT account.deleted
     ORDER BY payment.id
  LOOP
    v_payment_posted := 0;
    BEGIN
      FOR v_due_date IN SELECT due_date FROM private.scheduled_payment_due_dates(v_payment, v_payment.auto_post_from, p_today) AS due_date LOOP
        v_transaction_id := private.scheduled_payment_post_id(v_payment.id, v_due_date, 'transaction');
        v_record_id := private.scheduled_payment_post_id(v_payment.id, v_due_date, 'record');
        -- Either id existing, even deleted, means this occurrence was already posted; a deleted post stays deleted.
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.scheduled_payment_records WHERE id = v_record_id)
                   OR EXISTS (SELECT 1 FROM public.transactions WHERE id = v_transaction_id);

        SELECT v_payment.amount_centavos - COALESCE(SUM(record.amount_centavos), 0) INTO v_remaining
          FROM public.scheduled_payment_records AS record
         WHERE record.scheduled_payment_id = v_payment.id AND record.occurrence_date = v_due_date AND NOT record.deleted;
        CONTINUE WHEN v_remaining <= 0;

        INSERT INTO public.transactions (
          id, user_id, transaction_type, status, entry_source, transaction_date, posted_at, amount_centavos,
          subcategory_id, source_account_id, merchant_name, version, deleted, created_at, updated_at
        ) VALUES (
          v_transaction_id, v_payment.user_id, 'expense', 'posted', 'recurring', v_due_date, now(), v_remaining,
          v_payment.subcategory_id, v_payment.source_account_id, v_payment.name, 1, false, now(), now()
        ) ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.scheduled_payment_records (
          id, user_id, scheduled_payment_id, transaction_id, occurrence_date, payment_date, amount_centavos, source
        ) VALUES (
          v_record_id, v_payment.user_id, v_payment.id, v_transaction_id, v_due_date, v_due_date, v_remaining, 'auto'
        ) ON CONFLICT (id) DO NOTHING;
        v_payment_posted := v_payment_posted + 1;
      END LOOP;
      v_posted := v_posted + v_payment_posted;
    EXCEPTION WHEN OTHERS THEN
      -- One payment that cannot post (for example an inactive category) must not block the others.
      RAISE WARNING 'scheduled payment % auto-post skipped: %', v_payment.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_posted;
END;
$$;

REVOKE ALL ON FUNCTION private.scheduled_payment_post_id(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.scheduled_payment_due_dates(public.scheduled_payments, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.post_due_scheduled_payments(date) FROM PUBLIC, anon, authenticated;

-- Scheduling by name replaces an existing job of the same name, so re-running this migration is safe.
SELECT cron.schedule('post-due-scheduled-payments', '*/5 * * * *', 'SELECT private.post_due_scheduled_payments()');
