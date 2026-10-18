import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { getSafeToSpend, type SafeToSpend } from "../../../local-db/repositories/safeToSpend";
import { formatPeso, formatPesoCompact } from "../dashboardFormatting";

const P = {
  brand: "#013220",
  ink: "#1B1C1A",
  ink2: "#414942",
  line: "#EAEAE6",
  card: "#F8EFDC",
  aqua600: "#08B16A",
  aqua700: "#066B40",
  sun400: "#E5A12B",
  monza600: "#D9001F",
};

type Props = {
  userId: string;
  // Changes whenever the dashboard reloads, so this card reloads with it.
  reloadKey: unknown;
  onNavigate: (page: string) => void;
};

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
}

function headline(data: SafeToSpend): { amount: string; detail: string } {
  if (data.leftCentavos < 0) return { amount: `${formatPeso(-data.leftCentavos)} over budget`, detail: `You have spent more than this cycle's plan, which ends ${shortDate(data.periodEnd)}.` };
  if (data.leftCentavos === 0) return { amount: "No budget left", detail: `You have used this cycle's plan, which ends ${shortDate(data.periodEnd)}.` };
  return {
    amount: `${formatPeso(data.leftCentavos)} left until ${shortDate(data.periodEnd)}`,
    detail: data.daysLeft === 1 ? `About ${formatPeso(data.dailyCentavos)} for today.` : `About ${formatPeso(data.dailyCentavos)} a day for ${data.daysLeft} days.`,
  };
}

export function SafeToSpendCard({ userId, reloadKey, onNavigate }: Props) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; data: SafeToSpend | null }>({ status: "loading" });

  useEffect(() => {
    let current = true;
    void getSafeToSpend(userId, localToday())
      .then((data) => { if (current) setState({ status: "ready", data }); })
      .catch(() => { if (current) setState({ status: "error" }); });
    return () => { current = false; };
  }, [userId, reloadKey]);

  return <View style={{ marginTop: 24 }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink, marginBottom: 12 }}>Safe to spend</Text>
    {state.status === "loading" ? <ActivityIndicator color={P.brand} /> : null}
    {state.status === "error" ? <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.ink2 }}>Your budget could not be loaded. Refresh to try again.</Text> : null}
    {state.status === "ready" && !state.data ? <Pressable accessibilityRole="button" accessibilityLabel="Open Financial Plan" onPress={() => onNavigate("financial-plan")} style={{ padding: 20, alignItems: "center", borderRadius: 32, backgroundColor: P.card }}>
      <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.ink2, textAlign: "center" }}>Create this month's Financial Plan to see how much you can safely spend.</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.aqua700, marginTop: 6 }}>Open Financial Plan</Text>
    </Pressable> : null}
    {state.status === "ready" && state.data ? <SafeToSpendDetails data={state.data} onNavigate={onNavigate} /> : null}
  </View>;
}

function SafeToSpendDetails({ data, onNavigate }: { data: SafeToSpend; onNavigate: (page: string) => void }) {
  const { amount, detail } = headline(data);
  return <View style={{ gap: 14 }}>
    <View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: data.leftCentavos < 0 ? P.monza600 : P.brand }}>{amount}</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.ink2, marginTop: 4 }}>{detail}</Text>
    </View>
    {data.categories.map((category) => {
      const pct = Math.min(category.spentCentavos / category.plannedCentavos * 100, 100);
      const barColor = pct >= 100 ? P.monza600 : pct >= 85 ? P.sun400 : P.aqua600;
      return <View key={category.allocationId}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.ink2 }}>{category.label}</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2 }}>{formatPesoCompact(category.spentCentavos)} / {formatPesoCompact(category.plannedCentavos)}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 6, backgroundColor: P.line, overflow: "hidden" }}>
          <View style={{ width: `${pct}%`, height: "100%", borderRadius: 6, backgroundColor: barColor }} />
        </View>
      </View>;
    })}
    <Pressable accessibilityRole="button" accessibilityLabel="Open Financial Plan" onPress={() => onNavigate("financial-plan")}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.aqua700 }}>View all budgets</Text>
    </Pressable>
  </View>;
}
