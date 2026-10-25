import React, { useState } from "react";
import { View } from "react-native";
import { Banner, TextField } from "../../components/BudgieForm";
import { useToast } from "../../components/Toast";
import { reconcileCreditCardAvailableCredit } from "../../local-db/repositories/financialFoundations";
import { Button, LinkButton } from "./debtUi";

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
    return <LinkButton label="Reconcile available credit" accessibilityLabel="Reconcile issuer available credit" onPress={() => { setEditing(true); showToast("Enter the available credit shown by your issuer, then review and confirm the authoritative change.", { color: "warning", position: "top", size: "lg" }); }} />;
  }

  return <View style={{ gap: 10 }}>
    <TextField label="Available credit from your issuer" accessibilityLabel="Issuer available credit" value={availableCredit} onChangeText={setAvailableCredit} placeholder="Enter issuer available credit" keyboardType="decimal-pad" />
    {confirming ? <>
      <Banner tone="warn">This issuer amount becomes the current forecast balance at this recorded instant. It does not edit past transactions or statements. Confirm only if it matches the issuer record.</Banner>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button flex variant="ghost" label="Cancel" onPress={() => setConfirming(false)} />
        <Button flex label="Confirm" accessibilityLabel="Confirm available credit reconciliation" onPress={() => { reconcile().catch(() => {}); }} />
      </View>
    </> : <View style={{ flexDirection: "row", gap: 10 }}>
      <Button flex variant="ghost" label="Cancel" onPress={() => setEditing(false)} />
      <Button flex label="Continue" accessibilityLabel="Continue available credit reconciliation" onPress={() => setConfirming(true)} />
    </View>}
  </View>;
}
