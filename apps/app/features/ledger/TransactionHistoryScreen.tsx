import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { ArrowDownLeft, ArrowsLeftRight, ArrowUpRight, CalendarCheck, Funnel, MagnifyingGlass } from "phosphor-react-native";
import { listTransactions, getTransaction, getTransactionTotals, deleteTransaction, type TransactionFilters, type TransactionListItem, type TransactionTotals } from "../../local-db/repositories/ledger";
import { readTransactionCache, reuseUnchangedRows, transactionCacheKey, writeTransactionCache } from "./transactionCache";
import { getCreditCardPurchaseMetadataForTransaction } from "../../local-db/repositories/creditCardInstallments";
import { listCategories, type Category } from "../../local-db/repositories/taxonomy";
import { runSync } from "../../local-db/sync/runSync";
import { useToast } from "../../components/Toast";
import KebabTooltip from "../../components/KebabTooltip";
import NewTransactionScreen from "./NewTransactionScreen";
import type { Transaction } from "../../local-db/repositories/ledger";
import { answerUnusualSpending, type SpendingRecurrence, type UnusualSpendingInsight } from "../../local-db/repositories/unusualSpending";
import RecurrenceQuestion from "../alerts/RecurrenceQuestion";
import { BottomSheetSurface } from "../../components/BottomSheetSurface";
import { ActionSheet } from "../../components/ActionSheet";
import { DEFAULT_TAXONOMY_COLOR, TaxonomyIcon } from "../taxonomy/taxonomyVisuals";
import { dashboardColors as P } from "../dashboard/dashboardAppearance";
import { formatPhp } from "../../lib/format/money";

const budgieThink = require("../../assets/budgie-think.png");

const AMOUNT_COLORS: Record<string, string> = {
  income: P.green,
  expense: P.error,
};
// Selected WHEN chip fill.
const CHIP_ON = "#41EDA4";

const SORT_OPTIONS = [
  { by: "transaction_date", dir: "desc", label: "Newest first", hint: "The default" },
  { by: "transaction_date", dir: "asc", label: "Oldest first" },
  { by: "amount_centavos", dir: "desc", label: "Largest amount" },
  { by: "amount_centavos", dir: "asc", label: "Smallest amount" },
] as const;

const FILTER_TYPES = [
  { key: "all", label: "Everything" },
  { key: "income", label: "Income" },
  { key: "expense", label: "Expenses" },
  { key: "transfer", label: "Transfers" },
] as const;

const sectionLabel = {
  fontFamily: "Manrope", fontWeight: "700", fontSize: 11, letterSpacing: 0.6, color: P.secondary,
} as const;

const DATE_RANGES = ["all", "week", "month", "year", "custom"] as const;

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  unusualSpending: UnusualSpendingInsight | null;
  onUnusualSpendingDismissed: () => void;
  onNewTransaction: () => void;
  onLoadMoreChange?: (loadMore: (() => void) | null) => void;
  // The shell owns the scroll view; these let the list return to where it was after an edit.
  getScrollOffset?: () => number;
  scrollTo?: (y: number) => void;
  // Bumped by the shell after a sync pushes or pulls changes.
  syncVersion?: number;
  // Lets the shell hide its top bar and tabs while the edit form is open, like the full-screen new transaction page.
  onEditingChange?: (editing: boolean) => void;
};

const PAGE_SIZE = 25;
// Enough rows to fill the screen; the rest render a frame later so a new list paints quickly.
const INITIAL_RENDER_ROWS = 10;
// listTransactions caps a page at 200 rows.
const MAX_REFRESH_ROWS = 200;
const DEFAULT_SORT_BY = "transaction_date";
const DEFAULT_SORT_DIR = "desc";

// toLocaleString builds a new formatter on every call, which is slow on Hermes.
const amountFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

function formatAmount(centavos: number): string {
  return amountFormat.format(centavos / 100);
}

// Uncategorized rows get a tile by kind: scheduled payment, transfer, income or expense.
function FallbackTileIcon({ tx }: { tx: TransactionListItem }) {
  if (tx.is_scheduled_payment) return <CalendarCheck size={18} color="#fff" weight="bold" />;
  if (tx.transaction_type === "transfer") return <ArrowsLeftRight size={18} color="#fff" weight="bold" />;
  if (tx.transaction_type === "income") return <ArrowUpRight size={18} color="#fff" weight="bold" />;
  return <ArrowDownLeft size={18} color="#fff" weight="bold" />;
}

