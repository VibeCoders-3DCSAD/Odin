import { prepareOperation } from "../../services/syncApplyOperation.js";

function nextMonthPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  return {
    start: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
  };
}

function financialPlanOperation() {
  const period = nextMonthPeriod();
  return {
    operation_id: "operation-1", entity: "financial_plans", record_id: "plan-1", operation_type: "create" as const,
    base_version: null, changed_fields: [],
    payload: {
      period_start: period.start, period_end: period.end, status: "accepted",
      input_snapshot: { forecast: { version: "v1" }, restrictions: { version: "v1" }, obligations: { items: [] }, debtRequirements: { items: [] }, savingsRequirements: { items: [] }, classification: { version: "v2" } },
      recommendation: { allocations: [], debtReservations: [], savingsReservations: [] },
    },
  };
}

describe("Financial Plan sync payload", () => {
  it("accepts a complete, next-month immutable plan document", async () => {
    const operation = financialPlanOperation();
    await expect(prepareOperation({} as never, "user-1", operation)).resolves.toMatchObject({ payload: operation.payload });
  });

  it("rejects plans outside the next calendar month", async () => {
    const operation = financialPlanOperation();
    await expect(prepareOperation({} as never, "user-1", { ...operation, payload: { ...operation.payload, period_start: "2020-01-01", period_end: "2020-01-31" } })).rejects.toThrow("Financial Plans can only cover the next calendar month");
  });

  it("rejects an incomplete immutable input snapshot", async () => {
    const operation = financialPlanOperation();
    await expect(prepareOperation({} as never, "user-1", { ...operation, payload: { ...operation.payload, input_snapshot: {} } })).rejects.toThrow("input_snapshot.forecast must contain plan input data");
  });

  it("rejects updates because accepted plans are immutable", async () => {
    const operation = financialPlanOperation();
    await expect(prepareOperation({} as never, "user-1", { ...operation, operation_type: "update", base_version: 1, changed_fields: ["status"], payload: { status: "edited" } })).rejects.toThrow("accepted Financial Plans are immutable");
  });
});
