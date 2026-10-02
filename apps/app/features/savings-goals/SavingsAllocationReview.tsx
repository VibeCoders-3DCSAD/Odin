import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { getSavingsAllocationStrategy, saveSavingsAllocationStrategy, type SavingsAllocationStrategy } from "../../local-db/repositories/savingsAllocationPreferences";
import { getCurrentSavingsEnvelopeAllocation } from "./savingsEnvelopeAllocationQueries";
import type { SavingsAllocationProposal, SavingsEnvelopeAllocation } from "./savingsEnvelopeAllocation";

const P = { card: "#F1F0EB", ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", error: "#D9001F", white: "#FFFFFF" } as const;
const money = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount / 100);

type Props = {
  userId: string;
  deviceId: string;
  syncVersion?: number;
  onAllocationChange?: (proposals: SavingsAllocationProposal[]) => void;
};

export default function SavingsAllocationReview({ userId, deviceId, syncVersion = 0, onAllocationChange }: Props) {
  const [allocation, setAllocation] = useState<SavingsEnvelopeAllocation | null>(null);
  const [strategy, setStrategy] = useState<SavingsAllocationStrategy>("avalanche");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    setLoading(true);
    try {
      const [nextAllocation, nextStrategy] = await Promise.all([getCurrentSavingsEnvelopeAllocation(userId, today), getSavingsAllocationStrategy(userId)]);
      setAllocation(nextAllocation);
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
  if (!allocation) return <View style={{ backgroundColor: P.card, borderColor: P.line, borderWidth: 1, borderRadius: 14, gap: 8, padding: 15 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 16, fontWeight: "800" }}>Financial Plan for savings</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Create a Financial Plan to review the savings reserved for your goals.</Text></View>;

  return <View style={{ backgroundColor: P.card, borderColor: P.line, borderWidth: 1, borderRadius: 14, gap: 10, padding: 15 }}>
    <View style={{ gap: 4 }}>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 16, fontWeight: "800" }}>Financial Plan for savings</Text>
      <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Reserved for goals: {money(allocation.envelopeCentavos)} · Required: {money(allocation.requiredCentavos)}</Text>
      <Text style={{ color: allocation.shortfallCentavos > 0 ? P.error : P.brand, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{allocation.shortfallCentavos > 0 ? `Shortfall: ${money(allocation.shortfallCentavos)}` : `${money(allocation.unallocatedCentavos)} left unallocated`}</Text>
    </View>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {(["avalanche", "snowball"] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Use ${option} savings allocation`} disabled={saving} onPress={() => { selectStrategy(option).catch(() => {}); }} style={{ flex: 1, alignItems: "center", borderColor: strategy === option ? P.brand : P.line, borderRadius: 10, borderWidth: 1, padding: 11, backgroundColor: strategy === option ? P.brand : P.white }}><Text style={{ color: strategy === option ? P.white : P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{option === "avalanche" ? "Avalanche" : "Snowball"}</Text></Pressable>)}
    </View>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11 }}>Each goal below shows its Financial Plan contribution. Saving a review records the money movement.</Text>
  </View>;
}
