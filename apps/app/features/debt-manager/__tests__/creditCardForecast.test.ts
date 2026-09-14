import { buildCreditCardForecast, buildCreditCardForecastAsync, type CreditCardForecastInput } from "../creditCardForecast";

describe("buildCreditCardForecast", () => {
  it("returns the same result through the cooperative async path", async () => {
    const input: CreditCardForecastInput = {
      cycles: [{ id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: null, version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-08-05T00:00:00.000Z" }],
      transactions: Array.from({ length: 51 }, (_, index) => ({ transaction_id: `transaction-${index}`, account_id: "card-1", cycle_id: "cycle-1", purchase_type: "regular" as const, installment_id: null, transaction_date: "2026-09-01", merchant_name: null, amount_centavos: 1_000 })),
      statements: [],
      strategy: { accountId: "card-1", strategy: "pay_in_full" as const, customAmountCentavos: null, percentageBps: null, version: 1 },
      payments: [],
      installments: [],
      availableCreditCentavos: 9_949_000,
      creditLimitCentavos: 10_000_000,
      billingCycleDays: 31,
      asOfDate: "2026-09-01",
    };

    await expect(buildCreditCardForecastAsync(input)).resolves.toEqual(buildCreditCardForecast(input));
  });

  it("anchors current debt to issuer credit and applies only later events", () => {
    const forecast = buildCreditCardForecast({
      cycles: [{ id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-09-01", cutoff_date: "2026-09-30", statement_date: null, version: 1, deleted: false, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z" }],
      transactions: [
        { transaction_id: "before", account_id: "card-1", cycle_id: "cycle-1", purchase_type: "regular", installment_id: null, transaction_date: "2026-09-10", merchant_name: null, amount_centavos: 100_000, forecast_recorded_at: "2026-09-10T10:00:00.000Z" },
        { transaction_id: "after", account_id: "card-1", cycle_id: "cycle-1", purchase_type: "regular", installment_id: null, transaction_date: "2026-09-10", merchant_name: null, amount_centavos: 50_000, forecast_recorded_at: "2026-09-10T14:00:00.000Z" },
      ],
      statements: [], strategy: undefined, payments: [], installments: [],
      creditLimitCentavos: 1_000_000, availableCreditCentavos: 700_000, billingCycleDays: null,
      reconciledAvailableCreditCentavos: 800_000, preReconciliationAvailableCreditCentavos: 900_000,
      availableCreditReconciledAt: "2026-09-10T12:00:00.000Z", asOfDate: "2026-09-10",
    });

    expect(forecast.points).toEqual(expect.arrayContaining([
      expect.objectContaining({ cycleId: "estimated-history-0", availableCreditCentavos: 900_000, isEstimated: true }),
      expect.objectContaining({ cycleId: "issuer-reconciliation", availableCreditCentavos: 800_000 }),
      expect.objectContaining({ cycleId: "post-reconciliation-0", availableCreditCentavos: 750_000 }),
    ]));
  });

  it("uses the recorded billing-cycle length when the card configuration is missing it", () => {
    const baseInput = {
      cycles: [{ id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: "2026-09-04", version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z" }],
      transactions: [],
      statements: [{ id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-09-04", due_date: "2026-09-15", statement_balance_centavos: 3_000_000, minimum_due_centavos: 500_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z" }],
      payments: [],
      installments: [],
      availableCreditCentavos: 7_000_000,
      creditLimitCentavos: 10_000_000,
      billingCycleDays: null,
      reconciledAvailableCreditCentavos: 7_000_000,
      preReconciliationAvailableCreditCentavos: 7_000_000,
      availableCreditReconciledAt: "2026-09-10T08:00:00.000Z",
      asOfDate: "2026-09-10",
    };

    const twentyPercent = buildCreditCardForecast({
      ...baseInput,
      strategy: { accountId: "card-1", strategy: "percentage_of_statement" as const, customAmountCentavos: null, percentageBps: 2_000, version: 1 },
    });
    const fiftyPercent = buildCreditCardForecast({
      ...baseInput,
      strategy: { accountId: "card-1", strategy: "percentage_of_statement" as const, customAmountCentavos: null, percentageBps: 5_000, version: 1 },
    });

    expect(twentyPercent.points.find((point) => point.cycleId.startsWith("forecast"))?.targetCentavos).toBe(600_000);
    expect(fiftyPercent.points.find((point) => point.cycleId.startsWith("forecast"))?.targetCentavos).toBe(1_500_000);
  });

  it("keeps active installment amortizations after an unpaid statement", () => {
    const input: CreditCardForecastInput = {
      cycles: [{ id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: "2026-09-04", version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z" }],
      transactions: [],
      statements: [{ id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-09-06", due_date: "2026-09-06", statement_balance_centavos: 4_500_000, minimum_due_centavos: 300_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-09-06T00:00:00.000Z", updated_at: "2026-09-06T00:00:00.000Z" }],
      strategy: { accountId: "card-1", strategy: "pay_in_full", customAmountCentavos: null, percentageBps: null, version: 1 },
      payments: [],
      installments: [{ id: "installment-1", user_id: "user-1", account_id: "card-1", transaction_id: "transaction-1", description: "Refrigerator", original_principal_centavos: 1_000_000, remaining_principal_centavos: 1_000_000, term_months: 4, remaining_months: 4, monthly_amortization_centavos: 250_000, interest_type: "zero_interest", interest_rate_bps: 0, settlement_status: "active", version: 1, deleted: false, created_at: "2026-09-02T00:00:00.000Z", updated_at: "2026-09-02T00:00:00.000Z" }],
      availableCreditCentavos: 0,
      creditLimitCentavos: 5_000_000,
      billingCycleDays: 31,
      asOfDate: "2026-09-14",
    };

    const forecasts = [
      buildCreditCardForecast(input),
      buildCreditCardForecast({
        ...input,
        reconciledAvailableCreditCentavos: 0,
        preReconciliationAvailableCreditCentavos: 0,
        availableCreditReconciledAt: "2026-09-14T08:00:00.000Z",
      }),
    ];

    for (const forecast of forecasts) {
      const forecastPoints = forecast.points.filter((point) => point.cycleId.startsWith("forecast"));
      expect(forecastPoints.map((point) => 5_000_000 - point.availableCreditCentavos)).toEqual([4_750_000, 4_500_000, 4_250_000, 4_000_000]);
      expect(forecastPoints.map((point) => point.amortizationPaymentCentavos)).toEqual([250_000, 250_000, 250_000, 250_000]);
    }
  });

  it.each([
    ["pay_in_full", null, null, [1_250_000, 1_000_000, 750_000]],
    ["pay_minimum", null, null, [5_600_000, 5_200_000, 4_800_000]],
    ["percentage_of_statement", null, 5_000, [3_500_000, 1_000_000, 750_000]],
    ["custom_payment", 1_500_000, null, [4_250_000, 2_500_000, 750_000]],
  ] as const)("adds only the current month's amortization to the %s target", (strategyName, customAmountCentavos, percentageBps, expectedBalances) => {
    const forecast = buildCreditCardForecast({
      cycles: [{
        id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: null,
        version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-08-05T00:00:00.000Z",
      }],
      transactions: [],
      statements: [{
        id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-09-04", due_date: "2026-09-15", statement_balance_centavos: 4_500_000,
        minimum_due_centavos: 150_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z",
      }],
      strategy: { accountId: "card-1", strategy: strategyName, customAmountCentavos, percentageBps, version: 1 },
      payments: [],
      installments: [{
        id: "installment-1", user_id: "user-1", account_id: "card-1", transaction_id: "transaction-1", description: "Installment purchase", original_principal_centavos: 1_500_000,
        remaining_principal_centavos: 1_500_000, term_months: 10, remaining_months: 10, monthly_amortization_centavos: 250_000, interest_type: "zero_interest", interest_rate_bps: 0,
        settlement_status: "active", version: 1, deleted: false, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
      }],
      availableCreditCentavos: 4_000_000,
      creditLimitCentavos: 10_000_000,
      billingCycleDays: 31,
      asOfDate: "2026-09-05",
    });

    const forecastPoints = forecast.points.filter((point) => point.cycleId.startsWith("forecast"));
    expect(forecastPoints.slice(0, 3).map((point) => point.date)).toEqual(["2026-09-15", "2026-10-16", "2026-11-16"]);
    expect(forecastPoints.slice(0, 3).map((point) => 10_000_000 - point.availableCreditCentavos)).toEqual(expectedBalances);
  });

  it("carries a recorded payment into succeeding custom-payment nodes", () => {
    const forecast = buildCreditCardForecast({
      cycles: [{ id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: "2026-09-04", version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-08-05T00:00:00.000Z" }],
      transactions: [],
      statements: [{ id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-09-04", due_date: "2026-09-15", statement_balance_centavos: 4_500_000, minimum_due_centavos: 150_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z" }],
      strategy: { accountId: "card-1", strategy: "custom_payment", customAmountCentavos: 1_500_000, percentageBps: null, version: 1 },
      payments: [{ id: "payment-1", user_id: "user-1", cycle_id: "cycle-1", statement_id: "statement-1", transaction_id: "transaction-1", amount_centavos: 500_000, payment_date: "2026-09-10", source_account_id: "account-1", notes: null, issuer_recognized: false, client_mutation_id: "payment-1", version: 1, deleted: false, created_at: "2026-09-10T00:00:00.000Z", updated_at: "2026-09-10T00:00:00.000Z" }],
      installments: [],
      availableCreditCentavos: 6_000_000,
      creditLimitCentavos: 10_000_000,
      billingCycleDays: 31,
      asOfDate: "2026-09-10",
    });

    expect(forecast.points.filter((point) => point.cycleId.startsWith("forecast")).map((point) => 10_000_000 - point.availableCreditCentavos)).toEqual([2_500_000, 1_000_000, 0]);
  });

  it("shows amortization payments after the first statement payment", () => {
    const forecast = buildCreditCardForecast({
      cycles: [{ id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: "2026-09-04", version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-08-05T00:00:00.000Z" }],
      transactions: [
        { transaction_id: "regular-1", account_id: "card-1", cycle_id: "cycle-1", purchase_type: "regular", installment_id: null, transaction_date: "2026-09-01", merchant_name: null, amount_centavos: 4_500_000 },
        { transaction_id: "installment-transaction-1", account_id: "card-1", cycle_id: "cycle-1", purchase_type: "installment", installment_id: "installment-1", transaction_date: "2026-09-04", merchant_name: null, amount_centavos: 500_000 },
      ],
      statements: [{ id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-09-04", due_date: "2026-09-15", statement_balance_centavos: 5_000_000, minimum_due_centavos: 150_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z" }],
      strategy: { accountId: "card-1", strategy: "pay_in_full", customAmountCentavos: null, percentageBps: null, version: 1 },
      payments: [{ id: "payment-1", user_id: "user-1", cycle_id: "cycle-1", statement_id: "statement-1", transaction_id: "payment-transaction-1", amount_centavos: 1_500_000, payment_date: "2026-09-15", source_account_id: "account-1", notes: null, issuer_recognized: false, client_mutation_id: "payment-1", version: 1, deleted: false, created_at: "2026-09-15T00:00:00.000Z", updated_at: "2026-09-15T00:00:00.000Z" }],
      installments: [{ id: "installment-1", user_id: "user-1", account_id: "card-1", transaction_id: "installment-transaction-1", description: "Installment purchase", original_principal_centavos: 1_500_000, remaining_principal_centavos: 1_500_000, term_months: 10, remaining_months: 10, monthly_amortization_centavos: 250_000, interest_type: "zero_interest", interest_rate_bps: 0, settlement_status: "active", version: 1, deleted: false, created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z" }],
      availableCreditCentavos: 10_000_000,
      creditLimitCentavos: 10_000_000,
      billingCycleDays: 31,
      asOfDate: "2026-09-15",
    });

    expect(forecast.points.slice(0, 5).map((point) => 10_000_000 - point.availableCreditCentavos)).toEqual([
      4_500_000,
      5_000_000,
      3_500_000,
      1_250_000,
      1_000_000,
    ]);
    expect(forecast.points.slice(3, 5)).toMatchObject([
      { regularPaymentCentavos: 2_000_000, amortizationPaymentCentavos: 250_000, targetCentavos: 2_250_000 },
      { regularPaymentCentavos: 0, amortizationPaymentCentavos: 250_000, targetCentavos: 250_000 },
    ]);
  });

  it("reuses a percentage of the latest statement until the balance reaches zero", () => {
    const forecast = buildCreditCardForecast({
      cycles: [
        { id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-07-05", cutoff_date: "2026-08-04", statement_date: "2026-08-04", version: 1, deleted: false, created_at: "2026-07-05T00:00:00.000Z", updated_at: "2026-07-05T00:00:00.000Z" },
        { id: "cycle-2", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: "2026-09-04", version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-08-05T00:00:00.000Z" },
      ],
      transactions: [],
      statements: [
        { id: "statement-2", user_id: "user-1", cycle_id: "cycle-2", statement_date: "2026-09-04", due_date: "2026-09-15", statement_balance_centavos: 2_000_000, minimum_due_centavos: 200_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z" },
        { id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-08-04", due_date: "2026-09-20", statement_balance_centavos: 4_000_000, minimum_due_centavos: 400_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-08-04T00:00:00.000Z", updated_at: "2026-08-04T00:00:00.000Z" },
      ],
      strategy: { accountId: "card-1", strategy: "percentage_of_statement", customAmountCentavos: null, percentageBps: 5_000, version: 1 },
      payments: [],
      installments: [],
      availableCreditCentavos: 8_000_000,
      creditLimitCentavos: 10_000_000,
      billingCycleDays: 31,
      asOfDate: "2026-09-10",
    });

    const forecastPoints = forecast.points.filter((point) => point.cycleId.startsWith("forecast"));
    expect(forecastPoints.map((point) => point.targetCentavos)).toEqual([1_000_000, 1_000_000]);
    expect(forecastPoints.map((point) => 10_000_000 - point.availableCreditCentavos)).toEqual([1_000_000, 0]);
  });

  it.each([
    ["pay_in_full", null, null],
    ["pay_minimum", null, null],
    ["percentage_of_statement", null, 5_000],
    ["custom_payment", 1_000_000, null],
  ] as const)("does not project an unpaid overdue %s statement", (strategyName, customAmountCentavos, percentageBps) => {
    const forecast = buildCreditCardForecast({
      cycles: [{ id: "cycle-1", user_id: "user-1", account_id: "card-1", cycle_start_date: "2026-08-05", cutoff_date: "2026-09-04", statement_date: "2026-09-04", version: 1, deleted: false, created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-08-05T00:00:00.000Z" }],
      transactions: [],
      statements: [{ id: "statement-1", user_id: "user-1", cycle_id: "cycle-1", statement_date: "2026-09-04", due_date: "2026-09-15", statement_balance_centavos: 3_000_000, minimum_due_centavos: 500_000, finance_charge_centavos: 0, authoritative: true, version: 1, deleted: false, created_at: "2026-09-04T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z" }],
      strategy: { accountId: "card-1", strategy: strategyName, customAmountCentavos, percentageBps, version: 1 },
      payments: [],
      installments: [],
      availableCreditCentavos: 7_000_000,
      creditLimitCentavos: 10_000_000,
      billingCycleDays: 31,
      asOfDate: "2026-09-20",
    });

    const forecastPoints = forecast.points.filter((point) => point.cycleId.startsWith("forecast"));
    expect(forecastPoints).toEqual([]);
  });
});
