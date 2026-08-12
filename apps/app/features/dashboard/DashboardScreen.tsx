import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Image } from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendUp,
  Sparkle,
} from "phosphor-react-native";
import { getDashboardSummary, getDailyTrends } from "../../local-db/repositories/dashboardSummary";
import type { DashboardSummary, DailyTrend } from "../../local-db/repositories/dashboardSummary";
import { getAllSnapshots } from "../../local-db/repositories/dashboardSnapshots";
import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboardSnapshots";
import AvailableBalanceCard from "../../components/AvailableBalanceCard";

const P = {
  shell: "#fcf8f0",
  brand: "#013220",
  brandMedium: "#0E6D46",
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  card: "#F8EFDC",
  aqua50: "#EFFEF7",
  aqua100: "#D4F7E5",
  aqua300: "#7cf9c4",
  aqua600: "#08B16A",
  aqua700: "#0B8A55",
  aqua800: "#066B40",
  monza100: "#FFF0F2",
  monza600: "#D9001F",
  sun100: "#FFF3E0",
  sun400: "#E5A12B",
  sun500: "#C25E00",
  white: "#FFFFFF",
};

const EMPTY_SUMMARY: DashboardSummary = {
  currentBalanceCentavos: 0,
  currentMonthIncomeCentavos: 0,
  currentMonthExpenseCentavos: 0,
  previousMonthIncomeCentavos: 0,
  previousMonthExpenseCentavos: 0,
  recentTransactions: [],
  categoryGroupSpending: [],
};

const SPENDING_COLORS = [P.brand, P.aqua600, "#8B7355", P.aqua300, P.sun500, P.monza600];

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onNavigate: (page: string) => void;
};

