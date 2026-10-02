export type SurplusReasonCode =
  | "NEGATIVE_FINANCIAL_MARGIN"
  | "EMERGENCY_FUND_INADEQUATE"
  | "DEBT_SIGNAL"
  | "USER_DIRECTED"
  | "ASSESSMENT_UNAVAILABLE"
  | "ASSESSMENT_STALE"
  | "ASSESSMENT_INSUFFICIENT_DATA";

export type SurplusRecommendation = {
  unallocatedSurplusCentavos: number;
  reasonCode: SurplusReasonCode;
  assessmentStatus: "applied" | "unavailable" | "stale" | "insufficient_data";
  advisoryDestination: { type: "emergency_fund"; savingsGoalId: string } | { type: "debt"; debtAccountId: string } | null;
  assessmentEvidence: Record<string, unknown> | null;
};

type RuleAssessment = { status?: unknown; label?: unknown };
type Assessment = {
  id: string;
  assessedAt: string;
  ruleSetVersion: string;
  outputSnapshot: Record<string, unknown>;
};

function rule(snapshot: Record<string, unknown>, name: string): RuleAssessment | null {
  const value = snapshot[name];
  return value && typeof value === "object" && !Array.isArray(value) ? value as RuleAssessment : null;
}

function isSuccessful(assessment: RuleAssessment | null): boolean {
  return assessment?.status === "SUCCESS";
}

function isInsufficient(assessment: RuleAssessment | null): boolean {
  return assessment?.status === "INSUFFICIENT_DATA" || assessment?.status === "INSUFFICIENT_HISTORY";
}

function neutral(unallocatedSurplusCentavos: number, reasonCode: SurplusReasonCode, assessmentStatus: SurplusRecommendation["assessmentStatus"], assessment: Assessment | null): SurplusRecommendation {
  return {
    unallocatedSurplusCentavos,
    reasonCode,
    assessmentStatus,
    advisoryDestination: null,
    assessmentEvidence: assessment ? {
      assessmentId: assessment.id,
      assessedAt: assessment.assessedAt,
      ruleSetVersion: assessment.ruleSetVersion,
      outputSnapshot: assessment.outputSnapshot,
    } : null,
  };
}

export function deriveSurplusRecommendation({
  unallocatedSurplusCentavos,
  assessment,
  sourceUpdatedAt,
  eligibleEmergencyGoalId,
  eligibleDebtId,
}: {
  unallocatedSurplusCentavos: number;
  assessment: Assessment | null;
  sourceUpdatedAt: string | null;
  eligibleEmergencyGoalId: string | null;
  eligibleDebtId: string | null;
}): SurplusRecommendation {
  const surplus = Math.max(0, Math.trunc(unallocatedSurplusCentavos));
  if (!assessment) return neutral(surplus, "ASSESSMENT_UNAVAILABLE", "unavailable", null);
  if (sourceUpdatedAt && new Date(sourceUpdatedAt).getTime() > new Date(assessment.assessedAt).getTime()) {
    return neutral(surplus, "ASSESSMENT_STALE", "stale", assessment);
  }

  const emergencySavings = rule(assessment.outputSnapshot, "emergency_savings");
  const debtBurden = rule(assessment.outputSnapshot, "debt_burden");
  const financialMargin = rule(assessment.outputSnapshot, "financial_margin");
  if ([emergencySavings, debtBurden, financialMargin].some((item) => isInsufficient(item))) {
    return neutral(surplus, "ASSESSMENT_INSUFFICIENT_DATA", "insufficient_data", assessment);
  }
  if (![emergencySavings, debtBurden, financialMargin].every(isSuccessful)) {
    return neutral(surplus, "ASSESSMENT_UNAVAILABLE", "unavailable", assessment);
  }

  const evidence = {
    assessmentId: assessment.id,
    assessedAt: assessment.assessedAt,
    ruleSetVersion: assessment.ruleSetVersion,
    outputSnapshot: assessment.outputSnapshot,
  };
  if (financialMargin?.label === "NEGATIVE_FINANCIAL_MARGIN") {
    return { unallocatedSurplusCentavos: surplus, reasonCode: "NEGATIVE_FINANCIAL_MARGIN", assessmentStatus: "applied", advisoryDestination: null, assessmentEvidence: evidence };
  }
  if (emergencySavings?.label === "EMERGENCY_FUND_INADEQUATE" && eligibleEmergencyGoalId) {
    return { unallocatedSurplusCentavos: surplus, reasonCode: "EMERGENCY_FUND_INADEQUATE", assessmentStatus: "applied", advisoryDestination: { type: "emergency_fund", savingsGoalId: eligibleEmergencyGoalId }, assessmentEvidence: evidence };
  }
  if (debtBurden?.label === "FINANCIALLY_OVERBURDENED" && eligibleDebtId) {
    return { unallocatedSurplusCentavos: surplus, reasonCode: "DEBT_SIGNAL", assessmentStatus: "applied", advisoryDestination: { type: "debt", debtAccountId: eligibleDebtId }, assessmentEvidence: evidence };
  }
  return { unallocatedSurplusCentavos: surplus, reasonCode: "USER_DIRECTED", assessmentStatus: "applied", advisoryDestination: null, assessmentEvidence: evidence };
}
