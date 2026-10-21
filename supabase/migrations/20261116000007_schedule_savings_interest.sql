-- Extend the existing JSON contract without changing old reference-only records.
ALTER FUNCTION private.is_valid_savings_interest_reference(jsonb) RENAME TO is_valid_savings_interest_reference_before_schedule;
CREATE FUNCTION private.is_valid_savings_interest_reference(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE s jsonb; tier jsonb; previous numeric := -1; threshold numeric; rate numeric;
BEGIN
  IF value IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(value) <> 'object' THEN RETURN false; END IF;
  IF NOT private.is_valid_savings_interest_reference_before_schedule(
    CASE WHEN value->>'method' = 'none' THEN jsonb_set(value - 'schedule', '{method}', 'null') ELSE value - 'schedule' END
  ) THEN RETURN false; END IF;
  s := value->'schedule';
  IF s IS NULL OR s = 'null'::jsonb THEN RETURN true; END IF;
  IF jsonb_typeof(s) <> 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('startsOn','frequency','withholdingTaxBps','tiers')) THEN RETURN false; END IF;
  IF value->>'balanceBasis' IS NULL OR value->>'method' IS NULL OR value->>'method' NOT IN ('simple','compound') OR value->>'rateStructure' IS NULL THEN RETURN false; END IF;
  IF jsonb_typeof(s->'startsOn') IS DISTINCT FROM 'string' OR s->>'startsOn' !~ '^\d{4}-\d{2}-\d{2}$'
    OR (s->>'startsOn')::date < DATE '2000-01-01' OR (s->>'startsOn')::date > DATE '2100-12-31' THEN RETURN false; END IF;
  IF s->>'frequency' IS NULL OR s->>'frequency' NOT IN ('daily','monthly','quarterly','yearly') THEN RETURN false; END IF;
  IF s ? 'withholdingTaxBps' AND (jsonb_typeof(s->'withholdingTaxBps') IS DISTINCT FROM 'number' OR (s->>'withholdingTaxBps')::numeric <> trunc((s->>'withholdingTaxBps')::numeric) OR (s->>'withholdingTaxBps')::numeric NOT BETWEEN 0 AND 10000) THEN RETURN false; END IF;
  IF s ? 'tiers' AND jsonb_typeof(s->'tiers') <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(COALESCE(s->'tiers', '[]')) > 20 THEN RETURN false; END IF;
  IF value->>'rateStructure' = 'tiered' AND jsonb_array_length(COALESCE(s->'tiers','[]')) = 0 THEN RETURN false; END IF;
  FOR tier IN SELECT * FROM jsonb_array_elements(COALESCE(s->'tiers','[]')) LOOP
    IF jsonb_typeof(tier) <> 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(tier) k WHERE k NOT IN ('minimumBalanceCentavos','interestRateBps')) THEN RETURN false; END IF;
    IF jsonb_typeof(tier->'minimumBalanceCentavos') IS DISTINCT FROM 'number' OR jsonb_typeof(tier->'interestRateBps') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    threshold := (tier->>'minimumBalanceCentavos')::numeric; rate := (tier->>'interestRateBps')::numeric;
    IF threshold <> trunc(threshold) OR threshold > 9007199254740991 OR threshold <= previous OR (previous = -1 AND threshold <> 0)
      OR rate <> trunc(rate) OR rate NOT BETWEEN 0 AND 100000 THEN RETURN false; END IF;
    previous := threshold;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
-- The existing CHECK refers to the renamed function by OID: replace it explicitly.
ALTER TABLE public.savings_account_details DROP CONSTRAINT savings_interest_reference_valid;
ALTER TABLE public.savings_account_details ADD CONSTRAINT savings_interest_reference_valid CHECK (private.is_valid_savings_interest_reference(interest_reference));

CREATE FUNCTION private.validate_savings_interest_schedule() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE rate integer; current_row public.savings_account_details;
BEGIN
  SELECT * INTO current_row FROM public.savings_account_details WHERE account_id = NEW.account_id AND user_id = NEW.user_id;
  IF current_row.interest_reference->'schedule' IS NOT NULL AND current_row.interest_reference->'schedule' <> 'null'::jsonb THEN
    rate := CASE WHEN current_row.account_type = 'high_yield_savings' THEN CASE WHEN current_row.higher_rate_eligible THEN current_row.effective_interest_rate_bps ELSE current_row.base_interest_rate_bps END ELSE current_row.interest_rate_bps END;
    IF rate IS NULL OR rate NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'scheduled interest requires an annual rate between 0 and 1000 percent'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER savings_interest_schedule_validation AFTER INSERT OR UPDATE ON public.savings_account_details
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_savings_interest_schedule();

