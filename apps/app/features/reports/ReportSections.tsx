import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  getAllocationSummary,
  getBudgetActualSummary,
  getDebtSummary,
  getCashOutflowDistribution,
  getSavingsSummary,
  listCategoryBreakdown,
  type ReportRange,
} from "../../local-db/repositories/reports/financialReports";
import { getLatestForecastSnapshot } from "../../local-db/repositories/forecast/forecastSnapshots";
import { listMonthlySpending, recentMonths } from "../../local-db/repositories/forecast/forecastTransactions";
import { fetchSpendingForecast } from "../forecast/fetchSpendingForecast";
import { categoryLabel } from "../forecast/QuarterlyForecastCharts";

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

export function ExpenseDistributionSection({ userId, range, refreshKey }: { userId: string; range: ReportRange } & RefreshProps) {
  const { data, loading, error } = useReportData(() => getCashOutflowDistribution(userId, range), [userId, range.startDate, range.endDate, refreshKey]);
  const total = data?.reduce((sum, item) => sum + item.amountCentavos, 0) ?? 0;
  return <Section title="Where it went"><State loading={loading} error={error}>{data?.length && total > 0 ? <View style={{ marginTop: 14 }}>
    <View accessibilityLabel={`Where it went chart showing ${data.length} categories`} style={{ alignItems: "center" }}><ExpensePieChart items={data} total={total} /></View>
    <View style={{ gap: 8, marginTop: 14 }}>{data.map((item, index) => <View key={item.label} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
      <View style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length], borderRadius: 4, height: 10, width: 10 }} />
      <Text style={{ color: P.muted, flex: 1, fontFamily: "Manrope", fontSize: 12 }}>{item.label}</Text>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{Math.round(item.amountCentavos / total * 100)}%</Text>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{money(item.amountCentavos)}</Text>
    </View>)}</View>
  </View> : <LoadingValue>No cash outflows to break down in this period.</LoadingValue>}</State></Section>;
}

// savedAt is when the saved forecast ran; null when it was recalculated from the spending before the month.
type ForecastActual = { month: string; savedAt: string | null; forecastCentavos: number; actualCentavos: number; gaps: ForecastGap[] };
type MonthForecast = { month: string; totalCentavos: number; categories: { category: string; amountCentavos: number }[]; savedAt: string | null };
type ForecastGap = { category: string; differenceCentavos: number };

// The categories that strayed furthest from last month's forecast.
const FORECAST_GAP_CATEGORIES = 3;

const NO_LAST_MONTH_FORECAST = { notice: "Last month had no earlier spending to forecast from." };

// The latest spending forecast saved during last month, as the reports chart showed it.
async function savedLastMonthForecast(userId: string, lastMonth: string): Promise<MonthForecast | null> {
  const saved = await getLatestForecastSnapshot(userId, lastMonth);
  const month = saved?.months?.find((point) => point.month === lastMonth);
  return saved && month ? { ...month, savedAt: saved.generatedAt } : null;
}

// Without a saved run, the same spending forecast is made again as of last month's first day.
async function recalculatedLastMonthForecast(userId: string, accessToken: string, lastMonth: string): Promise<MonthForecast | { notice: string }> {
  const result = await fetchSpendingForecast(userId, accessToken, { asOf: `${lastMonth}-01` });
  if ("notice" in result) return NO_LAST_MONTH_FORECAST;
  const month = result.payload.months?.find((point) => point.month === lastMonth);
  return month ? { ...month, savedAt: null } : NO_LAST_MONTH_FORECAST;
}

