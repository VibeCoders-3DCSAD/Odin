import { useState } from "react";
import { Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit/v2";
import type { ForecastPayload } from "./types";

const CHART_HEIGHT = 280;
const SERIES_COLORS = ["#08B16A", "#2B6CB0", "#D97706", "#9F4DAD"];

type ChartRow = { date: string; [key: string]: string | number };

function formatPeso(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH", { notation: "compact", maximumFractionDigits: 1 })}`;
}

export function ForecastLineChart({ forecast }: { forecast: ForecastPayload }) {
  const [width, setWidth] = useState(0);
  const labels = [...new Set(forecast.forecasts.map((point) => point.date))];
  const series = [...forecast.forecasts.reduce((groups, point) => {
    const label = point.category ?? "Total";
    const values = groups.get(label) ?? new Map<string, number>();
    values.set(point.date, point.amountCentavos / 100);
    groups.set(label, values);
    return groups;
  }, new Map<string, Map<string, number>>()).entries()];
  const data: ChartRow[] = labels.map((date) => {
    const row: ChartRow = { date };
    series.forEach(([, values], index) => { row[`series-${index}`] = values.get(date) ?? 0; });
    return row;
  });

  return <View style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>Forecast spending</Text><View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={{ height: CHART_HEIGHT, marginTop: 10 }}>{width > 0 ? <LineChart data={data} xKey="date" series={series.map(([label], index) => ({ yKey: `series-${index}`, label, color: SERIES_COLORS[index % SERIES_COLORS.length] }))} width={width} height={CHART_HEIGHT} formatXLabel={(value) => String(value).slice(5)} formatYLabel={formatPeso} yAxisLabelWidth="stable" showHorizontalGridLines legend={series.length > 1 ? { position: "bottom", wrap: true } : false} labelStrategy="auto" edgeLabelPolicy="shift" dots={{ radius: 3, fill: "series" }} activeDot={{ radius: 5, fill: "background", stroke: "series" }} interaction={{ mode: "tap", selectionPersistence: "whileActive" }} tooltip={{ shared: true }} crosshair accessibilityLabel={`Forecast spending chart with date X axis, Philippine peso Y axis, ${labels.length} periods, and ${series.length} series`} /> : null}</View></View>;
}
