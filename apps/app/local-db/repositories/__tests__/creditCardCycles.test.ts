import {
  calculateCurrentCreditCardCycle,
  calculateSuccessorCreditCardCycle,
  validateCreditCardCycleDates,
} from "../creditCardCycleDates";

describe("credit-card cycle dates", () => {
  it("clamps day 31 and rolls the statement into the next month", () => {
    expect(calculateCurrentCreditCardCycle({ account_id: "card-1", cutoff_day: 31 }, "2024-02-10")).toEqual({
      account_id: "card-1",
      cycle_start_date: "2024-02-01",
      cutoff_date: "2024-02-29",
      statement_date: null,
    });
  });

  it("starts the current cycle on the day after the previous effective cutoff", () => {
    expect(calculateCurrentCreditCardCycle({ account_id: "card-1", cutoff_day: 15 }, "2024-03-15")).toMatchObject({
      cycle_start_date: "2024-02-16",
      cutoff_date: "2024-03-15",
      statement_date: null,
    });
  });

  it("accepts numeric cutoff values returned as SQLite strings", () => {
    expect(calculateCurrentCreditCardCycle({ account_id: "card-1", cutoff_day: "30" }, "2024-04-10")).toMatchObject({
      cutoff_date: "2024-04-30",
      statement_date: null,
    });
  });

  it("accepts a cycle without a statement yet", () => {
    expect(() => validateCreditCardCycleDates({
      cycle_start_date: "2024-01-16",
      cutoff_date: "2024-02-15",
    })).not.toThrow();
  });

  it("rejects a statement before the cutoff", () => {
    expect(() => validateCreditCardCycleDates({
      cycle_start_date: "2024-01-16",
      cutoff_date: "2024-02-15",
      statement_date: "2024-02-14",
    })).toThrow("statement_date must be on or after cutoff_date");
  });

  it("starts an overridden cycle successor on the day after the cutoff", () => {
    expect(calculateSuccessorCreditCardCycle("2026-09-05", 30)).toEqual({
      cycle_start_date: "2026-09-06",
      cutoff_date: "2026-10-05",
    });
  });
});