async function loadForecastActual(userId: string, accessToken: string): Promise<ForecastActual | { notice: string }> {
  const [lastMonth] = recentMonths(2);
  const forecast = await savedLastMonthForecast(userId, lastMonth!) ?? await recalculatedLastMonthForecast(userId, accessToken, lastMonth!);
  if ("notice" in forecast) return forecast;
  const [actual] = await listMonthlySpending(userId, [forecast.month]);
  const amounts = new Map<string, { forecastCentavos: number; actualCentavos: number }>();
  const amountsFor = (category: string) => amounts.get(category) ?? amounts.set(category, { forecastCentavos: 0, actualCentavos: 0 }).get(category)!;
  for (const point of actual?.categories ?? []) amountsFor(point.category).actualCentavos += point.amountCentavos;
  for (const point of forecast.categories) amountsFor(point.category).forecastCentavos += point.amountCentavos;
  const gaps = [...amounts].map(([category, amount]) => ({ category, differenceCentavos: amount.actualCentavos - amount.forecastCentavos }))
    .filter((gap) => Math.round(gap.differenceCentavos) !== 0)
    .sort((a, b) => Math.abs(b.differenceCentavos) - Math.abs(a.differenceCentavos))
    .slice(0, FORECAST_GAP_CATEGORIES);
  return { month: forecast.month, savedAt: forecast.savedAt, forecastCentavos: forecast.totalCentavos, actualCentavos: actual?.totalCentavos ?? 0, gaps };
}

// Last month's forecast against what was actually spent that month.
export function ForecastActualSection({ userId, accessToken, refreshKey }: { userId: string; accessToken: string } & RefreshProps) {
  const { data, loading, error } = useReportData(() => loadForecastActual(userId, accessToken), [userId, accessToken, refreshKey]);
  const result = data && "month" in data ? data : null;
  const difference = result ? result.actualCentavos - result.forecastCentavos : 0;
  return <Section title="Forecast vs actual (last month)"><State loading={loading} error={error}>{result ? <View style={{ marginTop: 14, gap: 8 }}>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{monthTitle(result.month)} · {result.savedAt ? `forecast saved ${new Date(result.savedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })}` : "forecast recalculated from your earlier spending"}</Text>
    <Metric label="Forecast" value={money(result.forecastCentavos)} />
    <Metric label="Actual spending" value={money(result.actualCentavos)} />
    <Metric label={difference > 0 ? "Over forecast" : "Under forecast"} value={money(Math.abs(difference))} color={difference > 0 ? P.negative : P.positive} strong />
    {result.gaps.length ? <View style={{ borderTopColor: P.line, borderTopWidth: 1, gap: 8, marginTop: 6, paddingTop: 10 }}>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>Biggest differences</Text>
      {result.gaps.map((gap) => <ForecastGapRow key={gap.category} gap={gap} />)}
    </View> : null}
  </View> : <LoadingValue>{data && "notice" in data ? data.notice : "No forecast for last month."}</LoadingValue>}</State></Section>;
}

function ForecastGapRow({ gap }: { gap: ForecastGap }) {
  const over = gap.differenceCentavos > 0;
  return <Metric label={categoryLabel(gap.category)} value={`${money(Math.abs(gap.differenceCentavos))} ${over ? "over" : "under"}`} color={over ? P.negative : P.positive} />;
}

function monthTitle(month: string): string {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function BudgetActualSection({ userId, range, refreshKey }: { userId: string; range: ReportRange } & RefreshProps) {
  const { data, loading, error } = useReportData(() => getBudgetActualSummary(userId, range), [userId, range.startDate, range.endDate, refreshKey]);
  return <Section title="Budget versus actual"><State loading={loading} error={error}>{data ? <View style={{ marginTop: 14, gap: 8 }}>
    <Metric label="Planned" value={money(data.plannedCentavos)} />
    <Metric label="Actual spending" value={money(data.actualCentavos)} />
    <Metric label={data.varianceCentavos >= 0 ? "Under budget" : "Over budget"} value={money(Math.abs(data.varianceCentavos))} color={data.varianceCentavos >= 0 ? P.positive : P.negative} strong />
  </View> : <LoadingValue>No budget overlaps this reporting period.</LoadingValue>}</State></Section>;
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
    <Metric label="Total spent" value={money(data.spentCentavos)} strong />
  </View> : <LoadingValue>No budget overlaps this reporting period.</LoadingValue>}</State></Section>;
}

function Metric({ label, value, color = P.ink, strong = false }: { label: string; value: string; color?: string; strong?: boolean }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={{ color: P.muted, flex: 1, fontFamily: "Manrope", fontSize: 12 }}>{label}</Text><Text style={{ color, fontFamily: "Manrope", fontSize: 12, fontWeight: strong ? "800" : "700" }}>{value}</Text></View>;
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
