-- Only a biller or remittance payment may be an uncategorized expense. It carries a client_mutation_id of
-- 'scheduled-payment:<scheduled payment id>:...' (scheduledPaymentMutationId on the device); the sync API also
-- checks that the named scheduled payment belongs to the user. Every other expense needs a subcategory again.
ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_shape_chk,
  ADD CONSTRAINT transactions_shape_chk CHECK (
    (
      transaction_type = 'income'
      AND destination_account_id IS NOT NULL
      AND source_account_id IS NULL
      AND subcategory_id IS NOT NULL
    )
    OR (
      transaction_type = 'expense'
      AND source_account_id IS NOT NULL
      AND destination_account_id IS NULL
      AND (subcategory_id IS NOT NULL OR COALESCE(client_mutation_id LIKE 'scheduled-payment:%', false))
    )
    OR (
      transaction_type = 'transfer'
      AND source_account_id IS NOT NULL
      AND destination_account_id IS NOT NULL
      AND source_account_id <> destination_account_id
      AND subcategory_id IS NULL
    )
  );

-- Same job as 20261115000001, except each post carries the biller marker. An auto-post's marker is per
-- occurrence and matches the device's, so a device pushing the same transaction is still a no-op.
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
          subcategory_id, source_account_id, merchant_name, client_mutation_id, version, deleted, created_at, updated_at
        ) VALUES (
          v_transaction_id, v_payment.user_id, 'expense', 'posted', 'recurring', v_due_date, now(), v_remaining,
          v_payment.subcategory_id, v_payment.source_account_id, v_payment.name,
          'scheduled-payment:' || v_payment.id::text || ':' || to_char(v_due_date, 'YYYY-MM-DD'), 1, false, now(), now()
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