function fallbackTileColor(tx: TransactionListItem): string {
  if (tx.is_scheduled_payment) return P.warning;
  if (tx.transaction_type === "transfer") return P.secondary;
  if (tx.transaction_type === "income") return P.green;
  return P.error;
}

const TransactionRow = memo(function TransactionRow({ tx, last, onEdit, onDelete }: {
  tx: TransactionListItem;
  last: boolean;
  onEdit: (transactionId: string) => void;
  onDelete: (transactionId: string) => void;
}) {
  const prefix = tx.transaction_type === "expense" ? "-" : tx.transaction_type === "income" ? "+" : "";
  return (
    <View style={{ paddingVertical: 12, paddingLeft: 14, paddingRight: 6, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: P.divider }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tx.icon_key ? tx.color_hex ?? DEFAULT_TAXONOMY_COLOR : fallbackTileColor(tx), alignItems: "center", justifyContent: "center" }}>
        {tx.icon_key ? <TaxonomyIcon iconKey={tx.icon_key} size={18} color="#fff" weight="fill" /> : <FallbackTileIcon tx={tx} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: P.ink }} numberOfLines={1}>
          {tx.name}
        </Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.secondary, marginTop: 1 }} numberOfLines={1}>
          {[tx.category_label, tx.financial_account_name].filter(Boolean).join(" · ") || "Uncategorized"}
        </Text>
      </View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12.5, color: AMOUNT_COLORS[tx.transaction_type] ?? P.ink, fontVariant: ["tabular-nums"] }}>
        {prefix}PHP {formatAmount(tx.amount_centavos)}
      </Text>
      <KebabTooltip onEdit={() => onEdit(tx.id)} onDelete={() => onDelete(tx.id)} />
    </View>
  );
});

function StatCard({ kind, centavos }: { kind: "income" | "expense"; centavos: number }) {
  const income = kind === "income";
  return (
    <View style={{ flex: 1, borderRadius: 12, padding: 14, backgroundColor: income ? P.mint : P.pink }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: income ? P.green : P.expenseIcon, alignItems: "center", justifyContent: "center" }}>
          {income ? <ArrowUpRight size={13} color="#fff" weight="bold" /> : <ArrowDownLeft size={13} color="#fff" weight="bold" />}
        </View>
        <Text style={sectionLabel}>{income ? "INCOME" : "EXPENSES"}</Text>
      </View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 19, letterSpacing: -0.2, color: P.ink, fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
        <Text style={{ fontWeight: "600", fontSize: 11, color: P.secondary }}>PHP </Text>
        {formatAmount(centavos)}
      </Text>
    </View>
  );
}

function Radio({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 11, minHeight: 44, paddingVertical: 6 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? P.brand : P.border, alignItems: "center", justifyContent: "center", backgroundColor: P.surface }}>
        {selected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: P.brand }} /> : null}
      </View>
      <View>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: P.ink }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.secondary, marginTop: 1 }}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: selected ? P.brand : P.border, backgroundColor: selected ? CHIP_ON : P.surface }}
    >
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: selected ? P.brand : P.secondary }}>{label}</Text>
    </Pressable>
  );
}

