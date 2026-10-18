import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { QuarterlyForecastPayload } from "./types";

const P = { brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#D9E5DD", shell: "#F6FAF7" };
// Validated categorical order (CVD-separated against the report surface); colors follow the category, not its rank.
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const OTHER_COLOR = "#8A9690";
const OTHER = "other";

const CHART_HEIGHT = 180;
// The right gutter fits half of the last centered quarter label ("Q3 2027"), so it is not clipped.
const PLOT = { top: 12, right: 28, bottom: 26, left: 52 };

type Series = { key: string; label: string; color: string; values: number[] };

function formatPeso(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function compactPeso(centavos: number): string {
  const pesos = centavos / 100;
  if (pesos >= 1_000_000) return `${(pesos / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (pesos >= 1_000) return `${(pesos / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(pesos));
}

// Everyday names for the HFCE expense groups.
const CATEGORY_NAMES: Record<string, string> = {
  alcohol_tobacco: "alcohol and cigarettes",
  clothing_footwear: "clothes and shoes",
  communication: "load, phone, and internet",
  education: "school",
  food: "food and groceries",
  furnishings_household: "household items",
  health: "health and medicine",
  housing_water_utilities: "rent, water, and electricity",
  miscellaneous_goods_services: "other personal expenses",
  recreation_culture: "leisure and hobbies",
  restaurants_hotels: "eating out and hotels",
  transport: "transportation",
};

function categoryName(category: string): string {
  return CATEGORY_NAMES[category] ?? category.replaceAll("_", " ");
}

function categoryLabel(category: string): string {
  const label = categoryName(category);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const MONTH_RANGES = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];

const QUARTER_DATES = ["January 1 to March 31", "April 1 to June 30", "July 1 to September 30", "October 1 to December 31"];

function quarterDates(quarter: string): string {
  return `${QUARTER_DATES[Number(quarter.slice(5)) - 1]}, ${quarter.slice(0, 4)}`;
}

function monthRange(quarter: string): string {
  return `${MONTH_RANGES[Number(quarter.slice(5)) - 1]} ${quarter.slice(0, 4)}`;
}

function quarterLabel(quarter: string): string {
  return `${quarter.slice(4)} ${quarter.slice(0, 4)}`;
}

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value)!;
  return step * magnitude;
}

// The seven largest categories keep their own line; the rest fold into Other so no hue is generated.
export function categorySeries(forecast: QuarterlyForecastPayload): Series[] {
  const totals = new Map<string, number>();
  for (const quarter of forecast.quarters) for (const point of quarter.categories) totals.set(point.category, (totals.get(point.category) ?? 0) + point.amountCentavos);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category);
  const overflow = ranked.length > SERIES_COLORS.length;
  const named = overflow ? ranked.slice(0, SERIES_COLORS.length - 1) : ranked;
  const amountFor = (quarter: QuarterlyForecastPayload["quarters"][number], category: string) => quarter.categories.find((point) => point.category === category)?.amountCentavos ?? 0;
  // Slots follow alphabetical order so a category keeps its color as rankings shift between refreshes.
  const series = [...named].sort().map((category, index) => ({ key: category, label: categoryLabel(category), color: SERIES_COLORS[index]!, values: forecast.quarters.map((quarter) => amountFor(quarter, category)) }));
  if (overflow) series.push({ key: OTHER, label: "Other", color: OTHER_COLOR, values: forecast.quarters.map((quarter) => quarter.totalCentavos - named.reduce((sum, category) => sum + amountFor(quarter, category), 0)) });
  return series;
}

// Below this share of change, spending is described as staying about the same.
const FLAT_CHANGE = 0.01;

function shareOfTen(share: number): string {
  const tenths = Math.round(share * 10);
  if (tenths >= 10) return "almost every peso you spend";
  if (tenths < 1) return "a small part of what you spend";
  return `about ${tenths} of every 10 pesos you spend`;
}

