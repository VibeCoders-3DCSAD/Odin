import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "phosphor-react-native";
import Svg, { Path } from "react-native-svg";
import { getSnapshot } from "../../local-db/repositories/dashboardSnapshots";
import {
  getAccountSummary,
  getAccountBalanceAt,
  getAllocationSummary,
  getBudgetActualSummary,
  getCashFlowComparisonSummary,
  getCashFlowSummary,
  getDebtSummary,
  getExpenseCategoryDistribution,
  getSavingsSummary,
  listCategoryBreakdown,
  type ReportRange,
} from "../../local-db/repositories/financialReports";
import { getForecastContent } from "../dashboard/dashboardSnapshotContent";
import type { CashFlowComparison } from "./reportRange";

const P = { brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#D9E5DD", shell: "#F6FAF7", positive: "#087A4A", negative: "#B42318" };
const PIE_COLORS = ["#087A4A", "#4C956C", "#D4A373", "#5B8E7D", "#BC6C25", "#8A5A44"];

function money(value: number): string {
  return `PHP ${(value / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={{ backgroundColor: P.shell, borderColor: P.line, borderRadius: 16, borderWidth: 1, padding: 16 }}>
    <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 16, fontWeight: "800" }}>{title}</Text>
    {children}
  </View>;
}

function LoadingValue({ children }: { children: ReactNode }) {
  return <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 10 }}>{children}</Text>;
}

function useReportData<T>(load: () => Promise<T>, dependencies: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    void load().then((result) => { if (current) setData(result); }).catch(() => { if (current) setError(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  // The caller supplies primitive user and range values, so loading only reruns on a real report change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return { data, loading, error };
}

function State({ loading, error, children }: { loading: boolean; error: boolean; children: ReactNode }) {
  if (loading) return <ActivityIndicator color={P.brand} style={{ marginTop: 18 }} />;
  if (error) return <LoadingValue>This section could not be calculated.</LoadingValue>;
  return <>{children}</>;
}

type RefreshProps = { refreshKey: number };

export function CashFlowSection({ userId, range, comparison, refreshKey }: { userId: string; range: ReportRange; comparison: CashFlowComparison } & RefreshProps) {
  const { data, loading, error } = useReportData(async () => {
    const [current, previous] = await Promise.all([
      getCashFlowSummary(userId, range),
      getCashFlowComparisonSummary(userId, comparison.range, comparison.averageByActiveMonth),
    ]);
    return { current, previous };
  }, [userId, range.startDate, range.endDate, comparison.range.startDate, comparison.range.endDate, comparison.averageByActiveMonth, refreshKey]);
  return <Section title="Cash flow"><State loading={loading} error={error}>{data ? <View style={{ marginTop: 14, gap: 8 }}>
    <ComparisonMetric label="Income" current={data.current.incomeCentavos} previous={data.previous.incomeCentavos} comparisonLabel={comparison.label} />
    <ComparisonMetric label="Expenses" current={data.current.expenseCentavos} previous={data.previous.expenseCentavos} comparisonLabel={comparison.label} />
    <Metric label="Net cash flow" value={money(data.current.netCashFlowCentavos)} color={data.current.netCashFlowCentavos >= 0 ? P.positive : P.negative} strong />
  </View> : <LoadingValue>No posted income or expenses in this period.</LoadingValue>}</State></Section>;
}

export function ExpenseDistributionSection({ userId, range, refreshKey }: { userId: string; range: ReportRange } & RefreshProps) {
  const { data, loading, error } = useReportData(() => getExpenseCategoryDistribution(userId, range), [userId, range.startDate, range.endDate, refreshKey]);
  const total = data?.reduce((sum, item) => sum + item.amountCentavos, 0) ?? 0;
  return <Section title="Spending breakdown"><State loading={loading} error={error}>{data?.length && total > 0 ? <View style={{ marginTop: 14 }}>
    <View accessibilityLabel={`Spending breakdown chart showing ${data.length} categories`} style={{ alignItems: "center" }}><ExpensePieChart items={data} total={total} /></View>
    <View style={{ gap: 8, marginTop: 14 }}>{data.map((item, index) => <View key={item.label} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
      <View style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length], borderRadius: 4, height: 10, width: 10 }} />
      <Text style={{ color: P.muted, flex: 1, fontFamily: "Manrope", fontSize: 12 }}>{item.label}</Text>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{Math.round(item.amountCentavos / total * 100)}%</Text>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{money(item.amountCentavos)}</Text>
    </View>)}</View>
  </View> : <LoadingValue>No expenses to break down in this period.</LoadingValue>}</State></Section>;
}

export function AccountSummarySection({ userId, comparison, refreshKey }: { userId: string; comparison: CashFlowComparison } & RefreshProps) {
  const { data, loading, error } = useReportData(async () => {
    const [current, previous] = await Promise.all([getAccountSummary(userId), getAccountBalanceAt(userId, comparison.range.endDate)]);
    return { current, previous };
  }, [userId, comparison.range.endDate, refreshKey]);
  return <Section title="Accounts"><State loading={loading} error={error}>{data ? <View style={{ marginTop: 14 }}>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{data.current.accountCount} active {data.current.accountCount === 1 ? "account" : "accounts"}</Text>
    <ComparisonMetric label="Total balance" current={data.current.balanceCentavos} previous={data.previous.balanceCentavos} comparisonLabel={comparison.label} />
  </View> : null}</State></Section>;
}

export function BudgetActualSection({ userId, range, refreshKey }: { userId: string; range: ReportRange } & RefreshProps) {
  const { data, loading, error } = useReportData(() => getBudgetActualSummary(userId, range), [userId, range.startDate, range.endDate, refreshKey]);
  return <Section title="Budget versus actual"><State loading={loading} error={error}>{data ? <View style={{ marginTop: 14, gap: 8 }}>
    <Metric label="Planned" value={money(data.plannedCentavos)} />
    <Metric label="Actual spending" value={money(data.actualCentavos)} />
    <Metric label={data.varianceCentavos >= 0 ? "Under budget" : "Over budget"} value={money(Math.abs(data.varianceCentavos))} color={data.varianceCentavos >= 0 ? P.positive : P.negative} strong />
  </View> : <LoadingValue>No budget overlaps this reporting period.</LoadingValue>}</State></Section>;
}

export function ForecastActualSection({ userId, refreshKey }: { userId: string } & RefreshProps) {
  const { data, loading, error } = useReportData(async () => {
    const snapshot = await getSnapshot(userId, "forecast");
    const forecast = getForecastContent(snapshot);
    const forecastCentavos = forecast?.forecasts.reduce((total, point) => total + point.amountCentavos, 0) ?? null;
    return { forecastCentavos, month: forecast?.forecasts[0]?.month ?? null, categoryCount: new Set(forecast?.forecasts.map((point) => point.category)).size, stale: snapshot?.stale ?? false };
  }, [userId, refreshKey]);
  return <Section title="Next-month spending plan"><State loading={loading} error={error}>{data?.forecastCentavos != null ? <View style={{ marginTop: 14, gap: 8 }}>
    <Metric label={`${data.month ?? "Next month"} projected spending`} value={money(data.forecastCentavos)} />
    <Metric label="Forecasted categories" value={String(data.categoryCount)} />
    {data.stale ? <LoadingValue>Forecast data may be out of date.</LoadingValue> : null}
  </View> : <LoadingValue>Refresh to generate a category plan for next month.</LoadingValue>}</State></Section>;
}

export function SavingsProgressSection({ userId, refreshKey }: { userId: string } & RefreshProps) {
  const { data, loading, error } = useReportData(() => getSavingsSummary(userId), [userId, refreshKey]);
  const percent = data && data.targetCentavos > 0 ? Math.min(100, Math.round(data.currentCentavos / data.targetCentavos * 100)) : 0;
  return <Section title="Savings progress"><State loading={loading} error={error}>{data?.targetCentavos ? <View style={{ marginTop: 14 }}>
    <Metric label="Saved" value={money(data.currentCentavos)} />
    <Metric label="Goal target" value={money(data.targetCentavos)} />
    <Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 13, fontWeight: "800", marginTop: 10 }}>{percent}% of combined goals funded</Text>
  </View> : <LoadingValue>No active savings goals yet.</LoadingValue>}</State></Section>;
}

export function DebtSummarySection({ userId, refreshKey }: { userId: string } & RefreshProps) {
  const { data, loading, error } = useReportData(() => getDebtSummary(userId), [userId, refreshKey]);
  return <Section title="Debt summary"><State loading={loading} error={error}>{data?.openingCentavos ? <View style={{ marginTop: 14, gap: 8 }}>
    <Metric label="Opening balance" value={money(data.openingCentavos)} />
    <Metric label="Paid down" value={money(data.paidCentavos)} color={P.positive} />
    <Metric label="Remaining" value={money(data.remainingCentavos)} strong />
  </View> : <LoadingValue>No active debt accounts yet.</LoadingValue>}</State></Section>;
}

export function CategoryBreakdownSection({ userId, range, refreshKey }: { userId: string; range: ReportRange } & RefreshProps) {
  const { data, loading, error } = useReportData(() => listCategoryBreakdown(userId, range), [userId, range.startDate, range.endDate, refreshKey]);
  return <Section title="Top spending categories"><State loading={loading} error={error}>{data?.length ? <View style={{ marginTop: 12, gap: 9 }}>{data.map((item) => <Metric key={item.label} label={item.label} value={money(item.amountCentavos)} />)}</View> : <LoadingValue>No categorised expenses in this period.</LoadingValue>}</State></Section>;
}

export function AllocationSummarySection({ userId, range, refreshKey }: { userId: string; range: ReportRange } & RefreshProps) {
  const { data, loading, error } = useReportData(() => getAllocationSummary(userId, range), [userId, range.startDate, range.endDate, refreshKey]);
  return <Section title="Current-cycle allocations"><State loading={loading} error={error}>{data ? <View style={{ marginTop: 14, gap: 8 }}>
    <Metric label="Categories" value={money(data.categoryCentavos)} />
    <Metric label="Debt" value={money(data.debtCentavos)} />
    <Metric label="Savings" value={money(data.savingsCentavos)} />
    <Metric label="Unallocated" value={money(data.unallocatedCentavos)} strong />
  </View> : <LoadingValue>No budget overlaps this reporting period.</LoadingValue>}</State></Section>;
}

function Metric({ label, value, color = P.ink, strong = false }: { label: string; value: string; color?: string; strong?: boolean }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={{ color: P.muted, flex: 1, fontFamily: "Manrope", fontSize: 12 }}>{label}</Text><Text style={{ color, fontFamily: "Manrope", fontSize: 12, fontWeight: strong ? "800" : "700" }}>{value}</Text></View>;
}

function ComparisonMetric({ label, current, previous, comparisonLabel }: { label: string; current: number; previous: number; comparisonLabel: string }) {
  const difference = current - previous;
  const hasBaseline = previous !== 0;
  const percentage = hasBaseline ? Math.abs(difference / previous * 100).toFixed(1) : null;
  const isIncrease = difference >= 0;
  if (previous === 0) {
    return <View style={{ marginTop: 10 }}><Metric label={label} value={money(current)} strong /><LoadingValue>{current === 0 ? `No change from ${comparisonLabel}.` : `No prior value for ${comparisonLabel}.`}</LoadingValue></View>;
  }
  return <View style={{ marginTop: 10 }}>
    <Metric label={label} value={money(current)} strong />
    <View style={{ alignItems: "center", flexDirection: "row", gap: 4, marginTop: 5 }}>
      {isIncrease ? <ArrowUpRight size={14} color={P.positive} weight="bold" /> : <ArrowDownLeft size={14} color={P.negative} weight="bold" />}
      <Text style={{ color: isIncrease ? P.positive : P.negative, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>{percentage}%</Text>
      <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>vs {comparisonLabel}</Text>
    </View>
  </View>;
}

function ExpensePieChart({ items, total }: { items: { amountCentavos: number }[]; total: number }) {
  let startAngle = -Math.PI / 2;
  return <Svg width={172} height={172} viewBox="0 0 172 172" accessibilityRole="image">
    {items.map((item, index) => {
      const endAngle = startAngle + item.amountCentavos / total * Math.PI * 2;
      const path = pieSlicePath(86, 86, 70, startAngle, endAngle);
      startAngle = endAngle;
      return <Path key={index} d={path} fill={PIE_COLORS[index % PIE_COLORS.length]} />;
    })}
  </Svg>;
}

function pieSlicePath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  if (endAngle - startAngle >= Math.PI * 2 - 0.0001) return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`;
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy + radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}
