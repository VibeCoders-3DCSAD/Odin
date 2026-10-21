const { normalizeConfiguration } = require("./configuration");
const { normalizeSchedule, validateScheduledInterest } = require("./schedule");
function normalizeSavingsInterestReference(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Interest details must be an object.");
  const details = value;
  const choices = { balanceBasis: ["daily_balance", "average_daily_balance"], method: ["simple", "compound", "none"], rateStructure: ["fixed", "tiered"] };
  if (Object.keys(details).some((key) => ![...Object.keys(choices), "notes", "schedule", "configuration"].includes(key))) throw new Error("Interest details contain an unsupported field.");
  for (const [key, allowed] of Object.entries(choices)) {
    if (details[key] != null && (typeof details[key] !== "string" || !allowed.includes(details[key]))) throw new Error("Choose a valid interest option.");
  }
  if (details.notes != null && (typeof details.notes !== "string" || details.notes.length > 1000)) throw new Error("Interest notes must be 1000 characters or fewer.");
  const normalized = {
    balanceBasis: details.balanceBasis ?? null,
    method: details.method ?? null,
    rateStructure: details.rateStructure ?? null,
    notes: typeof details.notes === "string" ? details.notes.trim() || null : null,
  };
  if (details.configuration != null) {
    if (details.schedule != null || details.rateStructure !== "fixed") throw new Error("Fixed interest configuration cannot use tiered rates or the legacy automatic credit schedule.");
    normalized.configuration = normalizeConfiguration(details.configuration);
    if (!details.balanceBasis || !details.method) throw new Error("Choose a calculation basis and interest behavior.");
  }
  if (details.schedule != null) {
    normalized.schedule = normalizeSchedule(details.schedule);
    validateScheduledInterest(normalized, 0);
  }
  return Object.values(normalized).every((entry) => entry === null) ? null : normalized;
}

exports.normalizeSavingsInterestReference = normalizeSavingsInterestReference;

exports.validateScheduledInterest = validateScheduledInterest;

exports.normalizeSavingsInterestConfiguration = normalizeConfiguration;