// A plain-language reading of the forecast: where spending is headed, the costliest stretch,
// the biggest expense, and what changes the most.
export function forecastInterpretation(forecast: QuarterlyForecastPayload): string[] {
  const first = forecast.quarters[0];
  const last = forecast.quarters.at(-1);
  if (!first || !last || first === last) return [];
  const notes: string[] = [];
  const change = first.totalCentavos > 0 ? (last.totalCentavos - first.totalCentavos) / first.totalCentavos : 0;
  notes.push(Math.abs(change) < FLAT_CHANGE
    ? `Your spending will likely stay about the same, around ${formatPeso(first.totalCentavos)} every 3 months.`
    : `Your spending will likely go ${change > 0 ? "up" : "down"}. Every 3 months, it may go from about ${formatPeso(first.totalCentavos)} (${monthRange(first.quarter)}) to ${formatPeso(last.totalCentavos)} (${monthRange(last.quarter)}).`);

  const peak = forecast.quarters.reduce((highest, quarter) => quarter.totalCentavos > highest.totalCentavos ? quarter : highest);
  const low = forecast.quarters.reduce((lowest, quarter) => quarter.totalCentavos < lowest.totalCentavos ? quarter : lowest);
  if (peak.totalCentavos > low.totalCentavos) notes.push(`Your most expensive stretch will likely be ${monthRange(peak.quarter)}, at about ${formatPeso(peak.totalCentavos)}. Try to save a little extra before then.`);

  const yearTotal = forecast.quarters.reduce((sum, quarter) => sum + quarter.totalCentavos, 0);
  const amountIn = (quarter: QuarterlyForecastPayload["quarters"][number], category: string) => quarter.categories.find((point) => point.category === category)?.amountCentavos ?? 0;
  const categories = [...new Set(forecast.quarters.flatMap((quarter) => quarter.categories.map((point) => point.category)))];
  const shares = categories.map((category) => ({ category, total: forecast.quarters.reduce((sum, quarter) => sum + amountIn(quarter, category), 0), change: amountIn(last, category) - amountIn(first, category) }));
  const largest = shares.reduce<(typeof shares)[number] | null>((best, item) => !best || item.total > best.total ? item : best, null);
  if (largest && yearTotal > 0) notes.push(`${categoryLabel(largest.category)} is your biggest expense, ${shareOfTen(largest.total / yearTotal)}.`);

  const rising = shares.reduce<(typeof shares)[number] | null>((best, item) => item.change > 0 && (!best || item.change > best.change) ? item : best, null);
  const falling = shares.reduce<(typeof shares)[number] | null>((best, item) => item.change < 0 && (!best || item.change < best.change) ? item : best, null);
  if (rising) notes.push(`By ${monthRange(last.quarter)}, you may spend about ${formatPeso(rising.change)} more on ${categoryName(rising.category)} every 3 months.`);
  if (falling) notes.push(`You may spend about ${formatPeso(Math.abs(falling.change))} less on ${categoryName(falling.category)} every 3 months by ${monthRange(last.quarter)}.`);
  return notes;
}

