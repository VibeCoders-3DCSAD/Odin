import migration from "../076_anomaly_recurring_confirmation";

it("adds a nullable recurring-confirmation timestamp to evaluations", async () => {
  const execAsync = jest.fn(async () => undefined);

  await migration.up({ execAsync } as never);

  expect(execAsync).toHaveBeenCalledWith("ALTER TABLE anomaly_evaluations ADD COLUMN confirmed_recurring_at text");
});