export default function TransactionHistoryScreen({ userId, deviceId, accessToken, unusualSpending, onUnusualSpendingDismissed, onNewTransaction, onLoadMoreChange, getScrollOffset, scrollTo, syncVersion = 0, onEditingChange }: Props) {
  const { showToast } = useToast();
  const { height: windowHeight } = useWindowDimensions();

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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  // The search the rows on screen were loaded with; the typed text only counts once it is submitted.
  const [loadedSearch, setLoadedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<string>(DEFAULT_SORT_DIR);
  const [dateRange, setDateRange] = useState<string>("all");
  const [customFromDate, setCustomFromDate] = useState<string | null>(null);
  const [customToDate, setCustomToDate] = useState<string | null>(null);
  const [datePickerField, setDatePickerField] = useState<"from" | "to" | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteBlockedTarget, setDeleteBlockedTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUnusualSpending, setShowUnusualSpending] = useState(false);
  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);
  // True while load() is querying; a page appended mid-refresh would be overwritten by the refreshed rows.
  const refreshingRef = useRef(false);
  const lastRowRef = useRef<TransactionListItem | null>(null);

  function getFilters(after: TransactionListItem | null): TransactionFilters {
    const filters: TransactionFilters = {
      sort_by: sortBy,
      sort_dir: sortDir,
      limit: PAGE_SIZE,
    };
    if (after) filters.after = after;
    if (typeFilter !== "all") filters.transaction_type = typeFilter;
    if (categoryFilter !== "all") filters.category_id = categoryFilter;
    if (search.trim()) filters.search = search.trim();
    if (dateRange === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      filters.from_date = d.toISOString().split("T")[0]!;
    } else if (dateRange === "month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      filters.from_date = d.toISOString().split("T")[0]!;
    } else if (dateRange === "year") {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      filters.from_date = d.toISOString().split("T")[0]!;
    } else if (dateRange === "custom" && customFromDate && customToDate) {
      filters.from_date = customFromDate;
      filters.to_date = customToDate;
    }
    return filters;
  }

  // inPlace refreshes the rows already on screen after an edit, delete or sync: the cache only holds the first
  // page and is older than what is shown, so it is skipped and every loaded page is re-queried.
  async function load({ inPlace = false }: { inPlace?: boolean } = {}) {
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    const filters = getFilters(null);
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

  const editing = editTarget !== null;
  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);

  const seenSyncVersion = useRef(syncVersion);
  useEffect(() => {
    if (seenSyncVersion.current === syncVersion) return;
    seenSyncVersion.current = syncVersion;
    load({ inPlace: true });
  }, [syncVersion]);

  useEffect(() => {
    if (!loading && unusualSpending) setShowUnusualSpending(true);
  }, [loading, unusualSpending]);

  useEffect(() => {
    let active = true;
    listCategories(userId)
      .then((rows) => { if (active) setCategories(rows); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [userId]);

  function loadMore() {
    // Scrolling the edit form must not page the hidden list.
    if (editTarget || loading || !hasMore || loadingMoreRef.current || refreshingRef.current) return;
    const currentRequestId = requestId.current;
    const after = lastRowRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    listTransactions(userId, getFilters(after))
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

  const listScrollY = useRef<number | null>(null);
  // Stable so memoized rows skip re-rendering on unrelated state changes like search typing.
  const editTransaction = useCallback((transactionId: string) => {
    if (transactions.some((transaction) => transaction.id === transactionId && transaction.is_scheduled_payment)) {
      showToast("This transaction pays a biller or remittance. Delete it and record the payment again.", "danger");
      return;
    }
    getTransaction(userId, transactionId)
      .then((transaction) => {
        if (!transaction) {
          showToast("Transaction not found", "danger");
          return;
        }
        listScrollY.current = getScrollOffset?.() ?? null;
        setEditTarget(transaction);
      })
      .catch(() => showToast("Could not open transaction", "danger"));
  }, [userId, showToast, getScrollOffset, transactions]);

  const selectDeleteTarget = useCallback((transactionId: string) => {
    getTransaction(userId, transactionId)
      .then((transaction) => {
        if (!transaction) {
          showToast("Transaction not found", "danger");
          return;
        }
        return requestDelete(transaction);
      })
      .catch(() => showToast("Could not open transaction", "danger"));
  }, [userId, showToast]);

  async function requestDelete(transaction: Transaction) {
    if (transaction.transaction_type === "expense" && transaction.source_account_id) {
      try {
        const metadata = await getCreditCardPurchaseMetadataForTransaction(userId, transaction.id);
        if (metadata?.purchase_type === "installment") {
          setDeleteBlockedTarget(transaction);
          return;
        }
      } catch {
        setDeleteBlockedTarget(transaction);
        return;
      }
    }
    setDeleteTarget(transaction);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTransaction(userId, deviceId, deleteTarget.id);
      showToast("Transaction deleted", "success");
      runSync(userId, deviceId, accessToken).catch(() => {});
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      // Drop the row now; the in-place refresh then corrects the totals and fills the gap.
      setTransactions((current) => current.filter((row) => row.id !== deletedId));
      load({ inPlace: true });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "danger");
    } finally {
      setDeleting(false);
    }
  }

  const grouped = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const todayKey = today.toDateString();
    const yesterdayKey = yesterday.toDateString();
    const groups: { key: string; date: string; items: TransactionListItem[] }[] = [];
    for (const tx of transactions.slice(0, visibleCount)) {
      const last = groups[groups.length - 1];
      // Rows arrive grouped by date, so only the first row of each day is formatted.
      if (last && last.key === tx.transaction_date) {
        last.items.push(tx);
        continue;
      }
      const d = new Date(tx.transaction_date + "T00:00:00+08:00");
      const dateKey = d.toDateString();
      const dateLabel = dateKey === todayKey ? "Today" : dateKey === yesterdayKey ? "Yesterday" : dateFormat.format(d);
      if (last && last.date === dateLabel) {
        last.key = tx.transaction_date;
        last.items.push(tx);
      } else {
        groups.push({ key: tx.transaction_date, date: dateLabel, items: [tx] });
      }
    }
    return groups;
  }, [transactions, visibleCount]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "all") count++;
    if (categoryFilter !== "all") count++;
    if (dateRange !== "all" && (dateRange !== "custom" || (customFromDate && customToDate))) count++;
    if (sortBy !== "transaction_date" || sortDir !== "desc") count++;
    return count;
  }, [typeFilter, categoryFilter, dateRange, customFromDate, customToDate, sortBy, sortDir]);

  function formatIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function selectCustomDate(field: "from" | "to", date?: Date) {
    setDatePickerField(null);
    if (!date) return;
    if (field === "from") setCustomFromDate(formatIsoDate(date));
    else setCustomToDate(formatIsoDate(date));
  }

  // RecurrenceQuestion shows the error when saving fails.
  async function answerUnusualSpendingRecurrence(recurrence: SpendingRecurrence, months?: number[]): Promise<void> {
    if (!unusualSpending) return;
    await answerUnusualSpending(userId, deviceId, unusualSpending.transactionId, recurrence, months);
    dismissUnusualSpending();
  }

  function dismissUnusualSpending(): void {
    setShowUnusualSpending(false);
    onUnusualSpendingDismissed();
  }

  const filtered = activeFilterCount > 0 || loadedSearch.length > 0;

  // The list stays mounted, hidden, while a transaction is edited: remounting every loaded row on return
  // blocks the JS thread for seconds, whereas a mounted list only re-renders the rows the edit changed.
  return (
    <>
    {editTarget ? (
      // The form brings its own side padding; this cancels the shell's 20px content gutter so it is not doubled.
      <View style={{ marginHorizontal: -20 }}>
        <NewTransactionScreen
          transaction={editTarget}
          userId={userId}
          deviceId={deviceId}
          accessToken={accessToken}
          onClose={() => { setEditTarget(null); load({ inPlace: true }); }}
        />
      </View>
    ) : null}
    <View
      style={{ gap: 11, paddingTop: 6, display: editTarget ? "none" : "flex" }}
      onLayout={() => {
        // The edit form shares the shell's scroll view, so the list's offset is restored once it is laid out again;
        // any earlier and the scroll view is still only as tall as the form.
        if (editTarget || listScrollY.current === null) return;
        scrollTo?.(listScrollY.current);
        listScrollY.current = null;
      }}
    >
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, letterSpacing: -0.3, color: P.ink, marginBottom: 2 }}>
        Activity
      </Text>

      {/* Search and the filters button share one card */}
      <View style={{ backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 15, gap: 9 }}>
        <View style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 }}>
          <MagnifyingGlass size={16} color={P.secondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load()}
            returnKeyType="search"
            accessibilityLabel="Search transactions"
            placeholder="Search transactions..."
            placeholderTextColor={P.secondary}
            style={{ flex: 1, minHeight: 46, fontFamily: "Manrope", fontSize: 13.5, color: P.ink }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowFilters(true)}
          style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Funnel size={17} color={P.ink} />
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>
            Filters and sort{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
          </Text>
        </Pressable>
      </View>

      {/* The totals wait for the rows rather than printing a zero that is about to change. A type filter shows only its own total. */}
      {loading ? null : (
        <View style={{ flexDirection: "row", gap: 12, opacity: stale ? 0.5 : 1 }}>
          {typeFilter !== "expense" ? <StatCard kind="income" centavos={totals.income_centavos} /> : null}
          {typeFilter !== "income" ? <StatCard kind="expense" centavos={totals.expense_centavos} /> : null}
        </View>
      )}

      {/* Transaction list */}
      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 }}>
          <ActivityIndicator color={P.secondary} size="small" />
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.secondary }}>Loading...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 26, paddingHorizontal: 18 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderStyle: "dashed", borderColor: P.secondary, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            {filtered ? <Funnel size={34} color={P.secondary} /> : <ArrowsLeftRight size={34} color={P.secondary} />}
          </View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: P.ink, marginBottom: 4 }}>
            {filtered ? "No transactions match" : "No transactions yet"}
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, lineHeight: 18, color: P.secondary, textAlign: "center", maxWidth: 230 }}>
            {filtered ? "Clear the filters to see all your transactions." : "Record your first transaction to see it here."}
          </Text>
          {filtered ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={onNewTransaction}
              style={{ alignSelf: "stretch", minHeight: 50, borderRadius: 12, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", marginTop: 14 }}
            >
              <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
                Add your first
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ opacity: stale ? 0.5 : 1, gap: 11 }}>
        {stale ? <ActivityIndicator color={P.brand} /> : null}
        {grouped.map((group) => (
          <View key={`${group.date}-${group.items[0]!.id}`} style={{ gap: 8 }}>
            <Text style={sectionLabel}>
              {group.date.toUpperCase()}
            </Text>
            <View style={{ backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 16, overflow: "hidden" }}>
              {group.items.map((tx, index) => (
                <TransactionRow key={tx.id} tx={tx} last={index === group.items.length - 1} onEdit={editTransaction} onDelete={selectDeleteTarget} />
              ))}
            </View>
          </View>
        ))}
        </View>
      )}
      {loadingMore ? <ActivityIndicator color={P.brand} style={{ marginVertical: 16 }} /> : null}

      {/* Filter bottom drawer */}
      <ActionSheet visible={showFilters} onClose={() => setShowFilters(false)} backdropColor="rgba(0,0,0,0.45)">
          <BottomSheetSurface
            bottomSpacing={26}
            style={{
              backgroundColor: P.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
              paddingTop: 10, paddingHorizontal: 20,
            }}
          >
            <View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: P.divider, alignSelf: "center", marginBottom: 12 }} />

            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink, marginBottom: 6 }}>
              Filters and sort
            </Text>

            {/* Capping the scroll area itself, not the sheet: a capped sheet with a shrinking child left a blank the size of its bottom padding under the buttons. */}
            <ScrollView style={{ maxHeight: Math.round(windowHeight * 0.62) }} contentContainerStyle={{ gap: 11, paddingBottom: 14 }} showsVerticalScrollIndicator={false}>
            <Text style={sectionLabel}>SHOW</Text>
            <View>
              {FILTER_TYPES.map((t) => (
                <Radio key={t.key} label={t.label} selected={typeFilter === t.key} onPress={() => setTypeFilter(t.key)} />
              ))}
            </View>

            <Text style={sectionLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
              <Chip label="All categories" selected={categoryFilter === "all"} onPress={() => setCategoryFilter("all")} />
              {categories.map((category) => (
                <Chip key={category.id} label={category.label} selected={categoryFilter === category.id} onPress={() => setCategoryFilter(category.id)} />
              ))}
            </ScrollView>

            <Text style={sectionLabel}>WHEN</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {DATE_RANGES.map((r) => (
                <Chip
                  key={r}
                  label={r === "all" ? "Any time" : r === "week" ? "This week" : r === "month" ? "This month" : r === "year" ? "This year" : "Custom"}
                  selected={dateRange === r}
                  onPress={() => setDateRange(r)}
                />
              ))}
            </View>
            {dateRange === "custom" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["from", "to"] as const).map((field) => {
                  const value = field === "from" ? customFromDate : customToDate;
                  return (
                    <Pressable
                      key={field}
                      onPress={() => setDatePickerField(field)}
                      style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface, justifyContent: "center", paddingHorizontal: 14 }}
                    >
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11.5, color: P.secondary }}>{field === "from" ? "From" : "To"}</Text>
                      <Text style={{ fontFamily: "Manrope", fontSize: 13.5, color: value ? P.ink : P.secondary, marginTop: 2 }}>{value ?? "Select date"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {datePickerField ? (
              <DateTimePicker
                value={new Date(`${(datePickerField === "from" ? customFromDate : customToDate) ?? formatIsoDate(new Date())}T12:00:00`)}
                mode="date"
                onChange={(_event, date) => selectCustomDate(datePickerField, date)}
              />
            ) : null}

            <Text style={sectionLabel}>SORT BY</Text>
            <View>
              {SORT_OPTIONS.map((opt) => (
                <Radio
                  key={`${opt.by}-${opt.dir}`}
                  label={opt.label}
                  hint={"hint" in opt ? opt.hint : undefined}
                  selected={sortBy === opt.by && sortDir === opt.dir}
                  onPress={() => { setSortBy(opt.by); setSortDir(opt.dir); }}
                />
              ))}
            </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => {
                  setTypeFilter("all");
                  setCategoryFilter("all");
                  setDateRange("all");
                  setCustomFromDate(null);
                  setCustomToDate(null);
                  setSortBy("transaction_date");
                  setSortDir("desc");
                }}
                style={{
                  flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>
                  Reset
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (dateRange === "custom" && (!customFromDate || !customToDate)) {
                    showToast("Choose both a start and end date", "danger");
                    return;
                  }
                  if (customFromDate && customToDate && customFromDate > customToDate) {
                    showToast("Start date must be before end date", "danger");
                    return;
                  }
                  setShowFilters(false);
                }}
                style={{
                  flex: 1, minHeight: 50, borderRadius: 12, backgroundColor: P.brand,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
                  Apply
                </Text>
              </Pressable>
            </View>
          </BottomSheetSurface>
      </ActionSheet>

      {/* Delete confirmation modal */}
      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ borderRadius: 20, backgroundColor: P.surface, padding: 20 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
              Delete transaction?
            </Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: P.secondary, marginTop: 8 }}>
              This will reverse any balance changes. The transaction will remain as a tombstone record and stay syncable.
            </Text>
            <View style={{ gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={{ minHeight: 50, borderRadius: 12, backgroundColor: P.error, alignItems: "center", justifyContent: "center" }}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
                    Delete
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: P.border, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Installment delete restriction modal */}
      <Modal visible={deleteBlockedTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteBlockedTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ borderRadius: 20, backgroundColor: P.surface, padding: 20 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
              Cannot delete installment purchase
            </Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: P.secondary, marginTop: 8 }}>
              Installment transactions cannot be deleted after creation because billing-cycle amortizations, issuer statement values, and available-credit holds may already depend on them.
            </Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: P.secondary, marginTop: 8 }}>
              Record an issuer-recognized settlement or reversal separately when that flow is available.
            </Text>
            <Pressable
              onPress={() => setDeleteBlockedTarget(null)}
              style={{ minHeight: 50, borderRadius: 12, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", marginTop: 18 }}
              accessibilityRole="button"
              accessibilityLabel="Close installment delete restriction"
            >
              <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
                Got it
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Unanswered on purpose: the only way out is one of the three answers. */}
      <Modal visible={showUnusualSpending && unusualSpending !== null} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View style={{ borderRadius: 20, padding: 22, backgroundColor: P.surface }}>
            <Image source={budgieThink} accessibilityIgnoresInvertColors style={{ width: "100%", height: undefined, aspectRatio: 3 / 2 }} resizeMode="contain" />
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink, marginTop: 12, textAlign: "center" }}>Budgie wants to learn about you</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.secondary, marginTop: 10, textAlign: "center" }}>
              You spent {formatPhp(unusualSpending?.amountCentavos ?? 0)} on {unusualSpending?.subcategoryLabel ?? "this subcategory"}, more than your usual {formatPhp(unusualSpending?.usualSpendingCentavos ?? 0)}. Will you be making this expense again?
            </Text>
            <View style={{ marginTop: 18 }}>
              {unusualSpending ? <RecurrenceQuestion key={unusualSpending.transactionId} transactionDate={unusualSpending.transactionDate} onAnswer={answerUnusualSpendingRecurrence} /> : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </>
  );
}
