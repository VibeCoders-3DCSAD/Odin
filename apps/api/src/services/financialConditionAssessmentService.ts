import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyFinancialCondition } from "../lib/mlClient.js";

export type FinancialConditionAssessment = {
  id: string;
  assessed_at: string;
  rule_set_version: string;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
};

export async function createFinancialConditionAssessment(userId: string, supabase: SupabaseClient): Promise<FinancialConditionAssessment | null> {
  const { data: input, error } = await supabase.rpc("get_financial_classification_v2_input", { p_user_id: userId });
  if (error || !input || typeof input !== "object" || Array.isArray(input)) return null;

  const result = await classifyFinancialCondition(userId, input as Record<string, unknown>);
  if (!result.ok) return null;

  const { data: assessment, error: insertError } = await supabase
    .from("financial_condition_assessments")
    .insert({ user_id: userId, rule_set_version: result.modelVersion, input_snapshot: input, output_snapshot: result.classification })
    .select("id, assessed_at, rule_set_version, input_snapshot, output_snapshot")
    .single();
  if (insertError || !assessment) return null;
  return assessment as FinancialConditionAssessment;
}
