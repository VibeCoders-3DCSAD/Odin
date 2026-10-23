import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../../lib/api";
import { useConnectivityStore } from "../../../services/connectivity";

type RuleAssessment = {
  status?: "SUCCESS" | "INSUFFICIENT_DATA" | "INSUFFICIENT_HISTORY";
  label?: string | null;
  value?: number | null;
};

type CreditCardAssessment = RuleAssessment & {
  account_id?: string;
  source?: "observed_history" | "self_reported";
  reported_duration?: "no_credit_card" | "always_before_due" | "1_to_11_months" | "over_a_year" | null;
};

export type Classification = {
  emergency_savings?: RuleAssessment;
  debt_burden?: RuleAssessment;
  financial_margin?: RuleAssessment;
  credit_card_behavior?: CreditCardAssessment[];
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

function describeCard(assessment: CreditCardAssessment): { title: string; detail: string; color: string } {
  if (assessment.status !== "SUCCESS") {
    return { title: "Still learning", detail: "Record twelve months of credit card statements to check how you use this card.", color: P.muted };
  }
  const months = typeof assessment.value === "number" ? assessment.value : null;
  const basis = assessment.source === "self_reported" ? " Based on what you shared during setup." : "";
  if (assessment.reported_duration === "no_credit_card") {
    return { title: "No credit card", detail: `You said you don't use a credit card.${basis}`, color: P.muted };
  }
  if (assessment.reported_duration === "always_before_due") {
    return { title: "Paid on time", detail: `You said you always pay on or before the due date.${basis}`, color: P.aqua700 };
  }
  if (assessment.reported_duration === "1_to_11_months") {
    return { title: "Sometimes carries a balance", detail: `You reported carrying an unpaid balance for 1–11 months.${basis}`, color: P.sun };
  }
  if (assessment.reported_duration === "over_a_year") {
    return { title: "Balance carried over a year", detail: `You reported carrying an unpaid balance for over a year.${basis}`, color: P.red };
  }
  if (assessment.label === "TRANSACTOR") {
    return { title: "Paid in full", detail: `You paid off the full balance every month in the last year.${basis}`, color: P.aqua700 };
  }
  if (assessment.label === "HEAVY_REVOLVER") {
    return { title: "Balance carried monthly", detail: `You carried a balance every month in the last year, so interest is likely adding up.${basis}`, color: P.red };
  }
  if (assessment.label === "REVOLVER") {
    const carried = months === null ? "You have carried a balance on this card." : `You carried a balance in ${months} of the months recorded so far.`;
    return { title: "Carries a balance", detail: `${carried} We need twelve months of statements to see how often.`, color: P.sun };
  }
  const detail = months === null ? "You carried a balance in some months of the last year." : `You carried a balance in ${months} of the last 12 months.`;
  return { title: "Sometimes carries a balance", detail: `${detail}${basis}`, color: P.sun };
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

export function FinancialHealthCard({ accessToken, initialClassification }: { accessToken: string; initialClassification?: Classification }) {
  const [classification, setClassification] = useState<Classification | null>(initialClassification ?? null);
  const [loading, setLoading] = useState(!initialClassification);
  const [error, setError] = useState<string | null>(null);
  const online = useConnectivityStore((state) => state.online);

  useEffect(() => {
    if (initialClassification) return;
    if (!online) {
      setLoading(false);
      return;
    }
    let active = true;

    async function refresh() {
      setLoading(true);
      setError(null);
      const body = await request<{ payload?: { assessment?: LatestAssessment } }>(accessToken, "/odin/api/financial-classification/v2/assess", "POST");
      if (!active) return;
      const snapshot = body?.payload?.assessment?.output_snapshot;
      if (snapshot) {
        setClassification(snapshot);
      } else {
        const latest = await request<{ payload?: { assessment?: LatestAssessment | null } }>(accessToken, "/odin/api/financial-classification/v2/latest", "GET");
        if (!active) return;
        const previous = latest?.payload?.assessment?.output_snapshot;
        if (previous) setClassification(previous);
        setError("Unable to refresh your profile. Your connection or the server may be unavailable.");
      }
      setLoading(false);
    }

    void refresh();
    return () => { active = false; };
  }, [accessToken, initialClassification, online]);

  const cards = classification?.credit_card_behavior ?? [];
  const rows = [
    ...([
      ["Emergency fund", classification?.emergency_savings],
      ["Debt burden", classification?.debt_burden],
      ["Financial margin", classification?.financial_margin],
    ] as const).map(([label, assessment]) => ({ label, ...describe(label, assessment) })),
    ...(cards.length === 0
      ? [{ label: "Credit card", ...describeCard({ status: "INSUFFICIENT_HISTORY" }) }]
      : cards.map((assessment, index) => ({ label: cards.length > 1 ? `Credit card ${index + 1}` : "Credit card", ...describeCard(assessment) }))),
  ];

  return (
    <View style={{ marginTop: 24, padding: 20, borderRadius: 32, backgroundColor: P.aqua50 }}>
      {!initialClassification && <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink, marginBottom: 12 }}>Savings &amp; Debt Profile</Text>}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <Text style={{ flex: 1, flexShrink: 1, fontFamily: "Manrope", fontSize: 12, color: P.ink2 }}>{initialClassification ? "Your financial classification, based on your questionnaire answers" : "A quick check-in using your income sources and recorded expenses"}</Text>
      </View>
      {loading ? <ActivityIndicator color={P.aqua700} /> : rows.map((item, index) => {
        const { label } = item;
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
      {error ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.red, marginTop: 12 }}>{error}</Text> : null}
    </View>
  );
}
