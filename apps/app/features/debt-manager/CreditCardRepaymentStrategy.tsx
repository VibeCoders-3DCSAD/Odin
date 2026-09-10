import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { saveCreditCardStatementStrategy, statementPaymentTargetCentavos, type CreditCardStatementStrategy } from "../../local-db/repositories/creditCardRepaymentPlans";
import type { CreditCardStatement } from "../../local-db/repositories/creditCardStatements";

const P = { brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", card: "#F1F0EB", error: "#D9001F" } as const;
const OPTIONS = [["pay_in_full", "Full Amount"], ["pay_minimum", "Minimum Due"], ["percentage_of_statement", "Percentage"], ["custom_payment", "Custom"]] as const;

function formatPeso(amount: number): string {
  return `PHP ${(amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CreditCardRepaymentStrategy({ userId, deviceId, statement, strategy, onSaved }: { userId: string; deviceId: string; statement: CreditCardStatement; strategy?: CreditCardStatementStrategy; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState(strategy?.strategy ?? "pay_in_full");
  const [percentage, setPercentage] = useState(strategy?.percentageBps == null ? "" : String(strategy.percentageBps / 100));
  const [customAmount, setCustomAmount] = useState(strategy?.customAmountCentavos == null ? "" : (strategy.customAmountCentavos / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const percentageBps = Math.round(Number(percentage) * 100);
  const customCentavos = Math.round(Number(customAmount) * 100);
  const target = statementPaymentTargetCentavos(statement, { statementId: statement.id, strategy: selected, customAmountCentavos: selected === "custom_payment" ? customCentavos : null, percentageBps: selected === "percentage_of_statement" ? percentageBps : null, version: strategy?.version ?? 0 });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveCreditCardStatementStrategy(userId, deviceId, statement.id, selected, selected === "custom_payment" ? customCentavos : null, selected === "percentage_of_statement" ? percentageBps : null);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your repayment strategy could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <View style={{ borderTopWidth: 1, borderTopColor: P.line, marginTop: 10, paddingTop: 10 }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.ink }}>Repayment strategy</Text>
    {!strategy ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.error, marginTop: 4 }}>Choose a strategy before planning this due date.</Text> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8 }}>{OPTIONS.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: selected === value }} onPress={() => setSelected(value)} style={{ borderWidth: 1, borderColor: selected === value ? P.brand : P.line, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: selected === value ? P.brand : P.ink }}>{label}</Text></Pressable>)}</View>
    {selected === "percentage_of_statement" ? <TextInput accessibilityLabel="Repayment percentage" value={percentage} onChangeText={setPercentage} placeholder="Enter repayment percentage" keyboardType="decimal-pad" style={{ backgroundColor: P.card, borderRadius: 8, padding: 9, marginTop: 8 }} /> : null}
    {selected === "custom_payment" ? <TextInput accessibilityLabel="Custom repayment amount" value={customAmount} onChangeText={setCustomAmount} placeholder="Enter custom payment amount" keyboardType="decimal-pad" style={{ backgroundColor: P.card, borderRadius: 8, padding: 9, marginTop: 8 }} /> : null}
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 7 }}>Planned target: {target === null || !Number.isFinite(target) ? "Enter a valid amount" : formatPeso(target)}</Text>
    {selected !== "pay_in_full" ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.error, marginTop: 3 }}>{selected === "custom_payment" ? "Custom payments are not recommended. " : ""}A target below the full balance may incur finance charges.</Text> : null}
    {error ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.error, marginTop: 5 }}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Save repayment strategy" disabled={saving} onPress={() => { save().catch(() => {}); }} style={{ marginTop: 8 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5, color: P.brand }}>{saving ? "Saving..." : "Save strategy"}</Text></Pressable>
  </View>;
}
