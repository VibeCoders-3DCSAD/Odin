import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../../lib/api";

type RuleAssessment = {
  status?: "SUCCESS" | "INSUFFICIENT_DATA" | "INSUFFICIENT_HISTORY";
  label?: string | null;
  value?: number | null;
};

type Classification = {
  emergency_savings?: RuleAssessment;
  debt_burden?: RuleAssessment;
  financial_margin?: RuleAssessment;
};

type LatestAssessment = { output_snapshot?: Classification };

const P = {
  aqua50: "#EFFEF7",
  aqua700: "#066B40",
  ink: "#1B1C1A",
  ink2: "#414942",
  line: "#EAEAE6",
  muted: "#6B7A6F",
  red: "#D9001F",
  sun: "#C25E00",
};

function describe(label: string, assessment?: RuleAssessment): { title: string; detail: string; color: string } {
  if (!assessment || assessment.status !== "SUCCESS") {
    return { title: "Still learning", detail: "Add an income source and record expenses for three full months to check this.", color: P.muted };
  }
  if (label === "Emergency fund") {
    const months = typeof assessment.value === "number" ? `Your emergency savings could cover about ${assessment.value.toFixed(1)} months of expenses.` : "Your emergency savings coverage has been calculated.";
    return { title: assessment.label === "EMERGENCY_FUND_ADEQUATE" ? "Good safety net" : "Build your safety net", detail: months, color: assessment.label === "EMERGENCY_FUND_ADEQUATE" ? P.aqua700 : P.sun };
  }
  if (label === "Debt burden") {
    const percent = typeof assessment.value === "number" ? `Required debt payments use ${Math.round(assessment.value * 100)}% of your monthly income.` : "Your required debt payments have been compared with your income.";
    return { title: assessment.label === "FINANCIALLY_OVERBURDENED" ? "Debt needs attention" : "Debt is manageable", detail: percent, color: assessment.label === "FINANCIALLY_OVERBURDENED" ? P.red : P.aqua700 };
  }
  const amount = typeof assessment.value === "number"
    ? assessment.value < 0
      ? `You are short by PHP ${Math.abs(assessment.value).toLocaleString("en-PH", { maximumFractionDigits: 0 })} after monthly expenses and debt payments.`
      : `You have PHP ${assessment.value.toLocaleString("en-PH", { maximumFractionDigits: 0 })} left after monthly expenses and debt payments.`
    : "Your monthly income, expenses, and debt payments have been compared.";
  return { title: assessment.label === "NEGATIVE_FINANCIAL_MARGIN" ? "Spending is too tight" : "You have breathing room", detail: amount, color: assessment.label === "NEGATIVE_FINANCIAL_MARGIN" ? P.red : P.aqua700 };
}

async function request<T>(accessToken: string, path: string, method: "GET" | "POST"): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function FinancialHealthCard({ accessToken }: { accessToken: string }) {
  const [classification, setClassification] = useState<Classification | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<{ payload?: { assessment?: LatestAssessment | null } }>(accessToken, "/odin/api/financial-classification/v2/latest", "GET")
      .then((body) => setClassification(body?.payload?.assessment?.output_snapshot ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    const body = await request<{ payload?: { assessment?: LatestAssessment } }>(accessToken, "/odin/api/financial-classification/v2/assess", "POST");
    if (!body?.payload?.assessment?.output_snapshot) {
      setError("Could not refresh your financial health right now.");
    } else {
      setClassification(body.payload.assessment.output_snapshot);
    }
    setRefreshing(false);
  }

  const rows = [
    ["Emergency fund", classification?.emergency_savings],
    ["Debt burden", classification?.debt_burden],
    ["Financial margin", classification?.financial_margin],
  ] as const;

  return (
    <View style={{ marginTop: 24, padding: 20, borderRadius: 32, backgroundColor: P.aqua50 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <View style={{ flex: 1, flexShrink: 1 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>Financial health</Text>
          <Text style={{ flexShrink: 1, fontFamily: "Manrope", fontSize: 12, color: P.ink2, marginTop: 2 }}>A quick check-in using your income sources and recorded expenses</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh financial health" onPress={refresh} disabled={refreshing} style={{ marginLeft: 12 }}>
          {refreshing ? <ActivityIndicator color={P.aqua700} /> : <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.aqua700 }}>Update</Text>}
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={P.aqua700} /> : rows.map(([label, assessment], index) => {
        const item = describe(label, assessment);
        return (
          <View key={label} style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: P.line, paddingTop: index === 0 ? 0 : 12, marginTop: index === 0 ? 0 : 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <Text style={{ flex: 1, flexShrink: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: P.ink }}>{label}</Text>
              <Text style={{ flex: 1, flexShrink: 1, fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: item.color, textAlign: "right" }}>{item.title}</Text>
            </View>
            <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.ink2, marginTop: 3 }}>{item.detail}</Text>
          </View>
        );
      })}
      {error ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.red, marginTop: 12 }}>We could not update this right now. Please try again.</Text> : null}
    </View>
  );
}
