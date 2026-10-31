import { useEffect, useMemo, useRef, useState } from "react";
import { getTransactionTotals, listTransactions, type TransactionListItem, type TransactionTotals } from "../../../../local-db/repositories/ledger/ledger";
import { readTransactionCache, reuseUnchangedRows, transactionCacheKey, writeTransactionCache } from "../../transactionCache";
import { DEFAULT_SORT_BY, DEFAULT_SORT_DIR, INITIAL_RENDER_ROWS, MAX_REFRESH_ROWS, PAGE_SIZE } from "../constants";
import { groupTransactionsByDate } from "../helpers/historyFormat";
import { buildTransactionFilters, type HistoryFilterState } from "../helpers/transactionFilters";

type Options = {
  userId: string;
  filters: HistoryFilterState;
  // Scrolling the edit form must not page the hidden list.
  editing: boolean;
  // Bumped by the shell after a sync pushes or pulls changes.
  syncVersion: number;
  onLoadMoreChange?: (loadMore: (() => void) | null) => void;
};

// Loads, pages and refreshes the history rows and totals for the current filters.
export function useTransactionList({ userId, filters: filterState, editing, syncVersion, onLoadMoreChange }: Options) {
  // The page mounts with the spinner so navigating here is immediate; cached rows are painted on the next
  // frame by the first load. The filters always start at their defaults, so only those totals are restored.
  const [totals, setTotals] = useState<TransactionTotals>(() => readTransactionCache(transactionCacheKey(userId, { sort_by: DEFAULT_SORT_BY, sort_dir: DEFAULT_SORT_DIR }))?.totals ?? { income_centavos: 0, expense_centavos: 0 });
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_ROWS);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // The rows on screen belong to the previous filters while the new ones are queried.
  const [stale, setStale] = useState(false);
  // The search the rows on screen were loaded with; the typed text only counts once it is submitted.
  const [loadedSearch, setLoadedSearch] = useState("");
  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);
  // True while load() is querying; a page appended mid-refresh would be overwritten by the refreshed rows.
  const refreshingRef = useRef(false);
  const lastRowRef = useRef<TransactionListItem | null>(null);

  // inPlace refreshes the rows already on screen after an edit, delete or sync: the cache only holds the first
  // page and is older than what is shown, so it is skipped and every loaded page is re-queried.
  async function load({ inPlace = false }: { inPlace?: boolean } = {}) {
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    const filters = buildTransactionFilters(filterState, null);
    const cacheKey = transactionCacheKey(userId, filters);
    const refreshInPlace = inPlace && transactions.length > 0;
    const cached = refreshInPlace ? null : readTransactionCache(cacheKey);
    if (refreshInPlace) filters.limit = Math.min(Math.max(transactions.length, PAGE_SIZE), MAX_REFRESH_ROWS);
    // Stale-while-revalidate: paint cached rows for these filters, or keep the current rows dimmed, and only
    // fall back to the spinner when there is nothing to show. Rendering rows costs far more than the query.
    if (refreshInPlace) {
      // Same filters, so the rows on screen stay as they are until the refreshed ones arrive.
    } else if (cached) {
      setVisibleCount(INITIAL_RENDER_ROWS);
      setTransactions((current) => reuseUnchangedRows(current, cached.rows));
      setTotals(cached.totals);
      setLoadedSearch(filters.search ?? "");
      setHasMore(cached.hasMore);
      setStale(false);
      setLoading(false);
      lastRowRef.current = cached.rows[cached.rows.length - 1] ?? null;
    } else if (transactions.length > 0) {
      setStale(true);
    } else {
      setLoading(true);
      setHasMore(false);
      lastRowRef.current = null;
    }
    refreshingRef.current = true;
    try {
      // Totals cover every matching row, not just the pages loaded so far.
      const [rows, nextTotals] = await Promise.all([
        listTransactions(userId, filters),
        getTransactionTotals(userId, filters),
      ]);
      if (requestId.current !== currentRequestId) return;
      const nextHasMore = rows.length === filters.limit;
      // A list replacing a spinner or another filter's rows renders in two steps too.
      if (!cached && !refreshInPlace) setVisibleCount(INITIAL_RENDER_ROWS);
      setTransactions((current) => reuseUnchangedRows(current, rows));
      setTotals(nextTotals);
      setLoadedSearch(filters.search ?? "");
      setHasMore(nextHasMore);
      lastRowRef.current = rows[rows.length - 1] ?? null;
      writeTransactionCache(cacheKey, { rows, totals: nextTotals, hasMore: nextHasMore });
    } catch {
      // A failed refresh keeps cached or current rows, but never leaves another filter's rows on screen.
      if (requestId.current !== currentRequestId || cached || refreshInPlace) return;
      setTransactions([]);
      setTotals({ income_centavos: 0, expense_centavos: 0 });
      setHasMore(false);
    } finally {
      if (requestId.current === currentRequestId) {
        refreshingRef.current = false;
        setStale(false);
        setLoading(false);
      }
    }
  }

  const { typeFilter, categoryFilter, sortBy, sortDir, dateRange, customFromDate, customToDate } = filterState;
  const firstLoadRef = useRef(true);
  useEffect(() => {
    // Wait one frame on mount so the page and spinner are shown before any rows render.
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      const frame = requestAnimationFrame(() => { load(); });
      return () => {
        cancelAnimationFrame(frame);
        firstLoadRef.current = true;
      };
    }
    load();
  }, [typeFilter, categoryFilter, sortBy, sortDir, dateRange, customFromDate, customToDate]);

  useEffect(() => {
    if (visibleCount >= transactions.length) return;
    const frame = requestAnimationFrame(() => setVisibleCount(transactions.length));
    return () => cancelAnimationFrame(frame);
  }, [visibleCount, transactions.length]);

  const seenSyncVersion = useRef(syncVersion);
  useEffect(() => {
    if (seenSyncVersion.current === syncVersion) return;
    seenSyncVersion.current = syncVersion;
    load({ inPlace: true });
  }, [syncVersion]);

  function loadMore() {
    if (editing || loading || !hasMore || loadingMoreRef.current || refreshingRef.current) return;
    const currentRequestId = requestId.current;
    const after = lastRowRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    listTransactions(userId, buildTransactionFilters(filterState, after))
      .then((rows) => {
        if (requestId.current !== currentRequestId) return;
        if (rows.length > 0) lastRowRef.current = rows[rows.length - 1]!;
        const nextHasMore = rows.length === PAGE_SIZE;
        setTransactions((current) => [...current, ...rows]);
        setHasMore(nextHasMore);
      })
      .catch(() => {})
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }

  useEffect(() => {
    onLoadMoreChange?.(loadMore);
    return () => onLoadMoreChange?.(null);
  }, [onLoadMoreChange, loadMore]);

  // Drops a deleted row before the in-place refresh corrects the totals and fills the gap.
  function removeTransaction(transactionId: string) {
    setTransactions((current) => current.filter((row) => row.id !== transactionId));
  }

  const grouped = useMemo(() => groupTransactionsByDate(transactions.slice(0, visibleCount)), [transactions, visibleCount]);

  return { transactions, grouped, totals, loading, loadingMore, stale, loadedSearch, load, removeTransaction };
}
