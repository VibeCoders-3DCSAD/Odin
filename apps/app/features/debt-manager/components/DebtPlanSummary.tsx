import { Text, View } from "react-native";
import { money } from "../formatters";

type Props = { hasCurrentBudget: boolean; debtBudgetMinor: number; requiredTotalMinor: number; surplusMinor: number; shortfallMinor: number; forecastMonths: number | null };

export function DebtPlanSummary({ hasCurrentBudget, debtBudgetMinor, requiredTotalMinor, surplusMinor, shortfallMinor, forecastMonths }: Props) {
  return <>
    {!hasCurrentBudget ? <View style={{ backgroundColor: "#FFF4D6", borderRadius: 12, padding: 12 }}><Text style={{ color: "#6B4E00", fontWeight: "700" }}>Set up a current monthly budget to plan debt payments.</Text><Text style={{ color: "#6B4E00", fontSize: 12, marginTop: 4 }}>Available debt budget is currently {money(0)}.</Text></View> : null}
    <View style={{ backgroundColor: "#F1F0EB", borderRadius: 16, padding: 14, gap: 6 }}><Text style={{ fontWeight: "700", color: "#1B1C1A" }}>Plan this cycle</Text><Text>Debt budget: {money(debtBudgetMinor)}</Text><Text>Required payments: {money(requiredTotalMinor)}</Text><Text>Surplus: {money(surplusMinor)} · Shortfall: {money(shortfallMinor)}</Text><Text style={{ color: "#6B7A6F", fontSize: 12 }}>Principal-only estimate: {forecastMonths === null ? "not available" : `${forecastMonths} month${forecastMonths === 1 ? "" : "s"} to debt-free`}</Text></View>
  </>;
}