function formatPeso(centavos: number): string {
  const pesos = Math.abs(centavos) / 100;
  const sign = centavos < 0 ? "-" : "";
  return `${sign}₱${pesos.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPesoCompact(centavos: number): string {
  const pesos = Math.abs(centavos) / 100;
  if (pesos >= 1000) {
    const k = pesos / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return pesos.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function deltaPercent(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? "+100%" : null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (pct === 0) return null;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getPreviousMonthName(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleDateString("en-US", { month: "short" });
}

function EmptyDashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 4 }}>
      <View style={{ width: "100%", minHeight: 105, borderRadius: 22, backgroundColor: P.brand, padding: 18, overflow: "hidden" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: "rgba(255,255,255,0.72)" }}>Available Balance</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 7 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 14, color: "rgba(255,255,255,0.7)", marginRight: 3 }}>PHP</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 24, color: P.white }}>0</Text>
        </View>
        <Text style={{ fontFamily: "Manrope", fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>Add your first account to get started</Text>
      </View>

      <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: P.aqua50, justifyContent: "center", alignItems: "center", marginTop: 66 }}>
        <Image source={require("../../assets/odin-logo.png")} accessibilityLabel="Odin logo" style={{ width: 46, height: 46, resizeMode: "contain" }} />
      </View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 17, color: P.ink, marginTop: 22 }}>Welcome to Odin</Text>
      <Text style={{ maxWidth: 270, fontFamily: "Manrope", fontSize: 11.5, lineHeight: 17, color: P.mut, textAlign: "center", marginTop: 7 }}>
        Log your first transaction or set up a budget and your dashboard will come to life.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        onPress={() => onNavigate("add-transaction")}
        style={{ width: "100%", minHeight: 40, borderRadius: 11, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", marginTop: 22 }}
      >
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.white }}>Add transaction</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Set up a budget"
        onPress={() => onNavigate("budget-advice")}
        style={{ width: "100%", minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: P.line, alignItems: "center", justifyContent: "center", marginTop: 9 }}
      >
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2 }}>Set up a budget</Text>
      </Pressable>
    </View>
  );
}

function SpendingPie({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const size = 104;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={P.line} strokeWidth={strokeWidth} fill="none" />
        {total > 0 && segments.map((segment) => {
          const length = (segment.value / total) * circumference;
          const circle = (
            <Circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              fill="none"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          );
          offset += length;
          return circle;
        })}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>{formatPesoCompact(total)}</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 9, color: P.mut, marginTop: 1 }}>Total</Text>
      </View>
    </View>
  );
}

// --- Line graph for trends (income green, expenses red) ---
const CHART_W = 290;
const CHART_H = 90;
const DOT_R = 3;

function LineGraph({ points, color }: { points: { x: number; y: number }[]; color: string }) {
  if (points.length < 2) return null;

  return (
    <>
      {points.map((pt, i) => {
        if (i === 0) return null;
        const prev = points[i - 1]!;
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const cx = (prev.x + pt.x) / 2;
        const cy = (prev.y + pt.y) / 2;
        return (
          <View
            key={`l${i}`}
            style={{
              position: "absolute",
              left: cx - len / 2,
              top: cy - 1,
              width: len,
              height: 2,
              borderRadius: 1,
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      {points.map((pt, i) => (
        <View
          key={`d${i}`}
          style={{
            position: "absolute",
            left: pt.x - DOT_R,
            top: pt.y - DOT_R,
            width: DOT_R * 2,
            height: DOT_R * 2,
            borderRadius: DOT_R,
            backgroundColor: color,
          }}
        />
      ))}
    </>
  );
}

function TrendChart({ data, startingBalance }: { data: DailyTrend[]; startingBalance: number }) {
  if (data.length === 0) {
    return (
      <View style={{ height: CHART_H + 10, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.mut }}>No data this month</Text>
      </View>
    );
  }

  const balances = data.map((d) => startingBalance + d.balance_centavos);
  const expenses = data.map((d) => d.expense_centavos);
  const allVals = [...balances, ...expenses];
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;
  const padX = 8;
  const padY = 6;
  const usableW = CHART_W - padX * 2;
  const usableH = CHART_H - padY * 2;

  const toXY = (vals: number[]) =>
    vals.map((v, i) => ({
      x: padX + (data.length === 1 ? usableW / 2 : (i / (data.length - 1)) * usableW),
      y: padY + usableH - ((v - minVal) / range) * usableH,
    }));

  const balancePoints = toXY(balances);
  const expensePoints = toXY(expenses);

  return (
    <View style={{ width: "100%", height: CHART_H + 10 }}>
      <View style={{ width: "100%", height: CHART_H, position: "relative" }}>
        <LineGraph points={expensePoints} color={P.monza600} />
        <LineGraph points={balancePoints} color={P.aqua600} />
      </View>
    </View>
  );
}

export default function DashboardScreen({ userId, onNavigate }: Props) {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, DashboardSnapshotWithMeta | null>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await getDashboardSummary(userId).catch(() => EMPTY_SUMMARY);
      setSummary(s);
    } catch {}

    try {
      const t = await getDailyTrends(userId).catch(() => []);
      setTrends(t);
    } catch {}

    try {
      const snap = await getAllSnapshots(userId).catch(() => ({}));
      setSnapshots(snap);
    } catch {}

    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={P.brand} />
      </View>
    );
  }

  const s = summary;
  const prevMonthName = getPreviousMonthName();
  const incomeDelta = deltaPercent(s.currentMonthIncomeCentavos, s.previousMonthIncomeCentavos);
  const expenseDelta = deltaPercent(s.currentMonthExpenseCentavos, s.previousMonthExpenseCentavos);
  const categoryGroupExpenseTotal = s.categoryGroupSpending.reduce((sum, group) => sum + group.total_centavos, 0);
  const visibleSpending = s.categoryGroupSpending.slice(0, 4);
  const hiddenSpendingTotal = s.categoryGroupSpending.slice(4).reduce((sum, group) => sum + group.total_centavos, 0);
  const spendingGroups = hiddenSpendingTotal > 0
    ? [...visibleSpending, { category_group_label: "Other", total_centavos: hiddenSpendingTotal }]
    : visibleSpending;

  const isEmpty = s.currentBalanceCentavos === 0
    && s.currentMonthIncomeCentavos === 0
    && s.currentMonthExpenseCentavos === 0
    && s.recentTransactions.length === 0
    && s.categoryGroupSpending.length === 0;

  if (isEmpty) return <EmptyDashboard onNavigate={onNavigate} />;

  // Budget health from snapshot
  const budgetSnap = snapshots.budget_health as (DashboardSnapshotWithMeta & { payload_json: string }) | null;
  let budgetItems: { label: string; spent: number; budget: number }[] = [];
  let budgetStatus: "on_track" | "warning" | "critical" = "on_track";
  if (budgetSnap) {
    try {
      const parsed = JSON.parse(budgetSnap.payload_json);
      budgetItems = parsed.items ?? [];
      budgetStatus = parsed.status ?? "on_track";
    } catch {}
  }

  // Forecast from snapshot
  const forecastSnap = snapshots.forecast as (DashboardSnapshotWithMeta & { payload_json: string }) | null;
  let forecastText: string | null = null;
  if (forecastSnap) {
    try {
      const parsed = JSON.parse(forecastSnap.payload_json);
      forecastText = parsed.text ?? null;
    } catch {}
  }

  return (
    <View>
      {/* Balance card */}
      <AvailableBalanceCard
        amount={(s.currentBalanceCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        detail={incomeDelta ? `${incomeDelta} vs last month` : undefined}
        detailPill
      />

      {/* Income / Expense cards */}
      <View style={{ flexDirection: "row", gap: 11, marginTop: 14 }}>
        <View style={{ flex: 1, minHeight: 106, padding: 14, borderRadius: 16, backgroundColor: P.card, borderWidth: 1, borderColor: P.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12, color: P.mut }}>Income</Text>
            <View style={{ width: 25, height: 25, borderRadius: 13, backgroundColor: P.aqua100, justifyContent: "center", alignItems: "center" }}>
              <ArrowDownLeft size={13} color={P.aqua700} weight="bold" />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 9 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: P.mut, marginRight: 3 }}>PHP</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
              {Math.abs(s.currentMonthIncomeCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
          </View>
          {incomeDelta && (
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: P.aqua700, marginTop: 3 }}>{incomeDelta} from {prevMonthName}</Text>
          )}
        </View>

        <View style={{ flex: 1, minHeight: 106, padding: 14, borderRadius: 16, backgroundColor: P.card, borderWidth: 1, borderColor: P.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12, color: P.mut }}>Expenses</Text>
            <View style={{ width: 25, height: 25, borderRadius: 13, backgroundColor: "#FFDDE3", justifyContent: "center", alignItems: "center" }}>
              <ArrowUpRight size={13} color={P.monza600} weight="bold" />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 9 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: P.mut, marginRight: 3 }}>PHP</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
              {Math.abs(s.currentMonthExpenseCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
          </View>
          {expenseDelta && (
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: P.monza600, marginTop: 3 }}>{expenseDelta} from {prevMonthName}</Text>
          )}
        </View>
      </View>

      {/* Trends */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink }}>Trends</Text>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.aqua700 }}>This month</Text>
      </View>
      <View style={{ borderRadius: 18, backgroundColor: P.card, borderWidth: 1, borderColor: P.line, padding: 14, paddingBottom: 10 }}>
        <TrendChart data={trends} startingBalance={s.currentBalanceCentavos - (s.currentMonthIncomeCentavos - s.currentMonthExpenseCentavos)} />
        <View style={{ flexDirection: "row", gap: 18, paddingTop: 6, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 14, height: 3, borderRadius: 3, backgroundColor: P.aqua600 }} />
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: P.mut }}>Balance</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 14, height: 3, borderRadius: 3, backgroundColor: P.monza600 }} />
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: P.mut }}>Expenses</Text>
          </View>
        </View>
      </View>

      {/* Spending */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink }}>Spending</Text>
        <Pressable onPress={() => onNavigate("categories")}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.aqua700 }}>View all</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, backgroundColor: P.card, borderWidth: 1, borderColor: P.line, padding: 16 }}>
        <SpendingPie
          segments={spendingGroups.map((c, i) => ({
            label: c.category_group_label,
            value: c.total_centavos,
            color: SPENDING_COLORS[i] ?? P.mut,
          }))}
          total={categoryGroupExpenseTotal}
        />
        <View style={{ flex: 1, gap: 10 }}>
          {spendingGroups.map((c, i) => {
            const pct = categoryGroupExpenseTotal > 0
              ? Math.round((c.total_centavos / categoryGroupExpenseTotal) * 100)
              : 0;
            return (
              <View key={c.category_group_label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SPENDING_COLORS[i] ?? P.mut }} />
                <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "500", fontSize: 12.5, color: P.ink2 }} numberOfLines={1}>{c.category_group_label}</Text>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12.5, color: P.ink }}>{pct}%</Text>
              </View>
            );
          })}
          {s.categoryGroupSpending.length === 0 && (
            <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.mut }}>No expenses this month</Text>
          )}
        </View>
      </View>

      {/* Recent */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink }}>Recent</Text>
        <Pressable onPress={() => onNavigate("transactions")}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.aqua700 }}>View all</Text>
        </Pressable>
      </View>
      <View style={{ gap: 2 }}>
        {s.recentTransactions.map((tx) => {
          const isIncome = tx.transaction_type === "income";
          const label = tx.merchant_name || tx.counterparty_name || (isIncome ? "Income" : "Expense");
          const bgColor = isIncome ? P.aqua50 : P.sun100;
          const iconColor = isIncome ? P.aqua700 : P.sun500;
          return (
            <View key={tx.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bgColor, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: iconColor }}>
                  {label.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13.5, color: P.ink }} numberOfLines={1}>{label}</Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.mut }}>{isIncome ? "Income" : "Expense"}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13.5, color: isIncome ? P.aqua700 : P.ink }}>
                  {isIncome ? "+" : "-"}{formatPeso(tx.amount_centavos)}
                </Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.mut }}>{formatTime(tx.transaction_date)}</Text>
              </View>
            </View>
          );
        })}
        {s.recentTransactions.length === 0 && (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.mut }}>No recent transactions</Text>
          </View>
        )}
      </View>

      {/* Budget Health */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink }}>Budget Health</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {budgetSnap?.stale && (
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: P.mut }}>Cached</Text>
          )}
          {budgetItems.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 100, backgroundColor: P.aqua50 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.aqua600 }} />
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: P.aqua800 }}>
                {budgetStatus === "on_track" ? "On Track" : budgetStatus === "warning" ? "Caution" : "Over"}
              </Text>
            </View>
          )}
        </View>
      </View>
      {budgetItems.length > 0 ? (
        <View style={{ gap: 14 }}>
          {budgetItems.map((item, i) => {
            const pct = item.budget > 0 ? Math.min((item.spent / item.budget) * 100, 100) : 0;
            const barColor = pct >= 100 ? P.monza600 : pct >= 85 ? P.sun400 : P.aqua600;
            return (
              <View key={i}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.ink2 }}>{item.label}</Text>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.mut }}>
                    {formatPesoCompact(item.spent)} / {formatPesoCompact(item.budget)}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 6, backgroundColor: P.line, overflow: "hidden" }}>
                  <View style={{ width: `${pct}%`, height: "100%", borderRadius: 6, backgroundColor: barColor }} />
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ paddingVertical: 16, alignItems: "center", borderRadius: 18, backgroundColor: P.card, borderWidth: 1, borderColor: P.line }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.mut }}>Set budgets to see health</Text>
        </View>
      )}

      {/* Forecast callout */}
      <View style={{ flexDirection: "row", gap: 11, alignItems: "flex-start", marginTop: 20, padding: 14, borderRadius: 15, backgroundColor: P.aqua50, borderWidth: 1, borderColor: P.aqua100 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: P.aqua600, justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
          <Sparkle size={16} color={P.white} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          {forecastSnap?.stale && (
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 10, color: P.mut, marginBottom: 2 }}>Cached</Text>
          )}
          <Text style={{ fontFamily: "Manrope", fontSize: 12.5, lineHeight: 18, color: P.ink2 }}>
            {forecastText ?? "Sync to get personalized spending forecasts and insights."}
          </Text>
        </View>
      </View>
    </View>
  );
}