function LineChart({ quarters, series, selected, onSelect, label }: { quarters: string[]; series: Series[]; selected: number; onSelect: (index: number) => void; label: string }) {
  const [width, setWidth] = useState(0);
  const plotWidth = Math.max(0, width - PLOT.left - PLOT.right);
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;
  const max = niceMax(Math.max(0, ...series.flatMap((line) => line.values)));
  const x = (index: number) => PLOT.left + (quarters.length === 1 ? plotWidth / 2 : index / (quarters.length - 1) * plotWidth);
  const y = (value: number) => PLOT.top + plotHeight - value / max * plotHeight;
  const ticks = [0, max / 2, max];
  const slot = quarters.length > 1 ? plotWidth / (quarters.length - 1) : plotWidth;

  return <View accessibilityLabel={label} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: CHART_HEIGHT, marginTop: 12 }}>
    {width > 0 ? <Svg width={width} height={CHART_HEIGHT} accessibilityRole="image">
      {ticks.map((tick) => <Line key={tick} x1={PLOT.left} x2={width - PLOT.right} y1={y(tick)} y2={y(tick)} stroke={P.line} strokeWidth={1} />)}
      {ticks.map((tick) => <SvgText key={`label-${tick}`} x={PLOT.left - 8} y={y(tick) + 4} fill={P.muted} fontFamily="Manrope" fontSize={10} textAnchor="end">{compactPeso(tick)}</SvgText>)}
      {quarters.map((quarter, index) => <SvgText key={quarter} x={x(index)} y={CHART_HEIGHT - 8} fill={index === selected ? P.ink : P.muted} fontFamily="Manrope" fontSize={10} fontWeight={index === selected ? "800" : "400"} textAnchor="middle">{quarterLabel(quarter)}</SvgText>)}
      <Line x1={x(selected)} x2={x(selected)} y1={PLOT.top} y2={PLOT.top + plotHeight} stroke={P.muted} strokeWidth={1} strokeDasharray="3 3" />
      {series.map((line) => <Path key={line.key} d={line.values.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`).join(" ")} fill="none" stroke={line.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
      {series.map((line) => line.values.map((value, index) => <Circle key={`${line.key}-${index}`} cx={x(index)} cy={y(value)} r={index === selected ? 5 : 4} fill={line.color} stroke={P.shell} strokeWidth={2} />))}
      {quarters.map((quarter, index) => <Rect key={`hit-${quarter}`} x={x(index) - slot / 2} y={0} width={slot} height={CHART_HEIGHT} fill="transparent" onPress={() => onSelect(index)} />)}
    </Svg> : null}
  </View>;
}

function QuarterTabs({ quarters, selected, onSelect }: { quarters: string[]; selected: number; onSelect: (index: number) => void }) {
  return <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
    {quarters.map((quarter, index) => <Pressable key={quarter} accessibilityRole="tab" accessibilityLabel={`Show ${quarterLabel(quarter)} forecast`} accessibilityState={{ selected: index === selected }} onPress={() => onSelect(index)} style={{ flex: 1, alignItems: "center", backgroundColor: index === selected ? P.brand : "#EFFEF7", borderRadius: 10, paddingVertical: 7 }}>
      <Text style={{ color: index === selected ? "#FFFFFF" : P.brand, fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>{quarterLabel(quarter)}</Text>
    </Pressable>)}
  </View>;
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <View style={{ backgroundColor: P.shell, borderColor: P.line, borderRadius: 16, borderWidth: 1, padding: 16 }}>
    <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 16, fontWeight: "800" }}>{title}</Text>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>{subtitle}</Text>
    {children}
  </View>;
}

export function QuarterlyForecastCharts({ forecast }: { forecast: QuarterlyForecastPayload }) {
  const [selected, setSelected] = useState(0);
  const quarters = forecast.quarters.map((quarter) => quarter.quarter);
  const current = forecast.quarters[selected] ?? forecast.quarters[0]!;
  const total: Series = { key: "total", label: "Total", color: P.brand, values: forecast.quarters.map((quarter) => quarter.totalCentavos) };
  const categories = categorySeries(forecast);
  const interpretation = forecast.interpretation ?? forecastInterpretation(forecast);

  return <View style={{ gap: 14, marginTop: 20 }}>
    <View>
      <QuarterTabs quarters={quarters} selected={selected} onSelect={setSelected} />
      <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 8 }}>{quarterDates(current.quarter)}</Text>
    </View>
    <Card title="Total projected spending" subtitle="All forecast categories, per quarter">
      <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 12 }}>{quarterLabel(current.quarter)}</Text>
      <Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 22, fontWeight: "800", marginTop: 2 }}>{formatPeso(current.totalCentavos)}</Text>
      <LineChart quarters={quarters} series={[total]} selected={selected} onSelect={setSelected} label={`Total projected spending for ${quarters.length} quarters`} />
    </Card>
    <Card title="Projected spending by category" subtitle="Each forecast category, per quarter">
      <LineChart quarters={quarters} series={categories} selected={selected} onSelect={setSelected} label={`Projected spending for ${categories.length} categories over ${quarters.length} quarters`} />
      <View style={{ gap: 8, marginTop: 12 }}>
        <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>{quarterLabel(current.quarter).toUpperCase()}</Text>
        {categories.map((line) => <View key={line.key} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <View style={{ backgroundColor: line.color, borderRadius: 4, height: 10, width: 10 }} />
          <Text style={{ color: P.muted, flex: 1, fontFamily: "Manrope", fontSize: 12 }}>{line.label}</Text>
          <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{formatPeso(line.values[selected] ?? 0)}</Text>
        </View>)}
      </View>
    </Card>
    {interpretation.length ? <Card title="What this means for you" subtitle="Your next 12 months, in simple terms">
      <View style={{ gap: 8, marginTop: 12 }}>{interpretation.map((note) => <View key={note} style={{ flexDirection: "row", gap: 8 }}>
        <Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>•</Text>
        <Text style={{ color: P.ink, flex: 1, fontFamily: "Manrope", fontSize: 13, lineHeight: 20 }}>{note}</Text>
      </View>)}</View>
      <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, lineHeight: 16, marginTop: 12 }}>These are estimates based on how you have spent before and on seasonal spending in the Philippines. Your actual spending may be different.</Text>
    </Card> : null}
  </View>;
}
