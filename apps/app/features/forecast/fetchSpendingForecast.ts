import { getForecastHistoryStartDate, listForecastTransactions, listRecurringForecastPayments } from "../../local-db/repositories/forecastTransactions";
import { listScheduledPayments } from "../../local-db/repositories/scheduledPayments";
import { requestQuarterlyForecast } from "./api";
import { addRecurringPayments } from "./recurringForecast";
import { addScheduledPayments } from "./scheduledForecast";
import type { QuarterlyForecastPayload } from "./types";

// The spending forecast the reports chart shows: odin-ml's monthly and quarterly forecast, with scheduled
// payments added at their set amounts and unusual payments added back in the months the user said they recur. With asOf (YYYY-MM-DD) it is the forecast as it stood that day, made
// from the year of spending before it, so last year's seasonal spending carries over the same way.
export async function fetchSpendingForecast(userId: string, accessToken: string, { asOf, signal }: { asOf?: string; signal?: AbortSignal } = {}): Promise<{ payload: QuarterlyForecastPayload } | { notice: string }> {
  const fromDate = getForecastHistoryStartDate(asOf ? new Date(`${asOf}T00:00:00+08:00`) : undefined);
  const historicalTransactions = await listForecastTransactions(userId, { fromDate, excludeScheduledPayments: true, excludeUnusualSpending: true });
  if (historicalTransactions.length === 0) return { notice: "Record a posted income or expense before requesting a forecast." };
  const result = await requestQuarterlyForecast(accessToken, { historicalTransactions, ...(asOf ? { asOf } : {}) }, signal);
  if (result.response.ok && result.body.payload === null && result.body.reason) return { notice: result.body.message ?? "A spending forecast isn't available yet." };
  if (!result.response.ok || !result.body.payload) throw new Error("forecast_request_failed");
  const [scheduled, recurring] = await Promise.all([listScheduledPayments(userId), listRecurringForecastPayments(userId, asOf)]);
  return { payload: addRecurringPayments(addScheduledPayments(result.body.payload, scheduled), recurring) };
}
