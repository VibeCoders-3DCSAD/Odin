import { CACHED_ROW_LIMIT, clearTransactionCache, readTransactionCache, reuseUnchangedRows, transactionCacheKey, writeTransactionCache } from "../transactionCache";
import type { TransactionListItem } from "../../../local-db/repositories/ledger/ledger";

function row(index: number, overrides: Partial<TransactionListItem> = {}): TransactionListItem {
  return {
    id: `tx-${index}`,
    name: `Purchase ${index}`,
    transaction_type: "expense",
    transaction_date: "2026-10-01",
    amount_centavos: 1_000,
    category_label: null,
    financial_account_name: null,
    icon_key: null,
    color_hex: null,
    created_at: "2026-10-01T00:00:00Z",
    row_id: index,
    ...overrides,
  } as TransactionListItem;
}

const totals = { income_centavos: 0, expense_centavos: 0 };

describe("transactionCache", () => {
  beforeEach(() => clearTransactionCache());

  it("keys by user and filters but not by the page cursor", () => {
    const filters = { sort_by: "transaction_date", sort_dir: "desc" };
    expect(transactionCacheKey("user-1", { ...filters, limit: 25, after: row(1) })).toBe(transactionCacheKey("user-1", filters));
    expect(transactionCacheKey("user-2", filters)).not.toBe(transactionCacheKey("user-1", filters));
    expect(transactionCacheKey("user-1", { ...filters, transaction_type: "expense" })).not.toBe(transactionCacheKey("user-1", filters));
  });

  it("keeps only the first page so a restore never renders every scrolled page", () => {
    const rows = Array.from({ length: CACHED_ROW_LIMIT * 3 }, (_, index) => row(index));
    writeTransactionCache("key", { rows, totals, hasMore: false });

    const cached = readTransactionCache("key")!;
    expect(cached.rows).toHaveLength(CACHED_ROW_LIMIT);
    expect(cached.hasMore).toBe(true);
  });

  it("evicts the least recently used filter set", () => {
    for (let index = 0; index < 8; index++) writeTransactionCache(`key-${index}`, { rows: [], totals, hasMore: false });
    readTransactionCache("key-0");
    writeTransactionCache("key-8", { rows: [], totals, hasMore: false });

    expect(readTransactionCache("key-0")).not.toBeNull();
    expect(readTransactionCache("key-1")).toBeNull();
  });

  it("returns the previous object for unchanged rows so memoized rows skip re-rendering", () => {
    const previous = [row(1), row(2)];
    const next = reuseUnchangedRows(previous, [row(0), row(1), row(2, { amount_centavos: 5_000 })]);

    expect(next[1]).toBe(previous[0]);
    expect(next[2]).not.toBe(previous[1]);
    expect(next[2]!.amount_centavos).toBe(5_000);
  });
});
