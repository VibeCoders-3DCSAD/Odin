-- Remove interest automation without touching account balances or transaction history.
DO $$
DECLARE job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'post-due-savings-interest' LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END;
$$;

-- Keep old callers safe: neither a stale cron invocation nor an older client may post interest.
CREATE OR REPLACE FUNCTION private.post_due_savings_interest(p_today date DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT 0;
$$;
REVOKE ALL ON FUNCTION private.post_due_savings_interest(date) FROM PUBLIC, anon, authenticated;

UPDATE public.savings_account_details AS details
SET interest_reference = jsonb_set(details.interest_reference, '{configuration,autoProject}', 'false'::jsonb)
FROM public.financial_accounts AS account
WHERE account.id = details.account_id AND account.user_id = details.user_id
  AND details.interest_reference->'configuration'->'autoProject' = 'true'::jsonb;

-- Flush deferred validation before altering constraints on populated installations.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER FUNCTION private.is_valid_fixed_interest_configuration(jsonb) RENAME TO is_valid_fixed_interest_configuration_before_manual;
CREATE FUNCTION private.is_valid_fixed_interest_configuration(c jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT private.is_valid_fixed_interest_configuration_before_manual(c) AND c->'autoProject' = 'false'::jsonb;
$$;
-- Revalidate through the current helper, including configurations supplied by old clients.
ALTER TABLE public.savings_account_details DROP CONSTRAINT savings_interest_reference_valid;
ALTER TABLE public.savings_account_details ADD CONSTRAINT savings_interest_reference_valid CHECK(
  private.is_valid_savings_interest_reference(interest_reference)
  AND (interest_reference->'configuration' IS NULL OR interest_reference->'configuration' = 'null'::jsonb
       OR interest_reference->'configuration'->'autoProject' = 'false'::jsonb)
);
