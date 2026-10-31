import type { TransactionFilters, TransactionListItem, TransactionTotals } from "../../local-db/repositories/ledger/ledger";

// Stale-while-revalidate cache for the transaction list. The page unmounts whenever the user leaves it, and
// rendering rows is the slow part, so every visit and filter change paints the last result for that filter
// straight away while SQLite is re-queried. The re-query always runs, so edits made elsewhere (new
// transactions, sync pulls, auto-posted payments) still replace the cached rows.
export type CachedTransactions = {
  rows: TransactionListItem[];
  totals: TransactionTotals;
  hasMore: boolean;
};

// Only the first page is kept: restoring every page the user had scrolled through blocks the JS thread
// while they all render, and later pages are cheap to fetch again on scroll.
export const CACHED_ROW_LIMIT = 25;
const MAX_ENTRIES = 8;

// Map iteration order is insertion order, so re-inserting on access keeps the oldest entry first.
const cache = new Map<string, CachedTransactions>();

export function transactionCacheKey(userId: string, filters: TransactionFilters): string {
  const { after: _after, limit: _limit, offset: _offset, ...query } = filters;
  return JSON.stringify([userId, query]);
}

export function readTransactionCache(key: string): CachedTransactions | null {
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

export function writeTransactionCache(key: string, entry: CachedTransactions) {
  cache.delete(key);
  cache.set(key, entry.rows.length > CACHED_ROW_LIMIT ? { ...entry, rows: entry.rows.slice(0, CACHED_ROW_LIMIT), hasMore: true } : entry);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
}

export function clearTransactionCache() {
  cache.clear();
}

// Rows are memoized, so handing back the previous object for an unchanged row lets a refresh that finds
// nothing new skip re-rendering it.
export function reuseUnchangedRows(previous: TransactionListItem[], next: TransactionListItem[]): TransactionListItem[] {
  if (previous.length === 0) return next;
  const byId = new Map(previous.map((row) => [row.id, row]));
  return next.map((row) => {
    const old = byId.get(row.id);
    if (!old) return row;
    for (const key of Object.keys(row) as (keyof TransactionListItem)[]) {
      if (old[key] !== row[key]) return row;
    }
    return old;
  });
}
