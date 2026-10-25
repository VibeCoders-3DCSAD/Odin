import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { CaretDown, CaretUp } from "phosphor-react-native";
import { getSavingsAllocationStrategy, saveSavingsAllocationStrategy, type SavingsAllocationStrategy } from "../../local-db/repositories/savingsAllocationPreferences";
import { getCurrentPlanBudgetRemaining, getCurrentSavingsEnvelopeAllocation } from "./savingsEnvelopeAllocationQueries";
import type { SavingsAllocationProposal, SavingsEnvelopeAllocation } from "./savingsEnvelopeAllocation";

const P = { card: "#F1F0EB", ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", error: "#D9001F", white: "#FFFFFF", soft: "#E8F3EC" } as const;
const money = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount / 100);
const STRATEGY_COPY: Record<SavingsAllocationStrategy, { label: string; description: string }> = {
  avalanche: { label: "Biggest need first", description: "Avalanche: goals with the largest required contribution get extra savings first." },
  snowball: { label: "Closest to target first", description: "Snowball: goals nearest their target get extra savings first." },
};

type Props = {
  userId: string;
  deviceId: string;
  syncVersion?: number;
  onAllocationChange?: (proposals: SavingsAllocationProposal[]) => void;
};

export default function SavingsAllocationReview({ userId, deviceId, syncVersion = 0, onAllocationChange }: Props) {
  const [allocation, setAllocation] = useState<SavingsEnvelopeAllocation | null>(null);
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<SavingsAllocationStrategy>("avalanche");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [choosingStrategy, setChoosingStrategy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    setLoading(true);
    try {
      // Budget remaining is a supporting figure, so a failed spending lookup hides it instead of the review.
      const [nextAllocation, nextStrategy, nextBudgetRemaining] = await Promise.all([getCurrentSavingsEnvelopeAllocation(userId, today), getSavingsAllocationStrategy(userId), getCurrentPlanBudgetRemaining(userId, today).catch(() => null)]);
      setAllocation(nextAllocation);
      setBudgetRemaining(nextBudgetRemaining);
      setStrategy(nextStrategy);
      onAllocationChange?.(nextAllocation?.proposals ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {
      setAllocation(null);
      onAllocationChange?.([]);
    });
  }, [userId, syncVersion]);

  async function selectStrategy(next: SavingsAllocationStrategy) {
    setSaving(true);
    try {
      await saveSavingsAllocationStrategy(userId, deviceId, next);
      setStrategy(next);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={{ minHeight: 96, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={P.brand} /></View>;
  if (!allocation) return <View style={{ backgroundColor: P.card, borderColor: P.line, borderWidth: 1, borderRadius: 14, gap: 4, padding: 14 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "800" }}>Financial Plan for savings</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Create a Financial Plan to set aside money for your goals each cycle.</Text></View>;

  const overBudget = budgetRemaining !== null && budgetRemaining < 0;
  const hasShortfall = allocation.shortfallCentavos > 0;
  return <View style={{ backgroundColor: P.white, borderColor: P.line, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 }}>
    <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "800" }}>This cycle</Text>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, marginBottom: 4 }}>From your Financial Plan, after recorded spending.</Text>
    <Row label="Budget remaining this month" value={budgetRemaining === null ? "Unavailable" : money(budgetRemaining)} alert={overBudget} />
    <Row label="Reserved for goals" value={money(allocation.envelopeCentavos)} />
    <Row label="Savings left to contribute" value={money(allocation.requiredCentavos)} />
    <Row label={hasShortfall ? "Shortfall" : "Unallocated"} value={money(hasShortfall ? allocation.shortfallCentavos : allocation.unallocatedCentavos)} alert={hasShortfall} />
    <Pressable accessibilityRole="button" accessibilityLabel="Change surplus strategy" accessibilityState={{ expanded: choosingStrategy }} onPress={() => setChoosingStrategy((current) => !current)} style={{ alignItems: "center", borderTopColor: P.line, borderTopWidth: 1, flexDirection: "row", gap: 8, marginTop: 6, paddingTop: 10 }}>
      <Text style={{ color: P.muted, flex: 1, fontFamily: "Manrope", fontSize: 12 }}>Extra savings go to</Text>
      <Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{STRATEGY_COPY[strategy].label}</Text>
      {choosingStrategy ? <CaretUp size={14} color={P.brand} /> : <CaretDown size={14} color={P.brand} />}
    </Pressable>
    {choosingStrategy ? <View style={{ gap: 6, paddingTop: 8 }}>
      {(["avalanche", "snowball"] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Use ${option} savings allocation`} accessibilityState={{ selected: strategy === option }} disabled={saving} onPress={() => { selectStrategy(option).then(() => setChoosingStrategy(false)).catch(() => {}); }} style={{ backgroundColor: strategy === option ? P.soft : P.card, borderColor: strategy === option ? P.brand : P.line, borderRadius: 10, borderWidth: 1, gap: 2, opacity: saving ? 0.6 : 1, padding: 10 }}>
        <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{STRATEGY_COPY[option].label}</Text>
        <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11 }}>{STRATEGY_COPY[option].description}</Text>
      </Pressable>)}
    </View> : null}
  </View>;
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-between", paddingVertical: 5 }}><Text style={{ color: P.muted, flexShrink: 1, fontFamily: "Manrope", fontSize: 12 }}>{label}</Text><Text accessibilityRole={alert ? "alert" : undefined} style={{ color: alert ? P.error : P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{value}</Text></View>;
}
