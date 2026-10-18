import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Funnel } from "phosphor-react-native";
import { listTransactions, getTransaction, getTransactionTotals, deleteTransaction, type TransactionFilters, type TransactionListItem, type TransactionTotals } from "../../local-db/repositories/ledger";
import { readTransactionCache, reuseUnchangedRows, transactionCacheKey, writeTransactionCache } from "./transactionCache";
import { getCreditCardPurchaseMetadataForTransaction } from "../../local-db/repositories/creditCardInstallments";
import { listCategories, type Category } from "../../local-db/repositories/taxonomy";
import { runSync } from "../../local-db/sync/runSync";
import { useToast } from "../../components/Toast";
import KebabTooltip from "../../components/KebabTooltip";
import NewTransactionScreen from "./NewTransactionScreen";
import type { Transaction } from "../../local-db/repositories/ledger";
import { confirmRecurringSpending, type UnusualSpendingInsight } from "../../local-db/repositories/unusualSpending";
import { BottomSheetSurface } from "../../components/BottomSheetSurface";
import { DEFAULT_TAXONOMY_COLOR, TaxonomyIcon } from "../taxonomy/taxonomyVisuals";

const palette = {
  shell: "#fcf8f0",
  brand: "#013220",
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  success: "#08B16A",
  card: "#F1F0EB",
};

const TYPE_COLORS: Record<string, string> = {
  income: "#08B16A",
  expense: "#D9001F",
  transfer: "#1565C0",
};
// Badge for uncategorized biller and remittance payments.
const SCHEDULED_PAYMENT_COLOR = "#E8590C";

const SORT_OPTIONS = [
  { key: "transaction_date", label: "Date" },
  { key: "amount_centavos", label: "Amount" },
] as const;

const FILTER_TYPES = ["all", "income", "expense", "transfer"] as const;

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

