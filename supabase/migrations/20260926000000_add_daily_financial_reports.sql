-- Daily reports are scheduler-owned. Client sync can only mutate feedback rows.
CREATE TABLE daily_financial_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  report_date date NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  model_version text NOT NULL,
  period_start date NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, report_date, cadence, model_version)
);

CREATE TABLE daily_financial_report_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES daily_financial_reports(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  finding text NOT NULL CHECK (finding IN ('unusual_transaction', 'budget_overspending', 'insufficient_history', 'model_unavailable', 'no_finding')),
  severity odin_alert_severity,
  explanation text,
  source_references jsonb NOT NULL DEFAULT '{}'::jsonb,
  anomaly_score numeric(12, 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, candidate_key)
);

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS model_version text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS daily_report_evaluation_id uuid REFERENCES daily_financial_report_evaluations(id) ON DELETE CASCADE;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_anomaly_source_chk;
ALTER TABLE alerts ADD CONSTRAINT alerts_anomaly_source_chk CHECK (category <> 'anomaly_detection' OR anomaly_evaluation_id IS NOT NULL OR daily_report_evaluation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS alerts_user_triggered_id_idx ON alerts (user_id, triggered_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS alerts_daily_report_evaluation_unique_idx ON alerts (daily_report_evaluation_id) WHERE daily_report_evaluation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS daily_financial_reports_retention_idx ON daily_financial_reports (completed_at);
CREATE INDEX IF NOT EXISTS daily_financial_report_evaluations_retention_idx ON daily_financial_report_evaluations (created_at);

ALTER TABLE daily_financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_financial_report_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_financial_reports_owner_read ON daily_financial_reports FOR SELECT USING (user_id = auth.uid());
CREATE POLICY daily_financial_report_evaluations_owner_read ON daily_financial_report_evaluations FOR SELECT USING (
  EXISTS (SELECT 1 FROM daily_financial_reports WHERE daily_financial_reports.id = daily_financial_report_evaluations.report_id AND daily_financial_reports.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION increment_alert_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.revision := OLD.revision + 1; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS alerts_increment_revision ON alerts;
CREATE TRIGGER alerts_increment_revision BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION increment_alert_revision();

ALTER TABLE alert_notification_preferences ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE anomaly_whitelist_rules ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE alert_suppression_rules ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION write_daily_financial_report(
  p_user_id uuid, p_report_date date, p_cadence text, p_model_version text,
  p_period_start date, p_evaluations jsonb, p_alerts jsonb
) RETURNS TABLE(report_id uuid, evaluations integer, alerts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_report_id uuid; v_alert_id uuid; v_evaluations integer := 0; v_alerts integer := 0; v_item jsonb;
BEGIN
  IF p_cadence NOT IN ('daily', 'weekly') OR p_evaluations IS NULL OR jsonb_typeof(p_evaluations) <> 'array' OR p_alerts IS NULL OR jsonb_typeof(p_alerts) <> 'array' THEN RAISE EXCEPTION 'invalid daily financial report payload'; END IF;
  INSERT INTO daily_financial_reports (user_id, report_date, cadence, model_version, period_start, status, completed_at)
  VALUES (p_user_id, p_report_date, p_cadence, p_model_version, p_period_start, 'completed', now())
  ON CONFLICT (user_id, report_date, cadence, model_version)
  DO UPDATE SET status = 'completed', failure_reason = NULL, completed_at = now()
  RETURNING id INTO v_report_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_evaluations) LOOP
    INSERT INTO daily_financial_report_evaluations (report_id, candidate_key, finding, severity, explanation, source_references, anomaly_score)
    VALUES (v_report_id, v_item->>'candidate_key', v_item->>'finding', NULLIF(v_item->>'severity', '')::odin_alert_severity, v_item->>'explanation', COALESCE(v_item->'source_references', '{}'::jsonb), NULLIF(v_item->>'anomaly_score', '')::numeric)
    ON CONFLICT (report_id, candidate_key) DO UPDATE SET finding = EXCLUDED.finding, severity = EXCLUDED.severity, explanation = EXCLUDED.explanation, source_references = EXCLUDED.source_references, anomaly_score = EXCLUDED.anomaly_score;
    v_evaluations := v_evaluations + 1;
  END LOOP;
  -- Alerts are accepted only from an approved model adapter. The disabled adapter passes [].
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_alerts) LOOP
    INSERT INTO alerts (user_id, category, source_type, severity, title, body, explanation, duplicate_key, metadata, revision, model_version, transaction_id, subcategory_id, budget_id, daily_report_evaluation_id)
    VALUES (p_user_id, (v_item->>'category')::odin_alert_category, 'experimental_model', (v_item->>'severity')::odin_alert_severity, v_item->>'title', v_item->>'body', v_item->>'explanation', v_item->>'duplicate_key', jsonb_build_object('report_id', v_report_id, 'model_version', p_model_version), 1, p_model_version, NULLIF(v_item->'source_references'->>'transaction_id', '')::uuid, NULLIF(v_item->'source_references'->>'subcategory_id', '')::uuid, NULLIF(v_item->'source_references'->>'budget_id', '')::uuid, (SELECT id FROM daily_financial_report_evaluations WHERE report_id = v_report_id AND candidate_key = v_item->>'candidate_key'))
    ON CONFLICT (daily_report_evaluation_id) WHERE daily_report_evaluation_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_alert_id;
    IF v_alert_id IS NOT NULL THEN
      INSERT INTO alert_events (alert_id, action, payload) VALUES (v_alert_id, 'created', jsonb_build_object('report_date', p_report_date, 'model_version', p_model_version));
      INSERT INTO alert_related_entities (alert_id, entity_type, entity_id, metadata)
      SELECT v_alert_id, 'transaction', NULLIF(v_item->'source_references'->>'transaction_id', '')::uuid, '{}'::jsonb WHERE v_item->'source_references' ? 'transaction_id';
      v_alerts := v_alerts + 1;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_report_id, v_evaluations, v_alerts;
END;
$$;

CREATE OR REPLACE FUNCTION record_daily_financial_report_failure(
  p_user_id uuid, p_report_date date, p_cadence text, p_model_version text, p_failure_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO daily_financial_reports (user_id, report_date, cadence, model_version, period_start, status, failure_reason)
  VALUES (p_user_id, p_report_date, p_cadence, p_model_version, p_report_date, 'failed', left(p_failure_reason, 500))
  ON CONFLICT (user_id, report_date, cadence, model_version)
  DO UPDATE SET status = 'failed', failure_reason = EXCLUDED.failure_reason, completed_at = now();
END;
$$;
REVOKE ALL ON FUNCTION record_daily_financial_report_failure(uuid, date, text, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION record_daily_financial_report_failure(uuid, date, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION write_daily_financial_report(uuid, date, text, text, date, jsonb, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION write_daily_financial_report(uuid, date, text, text, date, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION apply_alert_feedback_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_user_id uuid := auth.uid(); v_version integer; v_existing_user uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity NOT IN ('alert_notification_preferences', 'anomaly_whitelist_rules', 'alert_suppression_rules') OR p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported alert feedback operation'; END IF;
  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending')) ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id INTO v_existing_user FROM applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user IS DISTINCT FROM v_user_id THEN RETURN QUERY SELECT 'rejected', 'operation belongs to another user', NULL::integer, NULL::text[]; ELSE RETURN QUERY SELECT 'duplicate', NULL::text, NULL::integer, NULL::text[]; END IF;
    RETURN;
  END IF;
  IF p_operation_type = 'create' THEN
    IF p_entity = 'alert_notification_preferences' THEN
      INSERT INTO alert_notification_preferences (id, user_id, category, mode, in_app_enabled, push_enabled, duplicate_cooldown_hours, snoozed_until, version, deleted, updated_at)
      VALUES (p_record_id, v_user_id, (p_payload->>'category')::odin_alert_category, COALESCE((p_payload->>'mode')::odin_alert_preference_mode, 'enabled'), COALESCE((p_payload->>'in_app_enabled')::boolean, true), COALESCE((p_payload->>'push_enabled')::boolean, false), COALESCE((p_payload->>'duplicate_cooldown_hours')::integer, 24), NULLIF(p_payload->>'snoozed_until', '')::timestamptz, 1, false, now());
    ELSIF p_entity = 'anomaly_whitelist_rules' THEN
      INSERT INTO anomaly_whitelist_rules (id, user_id, merchant_name, subcategory_id, base_amount_centavos, tolerance_bps, allow_any_amount, status, notes, version, deleted)
      VALUES (p_record_id, v_user_id, p_payload->>'merchant_name', (p_payload->>'subcategory_id')::uuid, NULLIF(p_payload->>'base_amount_centavos', '')::bigint, NULLIF(p_payload->>'tolerance_bps', '')::integer, COALESCE((p_payload->>'allow_any_amount')::boolean, false), COALESCE((p_payload->>'status')::odin_suppression_rule_status, 'active'), p_payload->>'notes', 1, false);
    ELSE
      INSERT INTO alert_suppression_rules (id, user_id, category, source_type, status, merchant_name, subcategory_id, category_id, amount_center_centavos, amount_tolerance_bps, starts_at, ends_at, reason, metadata, version, deleted)
      VALUES (p_record_id, v_user_id, (p_payload->>'category')::odin_alert_category, NULLIF(p_payload->>'source_type', '')::odin_alert_source_type, COALESCE((p_payload->>'status')::odin_suppression_rule_status, 'active'), p_payload->>'merchant_name', NULLIF(p_payload->>'subcategory_id', '')::uuid, NULLIF(p_payload->>'category_id', '')::uuid, NULLIF(p_payload->>'amount_center_centavos', '')::bigint, NULLIF(p_payload->>'amount_tolerance_bps', '')::integer, COALESCE(NULLIF(p_payload->>'starts_at', '')::timestamptz, now()), NULLIF(p_payload->>'ends_at', '')::timestamptz, p_payload->>'reason', COALESCE(p_payload->'metadata', '{}'::jsonb), 1, false);
    END IF;
    v_version := 1;
  ELSE
    EXECUTE format('SELECT version FROM %I WHERE id = $1 AND user_id = $2 FOR UPDATE', p_entity) INTO v_version USING p_record_id, v_user_id;
    IF v_version IS NULL THEN RAISE EXCEPTION 'feedback record not found or inaccessible'; END IF;
    IF p_base_version IS NOT NULL AND p_base_version <> v_version THEN DELETE FROM applied_operations WHERE operation_id = p_operation_id; RETURN QUERY SELECT 'conflict', 'feedback version changed', v_version, p_changed_fields; RETURN; END IF;
    IF p_operation_type = 'delete' THEN EXECUTE format('UPDATE %I SET deleted = true, version = version + 1, updated_at = now() WHERE id = $1 AND user_id = $2', p_entity) USING p_record_id, v_user_id;
    ELSE
      -- JSONB projection permits only validated API fields; SQL still scopes every mutation by user.
      IF p_entity = 'alert_notification_preferences' THEN UPDATE alert_notification_preferences SET mode = COALESCE((p_payload->>'mode')::odin_alert_preference_mode, mode), in_app_enabled = COALESCE((p_payload->>'in_app_enabled')::boolean, in_app_enabled), push_enabled = COALESCE((p_payload->>'push_enabled')::boolean, push_enabled), duplicate_cooldown_hours = COALESCE((p_payload->>'duplicate_cooldown_hours')::integer, duplicate_cooldown_hours), snoozed_until = CASE WHEN p_payload ? 'snoozed_until' THEN NULLIF(p_payload->>'snoozed_until', '')::timestamptz ELSE snoozed_until END, version = version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
      ELSIF p_entity = 'anomaly_whitelist_rules' THEN UPDATE anomaly_whitelist_rules SET status = COALESCE((p_payload->>'status')::odin_suppression_rule_status, status), notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END, version = version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
      ELSE UPDATE alert_suppression_rules SET status = COALESCE((p_payload->>'status')::odin_suppression_rule_status, status), ends_at = CASE WHEN p_payload ? 'ends_at' THEN NULLIF(p_payload->>'ends_at', '')::timestamptz ELSE ends_at END, reason = COALESCE(p_payload->>'reason', reason), version = version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
      END IF;
    END IF;
    v_version := v_version + 1;
  END IF;
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_version) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied', NULL::text, v_version, NULL::text[];
END;
$$;
GRANT EXECUTE ON FUNCTION apply_alert_feedback_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
