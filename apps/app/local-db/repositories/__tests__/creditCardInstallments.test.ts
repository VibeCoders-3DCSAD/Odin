import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();

jest.mock("../../client", () => ({
  initDatabase: (...args: any[]) => mockInitDatabase(...args),
}));

describe("credit-card installments repository", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
  });

  test("loads purchase metadata and installment details for an edited transaction", async () => {
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("FROM credit_card_transactions")) {
          return { purchase_type: "installment", installment_id: "installment-1" };
        }
        if (sql.includes("FROM credit_card_installments")) {
          return {
            id: "installment-1",
            user_id: "user-1",
            account_id: "card-1",
            transaction_id: "transaction-1",
            description: "Laptop",
            original_principal_centavos: 120000,
            remaining_principal_centavos: 70000,
            term_months: 12,
            remaining_months: 7,
            monthly_amortization_centavos: 10000,
            interest_rate_bps: 0,
            interest_type: "zero_interest",
            settlement_status: "active",
            version: 1,
            deleted: 0,
            created_at: "now",
            updated_at: "now",
          };
        }
        return null;
      }),
    };
    mockInitDatabase.mockResolvedValue(db);

    const { getCreditCardPurchaseMetadataForTransaction } = await import("../creditCardInstallments");
    const metadata = await getCreditCardPurchaseMetadataForTransaction("user-1", "transaction-1");

    expect(metadata).toMatchObject({
      purchase_type: "installment",
      installment_id: "installment-1",
      installment: {
        id: "installment-1",
        remaining_principal_centavos: 70000,
        remaining_months: 7,
        deleted: false,
      },
    });
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("FROM credit_card_installments"),
      "user-1",
      "installment-1",
      "transaction-1",
    );
  });
});
