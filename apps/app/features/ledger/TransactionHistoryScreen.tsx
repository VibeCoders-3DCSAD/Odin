import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { listFinancialAccounts } from "../../local-db/repositories/financialAccounts";
import { listTransactions, deleteTransaction, type TransactionFilters } from "../../local-db/repositories/ledger";
import { listSubcategories } from "../../local-db/repositories/taxonomy";
import { runSync } from "../../local-db/sync/runSync";
import { useToast } from "../../components/Toast";
import NewTransactionScreen from "./NewTransactionScreen";
import type { Transaction } from "../../local-db/repositories/ledger";

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

const SORT_OPTIONS = [
  { key: "transaction_date", label: "Date" },
  { key: "amount_centavos", label: "Amount" },
] as const;

const DATE_RANGES = ["all", "week", "month", "year"] as const;

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onNewTransaction: () => void;
};

export default function TransactionHistoryScreen({ userId, deviceId, accessToken, onNewTransaction }: Props) {
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("transaction_date");
  const [sortDir, setSortDir] = useState<string>("desc");
  const [dateRange, setDateRange] = useState<string>("all");
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});
  const [subcategoryMap, setSubcategoryMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadMaps() {
      const [accts, subs] = await Promise.all([
        listFinancialAccounts(userId),
        listSubcategories(userId),
      ]);
      const amap: Record<string, string> = {};
      for (const a of accts) amap[a.id] = a.name;
      const smap: Record<string, string> = {};
      for (const s of subs) smap[s.id] = s.label;
      setAccountMap(amap);
      setSubcategoryMap(smap);
    }
    loadMaps().catch(() => {});
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const filters: TransactionFilters = {
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (typeFilter !== "all") filters.transaction_type = typeFilter;
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
      }
      const rows = await listTransactions(userId, filters);
      setTransactions(rows);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [typeFilter, sortBy, sortDir, dateRange]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTransaction(userId, deviceId, deleteTarget.id);
      showToast("Transaction deleted", "success");
      runSync(userId, deviceId, accessToken, { maxAttempts: 3 }).catch(() => {});
      setDeleteTarget(null);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "danger");
    } finally {
      setDeleting(false);
    }
  }

  function formatAmount(centavos: number): string {
    return (centavos / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00+08:00");
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  }

  function getLabel(tx: Transaction): string {
    if (tx.merchant_name) return tx.merchant_name;
    if (tx.counterparty_name) return tx.counterparty_name;
    if (tx.notes) return tx.notes;
    const subcat = tx.subcategory_id ? subcategoryMap[tx.subcategory_id] : undefined;
    if (subcat) return subcat;
    return "Transaction";
  }

  function getAccountLabel(tx: Transaction): string {
    const id = tx.transaction_type === "income" ? tx.destination_account_id : tx.source_account_id;
    return id ? accountMap[id] ?? "" : "";
  }

  const typePrefix = (tx: Transaction) =>
    tx.transaction_type === "expense" ? "-" : tx.transaction_type === "income" ? "+" : "";

  const amountColor = (tx: Transaction) =>
    tx.transaction_type === "expense" ? palette.error
      : tx.transaction_type === "income" ? palette.success
      : "#1565C0";

  const grouped = useMemo(() => {
    const groups: { date: string; items: Transaction[] }[] = [];
    for (const tx of transactions) {
      const dateLabel = formatDate(tx.transaction_date);
      const last = groups[groups.length - 1];
      if (last && last.date === dateLabel) {
        last.items.push(tx);
      } else {
        groups.push({ date: dateLabel, items: [tx] });
      }
    }
    return groups;
  }, [transactions]);

  if (editTarget) {
    return (
      <NewTransactionScreen
        transaction={editTarget}
        userId={userId}
        deviceId={deviceId}
        accessToken={accessToken}
        onClose={() => { setEditTarget(null); load(); }}
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Type filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
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

      {/* Date range chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
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
              {r === "all" ? "Any time" : r === "week" ? "This week" : r === "month" ? "This month" : "This year"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Search */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={load}
        returnKeyType="search"
        placeholder="Search transactions..."
        placeholderTextColor={palette.mut}
        style={{
          height: 44, borderRadius: 12, borderWidth: 1, borderColor: palette.line,
          paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 13, color: palette.ink,
          backgroundColor: palette.card,
        }}
      />

      {/* Sort */}
      <View style={{ flexDirection: "row", gap: 8 }}>
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
        grouped.map((group) => (
          <View key={group.date}>
            <Text style={{
              fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.mut,
              marginTop: 12, marginBottom: 8,
            }}>
              {group.date}
            </Text>
            {group.items.map((tx) => (
              <Pressable
                key={tx.id}
                onPress={() => setEditTarget(tx)}
                onLongPress={() => setDeleteTarget(tx)}
                style={{
                  borderRadius: 12, borderWidth: 1, borderColor: palette.line,
                  backgroundColor: palette.card, padding: 14, marginBottom: 6,
                  flexDirection: "row", alignItems: "center", gap: 12,
                }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: TYPE_COLORS[tx.transaction_type] ?? palette.mut,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>
                    {tx.transaction_type === "transfer" ? "TR" : tx.transaction_type.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }} numberOfLines={1}>
                    {getLabel(tx)}
                  </Text>
                  <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut }} numberOfLines={1}>
                    {getAccountLabel(tx)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{
                    fontFamily: "Manrope", fontWeight: "700", fontSize: 14,
                    color: amountColor(tx),
                  }}>
                    {typePrefix(tx)}P{formatAmount(tx.amount_centavos)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))
      )}

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
    </View>
  );
}
