import { createAlertProvider } from "../../../services/alerts/alertProviderFactory";
import { RuleBasedAnomalyProvider } from "../../../services/alerts/ruleBasedAnomalyProvider";
import { RuleBasedOverspendingProvider } from "../../../services/alerts/ruleBasedOverspendingProvider";
import type { AlertTransaction } from "../../../services/alerts/types";

const baseTransaction: AlertTransaction = {
  id: "current",
  amount_centavos: 1_000,
  transaction_date: "2026-08-15",
  transaction_type: "expense",
  merchant_name: "Market",
  subcategory_id: "food",
  subcategory_label: "Food",
};
const NOW = new Date("2026-08-15T12:00:00.000Z");

function history(id: string, amount_centavos: number): AlertTransaction {
  return { ...baseTransaction, id, amount_centavos };
}

describe("rule-based alert providers", () => {
  it("returns insufficient history on cold start", () => {
    const result = new RuleBasedAnomalyProvider().evaluate({ transaction: baseTransaction, historical_transactions: [], now: NOW });

    expect(result.decision).toBe("insufficient_history");
    expect(result.should_alert_user).toBe(false);
  });

  it("does not alert for normal or expected recurring spending", () => {
    const result = new RuleBasedAnomalyProvider().evaluate({
      transaction: baseTransaction,
      historical_transactions: [history("history-one", 1_000), history("history-two", 1_100), history("history-three", 900)],
      now: NOW,
    });

    expect(result.decision).toBe("no_alert");
    expect(result.suppression.reason).toBe("expected_recurring_spending");
  });

  it("alerts when an amount is anomalously high", () => {
    const result = new RuleBasedAnomalyProvider().evaluate({
      transaction: { ...baseTransaction, amount_centavos: 3_000 },
      historical_transactions: [history("history-one", 1_000), history("history-two", 1_100), history("history-three", 900)],
      now: NOW,
    });

    expect(result.decision).toBe("alert");
    expect(result.should_alert_user).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.feature_drivers[0]?.baseline_centavos).toBe(1_000);
  });

  it("calculates overspending and severity from the active cycle", () => {
    const result = new RuleBasedOverspendingProvider().evaluate({
      allocation: {
        budget_id: "budget",
        budget_allocation_id: "allocation",
        amount_centavos: 10_000,
        category_id: null,
        subcategory_id: "food",
        cycle_start: "2026-08-01",
        cycle_end: "2026-08-31",
      },
      transactions: [
        { ...baseTransaction, id: "one", amount_centavos: 15_000 },
        { ...baseTransaction, id: "outside", amount_centavos: 50_000, transaction_date: "2026-07-31" },
      ],
      now: NOW,
    });

    expect(result.decision).toBe("alert");
    expect(result.severity).toBe("critical");
    expect(result.feature_drivers[0]?.value_centavos).toBe(15_000);
    expect(result.evaluated_at).toBe("2026-08-15T12:00:00.000Z");
  });

  it("selects rules and reserves ml", () => {
    expect(createAlertProvider({ provider: "rules" }).name).toBe("rules");
    expect(() => createAlertProvider({ provider: "ml" })).toThrow(/adapter is implemented/);
  });
});
