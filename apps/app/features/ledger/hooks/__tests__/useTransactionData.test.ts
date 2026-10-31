import { renderHook, waitFor } from "@testing-library/react-native";
import { listFinancialAccounts } from "../../../../local-db/repositories/foundations/financialFoundations";
import { listCategories, listSubcategories } from "../../../../local-db/repositories/ledger/taxonomy";
import { useTransactionData } from "../useTransactionData";

jest.mock("../../../../local-db/repositories/foundations/financialFoundations", () => ({ listFinancialAccounts: jest.fn() }));
jest.mock("../../../../local-db/repositories/ledger/taxonomy", () => ({ listCategories: jest.fn(), listSubcategories: jest.fn() }));

const expenseSub = { id: "s-exp", kind: "expense" };
const incomeSub = { id: "s-inc", kind: "income" };

describe("useTransactionData", () => {
  beforeEach(() => {
    jest.mocked(listFinancialAccounts).mockResolvedValue([{ id: "a1" }] as never);
    jest.mocked(listCategories).mockResolvedValue([{ id: "c1" }] as never);
    jest.mocked(listSubcategories).mockImplementation(async (_userId, _categoryId, kind) => [kind === "income" ? incomeSub : expenseSub] as never);
  });

  afterEach(() => jest.clearAllMocks());

  it("switches transaction type without reloading", async () => {
    const { result, rerender } = renderHook(({ kind }: { kind: "expense" | "income" | "transfer" }) => useTransactionData("u1", kind), { initialProps: { kind: "expense" } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subcategories).toEqual([expenseSub]);

    rerender({ kind: "income" });
    expect(result.current.loading).toBe(false);
    expect(result.current.subcategories).toEqual([incomeSub]);

    rerender({ kind: "transfer" });
    expect(result.current.loading).toBe(false);
    expect(result.current.accounts).toEqual([{ id: "a1" }]);
    expect(result.current.categories).toEqual([]);
    expect(result.current.subcategories).toEqual([]);

    expect(listFinancialAccounts).toHaveBeenCalledTimes(1);
  });
});
