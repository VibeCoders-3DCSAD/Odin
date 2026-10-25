import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner, FormCard, Note, TextField, styles as ui } from "../../components/BudgieForm";
import { saveCreditCardStrategy, statementPaymentTargetCentavos, type CreditCardStrategy } from "../../local-db/repositories/creditCardRepaymentPlans";
import type { CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import { Button, InfoRow, formatPeso } from "./debtUi";

const OPTIONS = [["pay_in_full", "Full Amount"], ["pay_minimum", "Minimum Due"], ["percentage_of_statement", "Percentage"], ["custom_payment", "Custom"]] as const;

type Props = {
  userId: string;
  deviceId: string;
  accountId: string;
  statement?: CreditCardStatement;
  strategy?: CreditCardStrategy;
  onPreviewChange?: (strategy: CreditCardStrategy) => void;
  onSaved: () => Promise<void>;
};

export default function CreditCardRepaymentStrategy({ userId, deviceId, accountId, statement, strategy, onPreviewChange, onSaved }: Props) {
  const [selected, setSelected] = useState(strategy?.strategy ?? "pay_in_full");
  const [percentage, setPercentage] = useState(strategy?.percentageBps == null ? "" : String(strategy.percentageBps / 100));
  const [customAmount, setCustomAmount] = useState(strategy?.customAmountCentavos == null ? "" : (strategy.customAmountCentavos / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const percentageBps = Math.round(Number(percentage) * 100);
  const customCentavos = Math.round(Number(customAmount) * 100);
  const target = statement ? statementPaymentTargetCentavos(statement, { accountId, strategy: selected, customAmountCentavos: selected === "custom_payment" ? customCentavos : null, percentageBps: selected === "percentage_of_statement" ? percentageBps : null, version: strategy?.version ?? 0 }) : null;

  function preview(nextStrategy: CreditCardStrategy["strategy"], nextPercentage = percentage, nextCustomAmount = customAmount) {
    const nextPercentageBps = Math.round(Number(nextPercentage) * 100);
    const nextCustomCentavos = Math.round(Number(nextCustomAmount) * 100);
    onPreviewChange?.({
      accountId,
      strategy: nextStrategy,
      customAmountCentavos: nextStrategy === "custom_payment" && Number.isFinite(nextCustomCentavos) && nextCustomCentavos > 0 ? nextCustomCentavos : null,
      percentageBps: nextStrategy === "percentage_of_statement" && Number.isFinite(nextPercentageBps) && nextPercentageBps > 0 && nextPercentageBps <= 10_000 ? nextPercentageBps : null,
      version: strategy?.version ?? 0,
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveCreditCardStrategy(userId, deviceId, accountId, selected, selected === "custom_payment" ? customCentavos : null, selected === "percentage_of_statement" ? percentageBps : null);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your repayment strategy could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <FormCard title="Repayment strategy">
    <Note>Applies to every billing cycle for this card. Installment amortization is tracked separately.</Note>
    <View accessibilityRole="radiogroup" style={ui.chips}>{OPTIONS.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected: selected === value }} onPress={() => { setSelected(value); preview(value); }} style={[ui.chip, selected === value ? ui.chipOn : null]}><Text style={[ui.chipText, selected === value ? ui.chipTextOn : null]}>{label}</Text></Pressable>)}</View>
    {selected === "percentage_of_statement" ? <TextField label="Percentage of statement" suffix="%" accessibilityLabel="Repayment percentage" value={percentage} onChangeText={(value) => { setPercentage(value); preview(selected, value, customAmount); }} placeholder="Enter repayment percentage" keyboardType="decimal-pad" /> : null}
    {selected === "custom_payment" ? <TextField label="Custom amount" accessibilityLabel="Custom repayment amount" value={customAmount} onChangeText={(value) => { setCustomAmount(value); preview(selected, percentage, value); }} placeholder="Enter custom payment amount" keyboardType="decimal-pad" /> : null}
    {statement ? <InfoRow label="Current statement target" value={target === null || !Number.isFinite(target) ? "Enter a valid amount" : formatPeso(target)} /> : null}
    {selected !== "pay_in_full" ? <Banner tone="warn">{`${selected === "custom_payment" ? "Custom payments are not recommended. " : ""}A target below the full balance may incur finance charges.`}</Banner> : null}
    {error ? <Banner tone="error">{error}</Banner> : null}
    <Button variant="ghost" label={saving ? "Saving..." : "Save strategy"} accessibilityLabel="Save repayment strategy" disabled={saving} onPress={() => { save().catch(() => {}); }} />
  </FormCard>;
}
