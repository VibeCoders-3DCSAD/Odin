-- The RETURNS TABLE output name report_id is a PL/pgSQL variable. Qualify the
-- evaluation table column so creating report alerts cannot resolve it ambiguously.
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

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_alerts) LOOP
    INSERT INTO alerts (user_id, category, source_type, severity, title, body, explanation, duplicate_key, metadata, revision, model_version, transaction_id, subcategory_id, budget_id, daily_report_evaluation_id)
    VALUES (p_user_id, (v_item->>'category')::odin_alert_category, 'experimental_model', (v_item->>'severity')::odin_alert_severity, v_item->>'title', v_item->>'body', v_item->>'explanation', v_item->>'duplicate_key', jsonb_build_object('report_id', v_report_id, 'model_version', p_model_version), 1, p_model_version, NULLIF(v_item->'source_references'->>'transaction_id', '')::uuid, NULLIF(v_item->'source_references'->>'subcategory_id', '')::uuid, NULLIF(v_item->'source_references'->>'budget_id', '')::uuid, (SELECT evaluation.id FROM daily_financial_report_evaluations AS evaluation WHERE evaluation.report_id = v_report_id AND evaluation.candidate_key = v_item->>'candidate_key'))
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
