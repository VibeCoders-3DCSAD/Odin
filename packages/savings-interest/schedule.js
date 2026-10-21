const FREQUENCIES = ["daily", "monthly", "quarterly", "yearly"];
function normalizeSchedule(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["startsOn", "frequency", "withholdingTaxBps", "tiers"].includes(key))) throw new Error("Invalid interest schedule.");
  const date = typeof value.startsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.startsOn) ? new Date(`${value.startsOn}T00:00:00Z`) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.startsOn || value.startsOn < "2000-01-01" || value.startsOn > "2100-12-31") throw new Error("Enter a valid interest start date between 2000 and 2100.");
  if (!FREQUENCIES.includes(value.frequency)) throw new Error("Choose an interest credit frequency.");
  const tax = value.withholdingTaxBps ?? 0;
  if (!Number.isSafeInteger(tax) || tax < 0 || tax > 10000) throw new Error("Withholding tax must be between 0 and 100%.");
  const tiers = value.tiers ?? [];
  if (!Array.isArray(tiers) || tiers.length > 20) throw new Error("Use at most 20 interest tiers.");
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (!tier || typeof tier !== "object" || Object.keys(tier).some((key) => !["minimumBalanceCentavos", "interestRateBps"].includes(key)) || !Number.isSafeInteger(tier.minimumBalanceCentavos) || tier.minimumBalanceCentavos < 0 || !Number.isSafeInteger(tier.interestRateBps) || tier.interestRateBps < 0 || tier.interestRateBps > 100000 || (i === 0 ? tier.minimumBalanceCentavos !== 0 : tier.minimumBalanceCentavos <= tiers[i - 1].minimumBalanceCentavos)) throw new Error("Interest tiers must start at zero with increasing balances and valid annual rates (0–1000%).");
  }
  return { startsOn: value.startsOn, frequency: value.frequency, withholdingTaxBps: tax, tiers: tiers.map((tier) => ({ minimumBalanceCentavos: tier.minimumBalanceCentavos, interestRateBps: tier.interestRateBps })) };
}
function validateScheduledInterest(reference, annualRateBps) {
  if (reference?.configuration) {
    if (!Number.isSafeInteger(annualRateBps) || annualRateBps < 0 || annualRateBps > 100000) throw new Error("Enter a nominal annual interest rate between 0 and 1000%.");
    if (reference.method === "none" && annualRateBps !== 0) throw new Error("None must use a zero interest rate.");
  }
  if (!reference?.schedule) return;
  if (!reference.balanceBasis || !["simple", "compound"].includes(reference.method) || !reference.rateStructure) throw new Error("Choose a balance basis, interest method and rate structure before enabling automatic credits.");
  if (!Number.isSafeInteger(annualRateBps) || annualRateBps < 0 || annualRateBps > 100000) throw new Error("Automatic credits require an annual rate between 0 and 1000%.");
  if (reference.rateStructure === "tiered" && !reference.schedule.tiers.length) throw new Error("Add balance thresholds and annual rates for tiered interest.");
}
exports.normalizeSchedule = normalizeSchedule;
exports.validateScheduledInterest = validateScheduledInterest;
