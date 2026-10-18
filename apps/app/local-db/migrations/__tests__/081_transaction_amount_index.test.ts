import migration from "../081_transaction_amount_index";

describe("081_transaction_amount_index", () => {
  it("indexes transactions by user and amount", async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);

    await migration.up({ execAsync } as never);

    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining("ON transactions (user_id, amount_centavos, created_at)"));
  });
});
