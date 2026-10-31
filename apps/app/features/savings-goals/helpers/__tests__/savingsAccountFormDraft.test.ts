import { newSavingsFormDraft, validateSavingsFormDraft } from "../savingsAccountFormDraft";

const shared = { name: "Savings", institution: "", balance: "150000", notes: "" };
const today = "2026-10-18";

describe("Savings form review validation", () => {
  it("requires boost details only when enabled for HYSA", () => {
    const draft = { ...newSavingsFormDraft("hysa"), annualRate: "3", boosted: true };
    expect(validateSavingsFormDraft("hysa", shared, draft, today)).toMatchObject({ boostedRate: expect.any(String), eligibleBalance: expect.any(String), boostStart: expect.any(String), boostEnd: expect.any(String) });
    expect(validateSavingsFormDraft("hysa", shared, { ...draft, boosted: false }, today)).toEqual({});
    expect(validateSavingsFormDraft("traditional", shared, draft, today)).toEqual({});
    expect(validateSavingsFormDraft("hysa", shared, { ...draft, boostedRate: "15", eligibleBalance: "100000", boostStart: "2026-10-01", boostEnd: "2026-10-31" }, today)).toEqual({});
  });

  it("ignores hidden contributions and goals for Time Deposit", () => {
    const draft = { ...newSavingsFormDraft("time_deposit"), annualRate: "5", startDate: "2026-10-01", maturityDate: "2027-04-01", frequency: "weekly", hasGoal: true };
    expect(validateSavingsFormDraft("time_deposit", shared, draft, today)).toEqual({});
    expect(validateSavingsFormDraft("time_deposit", shared, { ...draft, maturityDate: "2026-09-01" }, today)).toHaveProperty("maturityDate");
  });

  it("requires a weekday for weekly contributions and rejects impossible goal dates", () => {
    const draft = { ...newSavingsFormDraft("traditional"), annualRate: "0", frequency: "weekly", contribution: "500", hasGoal: true, target: "200000", targetDate: "2027-02-30" };
    expect(validateSavingsFormDraft("traditional", shared, draft, today)).toMatchObject({ schedule: expect.any(String), targetDate: expect.any(String) });
    expect(validateSavingsFormDraft("traditional", shared, { ...draft, weekday: 0, targetDate: "2027-02-28" }, today)).toEqual({});
  });
});