-- Private progress survives disabling/re-enabling and deletion of an income credit.
CREATE TABLE private.savings_interest_progress (
  account_id uuid PRIMARY KEY REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  next_start date NOT NULL,
  remainder numeric NOT NULL DEFAULT 0,
  last_attempt_at timestamptz
);
REVOKE ALL ON private.savings_interest_progress FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.savings_interest_amount(p_account uuid, p_user uuid, p_first date, p_last date, p_reference jsonb, p_rate integer)
RETURNS numeric LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH flows AS (
    SELECT t.transaction_date AS day,
      sum(CASE WHEN p_reference->>'method' = 'simple' AND t.client_mutation_id LIKE 'savings-interest:%' THEN 0
          WHEN t.destination_account_id = p_account THEN t.amount_centavos ELSE -t.amount_centavos END) AS delta
    FROM public.transactions t WHERE t.user_id = p_user AND NOT t.deleted AND t.status = 'posted'
      AND (t.source_account_id = p_account OR t.destination_account_id = p_account) AND t.transaction_date <= p_last
    GROUP BY t.transaction_date
  ), days AS (
    SELECT day::date AS day FROM generate_series(p_first::timestamp, p_last::timestamp, interval '1 day') day
  ), balances AS (
    SELECT d.day, (a.opening_balance_centavos + COALESCE((SELECT sum(delta) FROM flows WHERE day < p_first), 0)
      + sum(COALESCE(f.delta,0)) OVER (ORDER BY d.day)) AS balance
    FROM days d JOIN public.financial_accounts a ON a.id = p_account AND a.user_id = p_user
      LEFT JOIN flows f ON f.day = d.day
  ), bases AS (
    SELECT greatest(0, CASE WHEN p_reference->>'balanceBasis' = 'average_daily_balance' THEN avg(balance) OVER () ELSE balance END) AS balance
    FROM balances
  )
  SELECT COALESCE(sum(balance * CASE WHEN p_reference->>'rateStructure' = 'tiered' THEN
    COALESCE((SELECT (tier->>'interestRateBps')::numeric FROM jsonb_array_elements(p_reference->'schedule'->'tiers') tier
      WHERE (tier->>'minimumBalanceCentavos')::numeric <= balance ORDER BY (tier->>'minimumBalanceCentavos')::numeric DESC LIMIT 1),0)
    ELSE p_rate END / 10000 / 365),0)
    * (1 - COALESCE((p_reference->'schedule'->>'withholdingTaxBps')::numeric,0) / 10000)
  FROM bases;
$$;

