import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useToast } from "../../components/Toast";
import { reconcileCreditCardAvailableCredit } from "../../local-db/repositories/financialFoundations";

const P = { brand: "#013220", muted: "#6B7A6F", card: "#F1F0EB", error: "#D9001F" } as const;

function parseCentavos(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(amount) ? amount : null;
}

type Props = { userId: string; deviceId: string; accountId: string; creditLimitCentavos: number; onSaved: () => Promise<void> };

export default function CreditCardAvailableCreditReconciliation({ userId, deviceId, accountId, creditLimitCentavos, onSaved }: Props) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [availableCredit, setAvailableCredit] = useState("");

  async function reconcile() {
    const amount = parseCentavos(availableCredit);
    if (amount === null) {
      showToast("Enter a valid available credit amount.", "danger");
      return;
    }
    if (amount > creditLimitCentavos) {
      showToast("Available credit cannot exceed the credit limit.", "danger");
      return;
    }
    try {
      await reconcileCreditCardAvailableCredit(userId, deviceId, accountId, amount);
      await onSaved();
      setEditing(false);
      setConfirming(false);
      showToast("Issuer available credit now anchors the current forecast without changing past records.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Your issuer-reported available credit could not be reconciled.", "danger");
    }
  }

  if (!editing) {
    return <Pressable accessibilityRole="button" accessibilityLabel="Reconcile issuer available credit" onPress={() => { setEditing(true); showToast("Enter the available credit shown by your issuer, then review and confirm the authoritative change.", { color: "warning", position: "top", size: "lg" }); }} style={{ marginTop: 7 }}><Text style={{ color: P.brand, fontFamily: "Manrope", fontWeight: "700", fontSize: 12 }}>Reconcile available credit</Text></Pressable>;
  }

  return <View style={{ gap: 8, marginTop: 8 }}>
    <TextInput accessibilityLabel="Issuer available credit" value={availableCredit} onChangeText={setAvailableCredit} placeholder="Enter issuer available credit" keyboardType="decimal-pad" style={{ backgroundColor: P.card, borderRadius: 8, padding: 9 }} />
    {confirming ? <View style={{ gap: 7 }}><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.error }}>This issuer amount becomes the current forecast balance at this recorded instant. It does not edit past transactions or statements. Confirm only if it matches the issuer record.</Text><View style={{ flexDirection: "row", gap: 12 }}><Pressable onPress={() => setConfirming(false)}><Text style={{ color: P.muted, fontWeight: "700" }}>Cancel</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Confirm available credit reconciliation" onPress={() => { reconcile().catch(() => {}); }}><Text style={{ color: P.brand, fontWeight: "700" }}>Confirm reconciliation</Text></Pressable></View></View> : <View style={{ flexDirection: "row", gap: 12 }}><Pressable onPress={() => setEditing(false)}><Text style={{ color: P.muted, fontWeight: "700" }}>Cancel</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Continue available credit reconciliation" onPress={() => setConfirming(true)}><Text style={{ color: P.brand, fontWeight: "700" }}>Continue</Text></Pressable></View>}
  </View>;
}
