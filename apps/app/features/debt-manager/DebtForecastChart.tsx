import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";

const CHART_HEIGHT = 220;
const PADDING = { top: 20, right: 12, bottom: 30, left: 58 };

function formatAxisValue(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { notation: "compact", maximumFractionDigits: 1 })}`;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatPeso(amount: number): string {
  return `PHP ${(amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trendColor(status: ForecastStatus): string {
  if (status === "ahead" || status === "paid_off") return "#087443";
  if (status === "behind") return "#B45309";
  return "#2563EB";
}

type Props = {
  points: ForecastChartPoint[];
  status: ForecastStatus;
  today: string;
  width: number;
  colorMode: "blue" | "status";
  targetDate?: string;
};

export type ForecastStatus = "ahead" | "on_schedule" | "on_track" | "behind" | "paid_off" | "not_scheduled";
export type ForecastChartPoint = { id: string; date: string; balanceCentavos: number; isForecast: boolean };

export function DebtForecastChart({ points, status, today, width, colorMode, targetDate }: Props) {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const color = colorMode === "blue" ? "#2563EB" : trendColor(status);
  const forecastStartIndex = points.findIndex((point) => point.isForecast);
  const balances = points.map((point) => Number.isFinite(point.balanceCentavos) ? Math.max(0, point.balanceCentavos) / 100 : 0);
  const maximum = Math.max(1, ...balances);
  const plotWidth = Math.max(1, width - PADDING.left - PADDING.right);
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const x = (index: number) => PADDING.left + (points.length <= 1 ? 0 : index * plotWidth / (points.length - 1));
  const y = (balance: number) => PADDING.top + (maximum - balance) * plotHeight / maximum;
  const coordinates = (start: number, end: number) => points.slice(start, end).map((_, index) => `${x(start + index)},${y(balances[start + index]!)}`).join(" ");
  const todayIndex = points.findIndex((point) => point.date >= today);
  const markerIndex = todayIndex < 0 ? points.length - 1 : todayIndex;
  const labels = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const selectedPoint = points.find((point) => point.id === selectedPointId);
  const selectedIndex = points.findIndex((point) => point.id === selectedPointId);
  const tooltipX = selectedIndex < 0 ? 0 : Math.min(width - PADDING.right - 132, x(selectedIndex) + 8);
  const tooltipY = selectedIndex < 0 ? 0 : Math.min(CHART_HEIGHT - PADDING.bottom - 46, y(balances[selectedIndex]!) + 8);
  const targetAfterIndex = targetDate ? points.findIndex((point) => point.date >= targetDate) : -1;
  const targetMarkerX = targetDate && targetAfterIndex >= 0 && targetDate >= points[0]!.date
    ? targetAfterIndex === 0 || points[targetAfterIndex]!.date === targetDate
      ? x(targetAfterIndex)
      : (() => {
          const before = points[targetAfterIndex - 1]!;
          const after = points[targetAfterIndex]!;
          const span = Date.parse(`${after.date}T00:00:00.000Z`) - Date.parse(`${before.date}T00:00:00.000Z`);
          const elapsed = Date.parse(`${targetDate}T00:00:00.000Z`) - Date.parse(`${before.date}T00:00:00.000Z`);
          return x(targetAfterIndex - 1) + (span > 0 ? elapsed / span : 0) * (x(targetAfterIndex) - x(targetAfterIndex - 1));
        })()
    : null;

  return <View accessibilityLabel={`Debt trend with actual balance through today and forecast after today. Status: ${status.replace("_", " ")}.`} style={{ height: CHART_HEIGHT }}>
    <Svg width={width} height={CHART_HEIGHT}>
      {[0, maximum / 2, maximum].map((value, index) => <React.Fragment key={`grid-${index}`}>
        <Line x1={PADDING.left} x2={width - PADDING.right} y1={y(value)} y2={y(value)} stroke="#EAEAE6" strokeWidth={1} />
        <SvgText x={PADDING.left - 7} y={y(value) + 4} fill="#6B7A6F" fontSize={10} textAnchor="end">{formatAxisValue(value)}</SvgText>
      </React.Fragment>)}
      {forecastStartIndex === -1 ? <Polyline points={coordinates(0, points.length)} fill="none" stroke={color} strokeWidth={2.5} /> : null}
      {forecastStartIndex > 0 ? <Polyline points={coordinates(0, forecastStartIndex)} fill="none" stroke={color} strokeWidth={2.5} /> : null}
      {forecastStartIndex >= 0 ? <Polyline points={coordinates(Math.max(0, forecastStartIndex - 1), points.length)} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray="7 5" /> : null}
      <Line x1={x(markerIndex)} x2={x(markerIndex)} y1={PADDING.top} y2={CHART_HEIGHT - PADDING.bottom} stroke="#6B7A6F" strokeWidth={1} strokeDasharray="3 3" />
      <SvgText x={Math.min(width - PADDING.right, x(markerIndex) + 5)} y={PADDING.top + 11} fill="#6B7A6F" fontSize={10}>Today</SvgText>
      {targetMarkerX !== null ? <><Line x1={targetMarkerX} x2={targetMarkerX} y1={PADDING.top} y2={CHART_HEIGHT - PADDING.bottom} stroke={color} strokeWidth={1} strokeDasharray="5 3" /><SvgText x={Math.min(width - PADDING.right, targetMarkerX + 5)} y={PADDING.top + 23} fill={color} fontSize={10}>Target</SvgText></> : null}
      {points.map((point, index) => <G key={point.id} accessible accessibilityRole="button" accessibilityLabel={`${point.date}, ${point.isForecast ? "forecast" : "actual"} balance ${formatPeso(point.balanceCentavos)}`} onLongPress={() => setSelectedPointId(point.id)} onPressOut={() => setSelectedPointId(null)}>
        <Circle cx={x(index)} cy={y(balances[index]!)} r={18} fill="transparent" />
        <Circle cx={x(index)} cy={y(balances[index]!)} r={forecastStartIndex === -1 || index < forecastStartIndex ? 3 : 2.5} fill={color} />
      </G>)}
      {labels.map((index) => <SvgText key={index} x={x(index)} y={CHART_HEIGHT - 8} fill="#6B7A6F" fontSize={10} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{formatDate(points[index]!.date)}</SvgText>)}
      {selectedPoint ? <G accessible accessibilityLabel={`Selected ${selectedPoint.isForecast ? "forecast" : "actual"} balance on ${selectedPoint.date}: ${formatPeso(selectedPoint.balanceCentavos)}`}>
        <Rect x={tooltipX} y={tooltipY} width={132} height={46} rx={8} fill="#1B1C1A" />
        <SvgText x={tooltipX + 8} y={tooltipY + 16} fill="#FFFFFF" fontSize={10}>{selectedPoint.date} - {selectedPoint.isForecast ? "Forecast" : "Actual"}</SvgText>
        <SvgText x={tooltipX + 8} y={tooltipY + 34} fill="#FFFFFF" fontSize={12} fontWeight="700">{formatPeso(selectedPoint.balanceCentavos)}</SvgText>
      </G> : null}
    </Svg>
  </View>;
}
