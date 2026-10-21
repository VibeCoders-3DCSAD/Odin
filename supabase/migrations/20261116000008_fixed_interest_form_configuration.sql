-- Configuration for the revised fixed-rate form. The legacy credit worker never reads this object.
CREATE FUNCTION private.is_valid_fixed_interest_configuration(c jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE k text; entry jsonb; previous_date text := ''; value numeric;
  required_keys text[] := ARRAY['version','calculationFrequency','creditFrequency','creditIntervalDays','postingMode','postingDay','postingDate','startsOn','startingBalanceCentavos','averagingPeriod','averagingIntervalDays','minimumQualifyingBalanceCentavos','maximumInterestBearingBalanceCentavos','dayCountBasis','taxEnabled','withholdingTaxBps','autoProject','stoppingPolicy','showBreakdown','rateHistory'];
BEGIN
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT c ?& required_keys OR EXISTS(SELECT 1 FROM jsonb_object_keys(c) key WHERE NOT key = ANY(required_keys)) THEN RETURN false; END IF;
  IF c->'version' IS DISTINCT FROM '1'::jsonb OR c->>'calculationFrequency' IS DISTINCT FROM 'daily' THEN RETURN false; END IF;
  IF c->>'creditFrequency' IS NULL OR c->>'creditFrequency' NOT IN ('daily','monthly','quarterly','yearly','custom') THEN RETURN false; END IF;
  IF c->>'postingMode' IS NULL OR c->>'postingMode' NOT IN ('period_end','day_of_month','specific_date') THEN RETURN false; END IF;
  IF c->>'averagingPeriod' IS NULL OR c->>'averagingPeriod' NOT IN ('calendar_month','credit_period','custom') THEN RETURN false; END IF;
  IF c->>'dayCountBasis' IS NULL OR c->>'dayCountBasis' NOT IN ('actual_365','actual_366','actual_actual') THEN RETURN false; END IF;
  IF c->>'stoppingPolicy' IS NULL OR c->>'stoppingPolicy' NOT IN ('preserve','settle','discard_projection') THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['startsOn','postingDate'] LOOP
    IF k = 'startsOn' OR c->k <> 'null'::jsonb THEN
      IF jsonb_typeof(c->k) IS DISTINCT FROM 'string' OR c->>k !~ '^\d{4}-\d{2}-\d{2}$' OR (c->>k)::date NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31' THEN RETURN false; END IF;
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['taxEnabled','autoProject','showBreakdown'] LOOP
    IF jsonb_typeof(c->k) IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['creditIntervalDays','averagingIntervalDays','postingDay','startingBalanceCentavos','minimumQualifyingBalanceCentavos','maximumInterestBearingBalanceCentavos','withholdingTaxBps'] LOOP
    IF c->k <> 'null'::jsonb THEN
      IF jsonb_typeof(c->k) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      value := (c->>k)::numeric;
      IF value <> trunc(value) OR value < 0 OR value > 9007199254740991 THEN RETURN false; END IF;
      IF k IN ('creditIntervalDays','averagingIntervalDays') AND value NOT BETWEEN 1 AND 3660 THEN RETURN false; END IF;
      IF k = 'postingDay' AND value NOT BETWEEN 1 AND 31 THEN RETURN false; END IF;
      IF k = 'withholdingTaxBps' AND value > 10000 THEN RETURN false; END IF;
    ELSIF k = 'withholdingTaxBps' THEN RETURN false;
    END IF;
  END LOOP;
  IF (c->>'maximumInterestBearingBalanceCentavos')::numeric < (c->>'minimumQualifyingBalanceCentavos')::numeric THEN RETURN false; END IF;
  IF c->>'creditFrequency' = 'custom' AND c->'creditIntervalDays' = 'null'::jsonb THEN RETURN false; END IF;
  IF c->>'averagingPeriod' = 'custom' AND c->'averagingIntervalDays' = 'null'::jsonb THEN RETURN false; END IF;
  IF c->>'postingMode' = 'day_of_month' AND c->'postingDay' = 'null'::jsonb THEN RETURN false; END IF;
  IF c->>'postingMode' = 'specific_date' AND (c->'postingDate' = 'null'::jsonb OR c->>'postingDate' < c->>'startsOn') THEN RETURN false; END IF;
  IF jsonb_typeof(c->'rateHistory') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'rateHistory') > 100 THEN RETURN false; END IF;
  FOR entry IN SELECT * FROM jsonb_array_elements(c->'rateHistory') LOOP
    IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR NOT entry ?& ARRAY['effectiveOn','rateBps'] OR EXISTS(SELECT 1 FROM jsonb_object_keys(entry) key WHERE key NOT IN ('effectiveOn','rateBps')) THEN RETURN false; END IF;
    IF jsonb_typeof(entry->'effectiveOn') IS DISTINCT FROM 'string' OR entry->>'effectiveOn' !~ '^\d{4}-\d{2}-\d{2}$' OR (entry->>'effectiveOn')::date NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31' THEN RETURN false; END IF;
    IF entry->>'effectiveOn' < c->>'startsOn' OR entry->>'effectiveOn' <= previous_date THEN RETURN false; END IF;
    IF jsonb_typeof(entry->'rateBps') IS DISTINCT FROM 'number' OR (entry->>'rateBps')::numeric <> trunc((entry->>'rateBps')::numeric) OR (entry->>'rateBps')::numeric NOT BETWEEN 0 AND 100000 THEN RETURN false; END IF;
    previous_date := entry->>'effectiveOn';
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
ALTER FUNCTION private.is_valid_savings_interest_reference(jsonb) RENAME TO is_valid_savings_interest_reference_before_configuration;
CREATE FUNCTION private.is_valid_savings_interest_reference(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF value IS NULL THEN RETURN true; END IF;
  IF NOT private.is_valid_savings_interest_reference_before_configuration(value - 'configuration') THEN RETURN false; END IF;
  IF value->'configuration' IS NULL OR value->'configuration' = 'null'::jsonb THEN RETURN true; END IF;
  RETURN private.is_valid_fixed_interest_configuration(value->'configuration')
    AND value->>'rateStructure' IS NOT DISTINCT FROM 'fixed'
    AND value->>'balanceBasis' IS NOT NULL AND value->>'method' IS NOT NULL
    AND (value->'schedule' IS NULL OR value->'schedule' = 'null'::jsonb)
    AND (value->>'method' <> 'none' OR value->'configuration'->'autoProject' = 'false'::jsonb);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
ALTER TABLE public.savings_account_details DROP CONSTRAINT savings_interest_reference_valid;
ALTER TABLE public.savings_account_details ADD CONSTRAINT savings_interest_reference_valid CHECK(private.is_valid_savings_interest_reference(interest_reference));

CREATE OR REPLACE FUNCTION private.validate_savings_interest_schedule() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE rate integer; current_row public.savings_account_details;
BEGIN
  SELECT * INTO current_row FROM public.savings_account_details WHERE account_id = NEW.account_id AND user_id = NEW.user_id;
  IF (current_row.interest_reference->'schedule' IS NOT NULL AND current_row.interest_reference->'schedule' <> 'null'::jsonb)
    OR (current_row.interest_reference->'configuration' IS NOT NULL AND current_row.interest_reference->'configuration' <> 'null'::jsonb) THEN
    rate := CASE WHEN current_row.account_type = 'high_yield_savings' THEN CASE WHEN current_row.interest_reference->'configuration' IS NULL AND current_row.higher_rate_eligible THEN current_row.effective_interest_rate_bps ELSE current_row.base_interest_rate_bps END ELSE current_row.interest_rate_bps END;
    IF rate IS NULL OR rate NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'interest configuration requires an annual rate between 0 and 1000 percent'; END IF;
    IF current_row.interest_reference->'configuration' IS NOT NULL AND current_row.interest_reference->>'method' = 'none' AND rate <> 0 THEN RAISE EXCEPTION 'none requires a zero interest rate'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