CREATE FUNCTION private.post_due_savings_interest(p_today date DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a record; first_day date; last_day date; schedule jsonb; frequency text; raw numeric; amount bigint; carry numeric; rate integer;
  subcategory uuid; posted integer := 0; account_posted integer; periods integer; mutation text;
BEGIN
  -- Global nonblocking lock serializes cron retries; transactions and progress commit atomically.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('odin:savings-interest',0)) THEN RETURN 0; END IF;
  FOR a IN
    SELECT d.*, f.opened_on, f.opening_balance_centavos
    FROM public.savings_account_details d JOIN public.financial_accounts f ON f.id = d.account_id AND f.user_id = d.user_id
      LEFT JOIN private.savings_interest_progress p ON p.account_id = d.account_id
    WHERE NOT d.deleted AND NOT f.deleted AND f.kind = 'savings' AND f.status = 'active'
      AND d.interest_reference->'schedule' IS NOT NULL AND d.interest_reference->'schedule' <> 'null'::jsonb
      AND CASE d.interest_reference->'schedule'->>'frequency'
        WHEN 'daily' THEN greatest(p.next_start,(d.interest_reference->'schedule'->>'startsOn')::date,f.opened_on)
        WHEN 'monthly' THEN (date_trunc('month',greatest(p.next_start,(d.interest_reference->'schedule'->>'startsOn')::date,f.opened_on)) + interval '1 month - 1 day')::date
        WHEN 'quarterly' THEN (date_trunc('quarter',greatest(p.next_start,(d.interest_reference->'schedule'->>'startsOn')::date,f.opened_on)) + interval '3 months - 1 day')::date
        ELSE (date_trunc('year',greatest(p.next_start,(d.interest_reference->'schedule'->>'startsOn')::date,f.opened_on)) + interval '1 year - 1 day')::date END < p_today
    ORDER BY p.last_attempt_at NULLS FIRST, COALESCE(p.next_start, (d.interest_reference->'schedule'->>'startsOn')::date), d.account_id
    LIMIT 100
    FOR UPDATE OF d, f SKIP LOCKED
  LOOP
    schedule := a.interest_reference->'schedule'; frequency := schedule->>'frequency';
      first_day := greatest((schedule->>'startsOn')::date, a.opened_on);
      INSERT INTO private.savings_interest_progress(account_id,next_start) VALUES(a.account_id,first_day) ON CONFLICT DO NOTHING;
    BEGIN
      account_posted := 0;
      SELECT greatest(p.next_start, first_day), p.remainder INTO first_day, carry FROM private.savings_interest_progress p WHERE p.account_id = a.account_id;
      rate := CASE WHEN a.account_type = 'high_yield_savings' THEN CASE WHEN a.higher_rate_eligible THEN a.effective_interest_rate_bps ELSE a.base_interest_rate_bps END ELSE a.interest_rate_bps END;
      -- Deterministic per-user taxonomy; do not overwrite edited/deleted categories.
      subcategory := md5(a.user_id::text || ':savings-interest-income')::uuid;
      periods := 0;
      LOOP
        EXIT WHEN periods >= 400;
        last_day := CASE frequency WHEN 'daily' THEN first_day
          WHEN 'monthly' THEN (date_trunc('month',first_day) + interval '1 month - 1 day')::date
          WHEN 'quarterly' THEN (date_trunc('quarter',first_day) + interval '3 months - 1 day')::date
          ELSE (date_trunc('year',first_day) + interval '1 year - 1 day')::date END;
        EXIT WHEN last_day >= p_today;
        raw := private.savings_interest_amount(a.account_id,a.user_id,first_day,last_day,a.interest_reference,rate) + carry;
        amount := greatest(0,round(raw)); carry := raw - amount;
        mutation := 'savings-interest:' || a.account_id::text || ':' || last_day::text;
        IF amount > 0 THEN
          INSERT INTO public.subcategories(id,user_id,slug,kind,label,description,is_system)
            VALUES(subcategory,a.user_id,'automatic-savings-interest','income','Savings interest','Scheduled savings interest credits',false)
            ON CONFLICT DO NOTHING;
          IF NOT EXISTS(SELECT 1 FROM public.subcategories s WHERE s.id = subcategory AND s.user_id = a.user_id AND s.kind = 'income' AND NOT s.deleted AND s.is_active) THEN
            RAISE EXCEPTION 'savings interest category is unavailable';
          END IF;
          INSERT INTO public.transactions(id,user_id,transaction_type,status,entry_source,transaction_date,posted_at,amount_centavos,subcategory_id,destination_account_id,merchant_name,client_mutation_id,metadata)
            VALUES(md5(mutation)::uuid,a.user_id,'income','posted','recurring',last_day + 1,now(),amount,subcategory,a.account_id,'Savings interest',mutation,
              jsonb_build_object('interest_period_start',first_day,'interest_period_end',last_day,'interest_settings',a.interest_reference,'annual_rate_bps',rate))
            ON CONFLICT DO NOTHING;
          account_posted := account_posted + 1;
        END IF;
        first_day := last_day + 1;
        UPDATE private.savings_interest_progress SET next_start = first_day, remainder = carry WHERE account_id = a.account_id;
        periods := periods + 1;
      END LOOP;
      posted := posted + account_posted;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Savings interest account % failed, SQLSTATE %', a.account_id, SQLSTATE;
    END;
    UPDATE private.savings_interest_progress SET last_attempt_at = now() WHERE account_id = a.account_id;
  END LOOP;
  RETURN posted;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_savings_interest_schedule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.savings_interest_amount(uuid,uuid,date,date,jsonb,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.post_due_savings_interest(date) FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('post-due-savings-interest','*/5 * * * *','SELECT private.post_due_savings_interest()');
