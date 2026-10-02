import migration from "../072_debt_extra_payments";

it("adds the extra-payment setting with a disabled default", async () => {
  const execAsync = jest.fn(async () => undefined);

  await migration.up({ execAsync } as never);

  expect(execAsync).toHaveBeenCalledWith("ALTER TABLE debt_accounts ADD COLUMN allows_extra_payments integer NOT NULL DEFAULT 0");
});
