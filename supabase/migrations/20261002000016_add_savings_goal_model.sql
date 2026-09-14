ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS goal_category text NOT NULL DEFAULT 'custom' CHECK (goal_category IN ('emergency_fund', 'custom')),
  ADD COLUMN IF NOT EXISTS auto_save_amount_centavos bigint NOT NULL DEFAULT 0 CHECK (auto_save_amount_centavos >= 0),
  ADD COLUMN IF NOT EXISTS interest_rate_bps integer CHECK (interest_rate_bps >= 0),
  ADD COLUMN IF NOT EXISTS notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  ADD COLUMN IF NOT EXISTS emergency_fund_target_method text NOT NULL DEFAULT 'fixed_amount' CHECK (emergency_fund_target_method IN ('fixed_amount', 'essential_expense_coverage')),
  ADD COLUMN IF NOT EXISTS essential_expense_coverage_months integer CHECK (essential_expense_coverage_months BETWEEN 3 AND 6),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.savings_goals SET goal_category = goal_type WHERE goal_category = 'custom' AND goal_type = 'emergency_fund';
ALTER TABLE public.savings_goals DROP CONSTRAINT IF EXISTS savings_goals_status_check;
ALTER TABLE public.savings_goals ADD CONSTRAINT savings_goals_status_check CHECK (status IN ('active', 'archived', 'deleted'));

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_savings_goal_id uuid REFERENCES public.savings_goals(id),
  ADD COLUMN IF NOT EXISTS destination_savings_goal_id uuid REFERENCES public.savings_goals(id);

CREATE TABLE IF NOT EXISTS public.savings_goal_activities (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  savings_goal_id uuid NOT NULL REFERENCES public.savings_goals(id),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  activity_kind text NOT NULL CHECK (activity_kind IN ('contribution', 'withdrawal')),
  amount_centavos bigint NOT NULL CHECK (amount_centavos > 0), activity_date date NOT NULL,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000), version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS savings_goal_activities_live_transaction_idx ON public.savings_goal_activities(user_id, transaction_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_savings_goal_activities_goal_active ON public.savings_goal_activities(user_id, savings_goal_id, deleted, activity_date DESC);
ALTER TABLE public.savings_goal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage their savings goal activities" ON public.savings_goal_activities FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION private.apply_savings_goal_activity_sync_operation_core(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE v_user_id uuid := auth.uid(); v_current_version integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'operation type is invalid'; END IF;
  IF p_operation_type = 'create' THEN
    IF NOT (p_payload ?& ARRAY['savings_goal_id', 'transaction_id', 'activity_kind', 'amount_centavos', 'activity_date']) OR p_payload->>'activity_kind' NOT IN ('contribution', 'withdrawal') OR p_payload->>'amount_centavos' !~ '^[1-9][0-9]*$' OR NOT EXISTS (SELECT 1 FROM savings_goals WHERE id = (p_payload->>'savings_goal_id')::uuid AND user_id = v_user_id AND status = 'active' AND deleted = false) OR NOT EXISTS (SELECT 1 FROM transactions WHERE id = (p_payload->>'transaction_id')::uuid AND user_id = v_user_id AND transaction_type = 'transfer' AND deleted = false) THEN RAISE EXCEPTION 'invalid savings activity payload'; END IF;
    INSERT INTO savings_goal_activities(id, user_id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes, version, deleted) VALUES (p_record_id, v_user_id, (p_payload->>'savings_goal_id')::uuid, (p_payload->>'transaction_id')::uuid, p_payload->>'activity_kind', (p_payload->>'amount_centavos')::bigint, (p_payload->>'activity_date')::date, p_payload->>'notes', 1, false);
    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[]; RETURN;
  END IF;
  SELECT version INTO v_current_version FROM savings_goal_activities WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  IF v_current_version IS NULL THEN RETURN QUERY SELECT 'rejected'::text, 'record not found'::text, NULL::integer, NULL::text[]; RETURN; END IF;
  IF p_base_version IS NULL OR p_base_version <> v_current_version THEN RETURN QUERY SELECT 'conflict'::text, 'savings activity version changed'::text, v_current_version, p_changed_fields; RETURN; END IF;
  IF p_operation_type = 'delete' THEN UPDATE savings_goal_activities SET deleted = true, version = version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id; ELSE RAISE EXCEPTION 'savings activities cannot be updated directly'; END IF;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
END; $$;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) RENAME TO apply_sync_operation_base;
CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE v_result record;
BEGIN
  IF p_entity = 'savings_goal_activities' THEN
    RETURN QUERY SELECT * FROM private.apply_savings_goal_activity_sync_operation_core(p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;
  IF p_entity = 'savings_goals' THEN
    SELECT * INTO v_result FROM public.apply_sync_operation_base(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    IF v_result.status = 'applied' AND p_operation_type <> 'delete' THEN
      UPDATE public.savings_goals SET
        goal_category = COALESCE(p_payload->>'goal_category', goal_category),
        auto_save_amount_centavos = COALESCE((p_payload->>'auto_save_amount_centavos')::bigint, auto_save_amount_centavos),
        interest_rate_bps = CASE WHEN p_payload ? 'interest_rate_bps' THEN (p_payload->>'interest_rate_bps')::integer ELSE interest_rate_bps END,
        notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END,
        emergency_fund_target_method = COALESCE(p_payload->>'emergency_fund_target_method', emergency_fund_target_method),
        essential_expense_coverage_months = CASE WHEN p_payload ? 'essential_expense_coverage_months' THEN (p_payload->>'essential_expense_coverage_months')::integer ELSE essential_expense_coverage_months END
      WHERE id = p_record_id AND user_id = auth.uid();
    END IF;
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_base(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END; $$;
REVOKE EXECUTE ON FUNCTION private.apply_savings_goal_activity_sync_operation_core(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
