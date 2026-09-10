export const anomalyConfig = {
  schedule: { cron: "0 18 * * *", timezone: "Asia/Manila", weekStartsOn: "monday" },
  history: { lookbackMonths: 6 },
  scoring: { anomalousAtScore: 0.7, criticalAtScore: 0.9 },
  reports: { currentWeekCadence: "daily", pastWeekCadence: "weekly", backfillCurrentWeekDaily: true, backfillPastWeeksWeekly: true },
  idempotency: { reportKey: "user_id + report_date + cadence + model_version" },
  retries: { maxAttempts: 3, backoffMs: [1_000, 5_000, 25_000] },
  findings: { createAlertsFor: ["unusual_transaction", "budget_overspending"], reportOnly: ["insufficient_history", "model_unavailable"] },
  severity: { budgetOverspending: { warningAtPercentOverBudget: 10, criticalAtPercentOverBudget: 25 } },
  retention: { reportDays: 28, evaluationDays: 28, failureDays: 28 },
} as const;