const TransactionRow = memo(function TransactionRow({ tx, onEdit, onDelete }: {
  tx: TransactionListItem;
  onEdit: (transactionId: string) => void;
  onDelete: (transactionId: string) => void;
}) {
  const typeColor = TYPE_COLORS[tx.transaction_type] ?? palette.mut;
  const badgeColor = tx.is_scheduled_payment ? SCHEDULED_PAYMENT_COLOR : typeColor;
  const prefix = tx.transaction_type === "expense" ? "-" : tx.transaction_type === "income" ? "+" : "";
  return (
    <View style={{ paddingVertical: 8, paddingHorizontal: 2, marginBottom: 2, flexDirection: "row", alignItems: "center", gap: 10 }}>
      {tx.icon_key ? (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tx.color_hex ?? DEFAULT_TAXONOMY_COLOR, alignItems: "center", justifyContent: "center", marginRight: 2 }}>
          <TaxonomyIcon iconKey={tx.icon_key} size={18} color="#fff" weight="fill" />
        </View>
      ) : (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${badgeColor}20`, alignItems: "center", justifyContent: "center", marginRight: 2 }}>
          <Text style={{ fontSize: 10, color: badgeColor, fontWeight: "800" }}>
            {tx.is_scheduled_payment ? "BR" : tx.transaction_type === "transfer" ? "TR" : tx.transaction_type === "income" ? "+" : "-"}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13.5, color: palette.ink }} numberOfLines={1}>
          {tx.name}
        </Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: palette.mut }} numberOfLines={1}>
          {[tx.category_label, tx.financial_account_name].filter(Boolean).join(" · ") || "Uncategorized"}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13.5, color: typeColor }}>
          {prefix}P{formatAmount(tx.amount_centavos)}
        </Text>
      </View>
      <KebabTooltip onEdit={() => onEdit(tx.id)} onDelete={() => onDelete(tx.id)} />
    </View>
  );
});

export default function TransactionHistoryScreen({ userId, deviceId, accessToken, unusualSpending, onUnusualSpendingDismissed, onNewTransaction, onLoadMoreChange, getScrollOffset, scrollTo, syncVersion = 0 }: Props) {
  const { showToast } = useToast();

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
  const [confirmingRecurring, setConfirmingRecurring] = useState(false);
  const [recurringError, setRecurringError] = useState<string | null>(null);
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

  async function confirmUnusualSpendingRecurring(): Promise<void> {
    if (!unusualSpending) return;
    setConfirmingRecurring(true);
    try {
      await confirmRecurringSpending(userId, deviceId, unusualSpending.transactionId);
      dismissUnusualSpending();
    } catch {
      setRecurringError("Your answer could not be saved. Try again.");
    } finally {
      setConfirmingRecurring(false);
    }
  }

  function dismissUnusualSpending(): void {
    setShowUnusualSpending(false);
    setRecurringError(null);
    onUnusualSpendingDismissed();
  }

  function formatCurrency(amountCentavos: number): string {
    return `PHP ${(amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const filterActive = showFilters || activeFilterCount > 0;

  // The list stays mounted, hidden, while a transaction is edited: remounting every loaded row on return
  // blocks the JS thread for seconds, whereas a mounted list only re-renders the rows the edit changed.
  return (
    <>
    {editTarget ? (
      <NewTransactionScreen
        transaction={editTarget}
        userId={userId}
        deviceId={deviceId}
        accessToken={accessToken}
        onClose={() => { setEditTarget(null); load({ inPlace: true }); }}
      />
    ) : null}
    <View
      style={{ gap: 12, display: editTarget ? "none" : "flex" }}
      onLayout={() => {
        // The edit form shares the shell's scroll view, so the list's offset is restored once it is laid out again;
        // any earlier and the scroll view is still only as tall as the form.
        if (editTarget || listScrollY.current === null) return;
        scrollTo?.(listScrollY.current);
        listScrollY.current = null;
      }}
    >
      {/* Search bar + filter icon */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load()}
          returnKeyType="search"
          placeholder="Search transactions..."
          placeholderTextColor={palette.mut}
          style={{
            flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: palette.line,
            paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 13, color: palette.ink,
            backgroundColor: palette.card,
          }}
        />
        <Pressable
          onPress={() => setShowFilters(true)}
          style={{
            width: 44, height: 44, borderRadius: 12, borderWidth: 1,
            borderColor: filterActive ? palette.brand : palette.line,
            backgroundColor: filterActive ? palette.brand : palette.card,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Funnel size={20} color={filterActive ? "#fff" : palette.mut} weight="bold" />
          {activeFilterCount > 0 && (
            <View style={{
              position: "absolute", top: -4, right: -4, minWidth: 16, height: 16,
              borderRadius: 8, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center",
              paddingHorizontal: 4,
            }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 9, color: "#fff" }}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 10, opacity: stale ? 0.5 : 1 }}>
        <View style={{ flex: 1, borderRadius: 14, backgroundColor: "#edfff8", borderWidth: 1, borderColor: "#d4f5e7", padding: 12 }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.success, marginBottom: 3 }}>Income</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: palette.success }}>+P{formatAmount(totals.income_centavos)}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 14, backgroundColor: "#fff0f2", borderWidth: 1, borderColor: "#ffdce2", padding: 12 }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.error, marginBottom: 3 }}>Expenses</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: palette.error }}>-P{formatAmount(totals.expense_centavos)}</Text>
        </View>
      </View>

      {/* Transaction list */}
      {loading ? (
        <ActivityIndicator color={palette.brand} style={{ marginTop: 40 }} />
      ) : transactions.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 60 }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 14, color: palette.mut, marginBottom: 16 }}>
            No transactions yet
          </Text>
          <Pressable
            onPress={onNewTransaction}
            style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.brand }}
          >
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: "#fff" }}>
              Add your first
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ opacity: stale ? 0.5 : 1 }}>
        {stale ? <ActivityIndicator color={palette.brand} style={{ marginTop: 12 }} /> : null}
        {grouped.map((group) => (
          <View key={`${group.date}-${group.items[0]!.id}`}>
            <Text style={{
              fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: palette.mut,
              letterSpacing: 0.4, marginTop: 12, marginBottom: 7,
            }}>
              {group.date.toUpperCase()}
            </Text>
            {group.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onEdit={editTransaction} onDelete={selectDeleteTarget} />
            ))}
          </View>
        ))}
        </View>
      )}
      {loadingMore ? <ActivityIndicator color={palette.brand} style={{ marginVertical: 16 }} /> : null}

      {/* Filter bottom drawer */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setShowFilters(false)}
        >
          <BottomSheetSurface
            bottomSpacing={32}
            style={{
              backgroundColor: palette.shell, borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: 20,
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginBottom: 16 }} />

            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink, marginBottom: 16 }}>
              Filter & Sort
            </Text>

            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.mut, marginBottom: 8 }}>
              Type
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 16 }}>
              {FILTER_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTypeFilter(t)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: typeFilter === t ? palette.brand : palette.card,
                    borderWidth: 1,
                    borderColor: typeFilter === t ? palette.brand : palette.line,
                  }}
                >
                  <Text style={{
                    fontFamily: "Manrope", fontWeight: "600", fontSize: 12,
                    color: typeFilter === t ? "#fff" : palette.ink2,
                  }}>
                    {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.mut, marginBottom: 8 }}>
              Category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 16 }}>
              <Pressable
                onPress={() => setCategoryFilter("all")}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: categoryFilter === "all" ? palette.brand : palette.card,
                  borderWidth: 1, borderColor: categoryFilter === "all" ? palette.brand : palette.line,
                }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: categoryFilter === "all" ? "#fff" : palette.ink2 }}>
                  All categories
                </Text>
              </Pressable>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryFilter(category.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: categoryFilter === category.id ? palette.brand : palette.card,
                    borderWidth: 1, borderColor: categoryFilter === category.id ? palette.brand : palette.line,
                  }}
                >
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: categoryFilter === category.id ? "#fff" : palette.ink2 }}>
                    {category.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.mut, marginBottom: 8 }}>
              Date Range
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 16 }}>
              {DATE_RANGES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setDateRange(r)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: dateRange === r ? palette.brand : palette.card,
                    borderWidth: 1,
                    borderColor: dateRange === r ? palette.brand : palette.line,
                  }}
                >
                  <Text style={{
                    fontFamily: "Manrope", fontWeight: "600", fontSize: 12,
                    color: dateRange === r ? "#fff" : palette.ink2,
                  }}>
                    {r === "all" ? "Any time" : r === "week" ? "This week" : r === "month" ? "This month" : r === "year" ? "This year" : "Custom"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {dateRange === "custom" ? (
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {(["from", "to"] as const).map((field) => {
                  const value = field === "from" ? customFromDate : customToDate;
                  return (
                    <Pressable
                      key={field}
                      onPress={() => setDatePickerField(field)}
                      style={{ flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, justifyContent: "center", paddingHorizontal: 12 }}
                    >
                      <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut }}>{field === "from" ? "From" : "To"}</Text>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: value ? palette.ink : palette.mut, marginTop: 2 }}>{value ?? "Select date"}</Text>
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

            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.mut, marginBottom: 8 }}>
              Sort By
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      if (active) {
                        setSortDir(sortDir === "desc" ? "asc" : "desc");
                      } else {
                        setSortBy(opt.key);
                      }
                    }}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: active ? palette.brand : palette.card,
                      flexDirection: "row", alignItems: "center", gap: 4,
                    }}
                  >
                    <Text style={{
                      fontFamily: "Manrope", fontWeight: "600", fontSize: 11,
                      color: active ? "#fff" : palette.ink2,
                    }}>
                      {opt.label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
                  flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.line,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>
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
                  flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: palette.brand,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
                  Apply
                </Text>
              </Pressable>
            </View>
          </BottomSheetSurface>
        </Pressable>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ borderRadius: 20, backgroundColor: palette.shell, padding: 20 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink }}>
              Delete transaction?
            </Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8 }}>
              This will reverse any balance changes. The transaction will remain as a tombstone record and stay syncable.
            </Text>
            <View style={{ gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={{ minHeight: 50, borderRadius: 14, backgroundColor: palette.error, alignItems: "center", justifyContent: "center" }}
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
                style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>
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
          <View style={{ borderRadius: 20, backgroundColor: palette.shell, padding: 20 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink }}>
              Cannot delete installment purchase
            </Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8 }}>
              Installment transactions cannot be deleted after creation because billing-cycle amortizations, issuer statement values, and available-credit holds may already depend on them.
            </Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8 }}>
              Record an issuer-recognized settlement or reversal separately when that flow is available.
            </Text>
            <Pressable
              onPress={() => setDeleteBlockedTarget(null)}
              style={{ minHeight: 50, borderRadius: 14, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center", marginTop: 18 }}
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

      <Modal visible={showUnusualSpending && unusualSpending !== null} transparent animationType="fade" onRequestClose={dismissUnusualSpending}>
        <Pressable onPress={dismissUnusualSpending} style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.4)" }}>
          <Pressable onPress={() => {}}>
            <View style={{ borderRadius: 20, padding: 22, backgroundColor: palette.shell }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>Unusual spending detected</Text>
              <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: palette.ink2, marginTop: 12 }}>
                This {formatCurrency(unusualSpending?.amountCentavos ?? 0)} expense is outside your usual spending range for {unusualSpending?.subcategoryLabel ?? "this subcategory"}.
              </Text>
              <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8 }}>
                Your usual spending is {formatCurrency(unusualSpending?.usualSpendingCentavos ?? 0)}. This is only a personal spending observation.
              </Text>
              {recurringError ? <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.error, marginTop: 10 }}>{recurringError}</Text> : null}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 20, marginTop: 22 }}>
                <Pressable onPress={() => void confirmUnusualSpendingRecurring()} disabled={confirmingRecurring} style={{ flexShrink: 1 }} accessibilityRole="button" accessibilityLabel="I'll be making this spending frequently">
                  <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>{confirmingRecurring ? "Saving..." : "I'll be making this spending frequently"}</Text>
                </Pressable>
                <Pressable onPress={dismissUnusualSpending} accessibilityRole="button" accessibilityLabel="Close unusual spending insight">
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: palette.brand }}>Got it</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </>
  );
}
