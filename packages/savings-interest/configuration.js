const fields = ["version", "calculationFrequency", "creditFrequency", "creditIntervalDays", "postingMode", "postingDay", "postingDate", "startsOn", "startingBalanceCentavos", "averagingPeriod", "averagingIntervalDays", "minimumQualifyingBalanceCentavos", "maximumInterestBearingBalanceCentavos", "dayCountBasis", "taxEnabled", "withholdingTaxBps", "autoProject", "stoppingPolicy", "showBreakdown", "rateHistory"];
function date(value, label) {
  const parsed = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < "2000-01-01" || value > "2100-12-31") throw new Error(`Enter a valid ${label} between 2000 and 2100.`);
}
function integer(value, label, maximum = Number.MAX_SAFE_INTEGER, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Enter a valid ${label}.`);
}
function choice(value, values, label) {
  if (!values.includes(value)) throw new Error(`Choose a valid ${label}.`);
}
function normalizeConfiguration(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || fields.some((key) => !(key in value)) || Object.keys(value).some((key) => !fields.includes(key))) throw new Error("Interest configuration is incomplete or contains unsupported fields.");
  if (value.version !== 1 || value.calculationFrequency !== "daily") throw new Error("Unsupported interest configuration version or calculation frequency.");
  choice(value.creditFrequency, ["daily", "monthly", "quarterly", "yearly", "custom"], "credit frequency");
  choice(value.postingMode, ["period_end", "day_of_month", "specific_date"], "posting timing");
  choice(value.averagingPeriod, ["calendar_month", "credit_period", "custom"], "averaging period");
  choice(value.dayCountBasis, ["actual_365", "actual_366", "actual_actual"], "day-count basis");
  choice(value.stoppingPolicy, ["preserve", "settle", "discard_projection"], "stopping policy");
  date(value.startsOn, "interest start date");
  for (const key of ["startingBalanceCentavos", "minimumQualifyingBalanceCentavos", "maximumInterestBearingBalanceCentavos"]) if (value[key] !== null) integer(value[key], key);
  if (value.minimumQualifyingBalanceCentavos !== null && value.maximumInterestBearingBalanceCentavos !== null && value.maximumInterestBearingBalanceCentavos < value.minimumQualifyingBalanceCentavos) throw new Error("Maximum interest-bearing balance cannot be below the minimum qualifying balance.");
  for (const key of ["creditIntervalDays", "averagingIntervalDays"]) if (value[key] !== null) integer(value[key], "interval in days", 3660, 1);
  if (value.creditFrequency === "custom" && value.creditIntervalDays === null) throw new Error("Enter a custom credit interval in days.");
  if (value.averagingPeriod === "custom" && value.averagingIntervalDays === null) throw new Error("Enter a custom averaging interval in days.");
  if (value.postingDay !== null) integer(value.postingDay, "posting day", 31, 1);
  if (value.postingMode === "day_of_month" && value.postingDay === null) throw new Error("Enter a posting day from 1 to 31.");
  if (value.postingDate !== null) date(value.postingDate, "posting date");
  if (value.postingMode === "specific_date" && value.postingDate === null) throw new Error("Enter a posting date.");
  if (value.postingMode === "specific_date" && value.postingDate < value.startsOn) throw new Error("Posting date cannot be before the interest start date.");
  for (const key of ["taxEnabled", "autoProject", "showBreakdown"]) if (typeof value[key] !== "boolean") throw new Error("Interest preferences must be on or off.");
  integer(value.withholdingTaxBps, "withholding tax from 0 to 100%", 10000);
  if (!Array.isArray(value.rateHistory) || value.rateHistory.length > 100) throw new Error("Use at most 100 dated interest rates.");
  let previous = "";
  for (const entry of value.rateHistory) {
    if (!entry || typeof entry !== "object" || Object.keys(entry).length !== 2 || !("effectiveOn" in entry) || !("rateBps" in entry)) throw new Error("Each rate change needs an effective date and annual rate.");
    date(entry.effectiveOn, "rate effective date"); integer(entry.rateBps, "annual rate from 0 to 1000%", 100000);
    if (entry.effectiveOn < value.startsOn || entry.effectiveOn <= previous) throw new Error("Rate effective dates must be on or after the start date and strictly increasing.");
    previous = entry.effectiveOn;
  }
  return Object.fromEntries(fields.map((key) => [key, key === "autoProject" ? false : key === "rateHistory" ? value.rateHistory.map((entry) => ({ ...entry })) : value[key]]));
}
exports.normalizeConfiguration = normalizeConfiguration;
