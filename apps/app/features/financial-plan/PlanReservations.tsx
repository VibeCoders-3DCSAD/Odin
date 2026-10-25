import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { formatPeso, reservationLabel } from "./financialPlanPresentation";
import { commitmentKey, parseBudgetAmount } from "./helpers/commitmentBudget";
import { commitmentPayments, type CommitmentPaymentStatus, type PlanCommitmentPayments } from "./helpers/commitmentPayments";
import type { FinancialPlanReservation } from "./types";

type Props = {
  title: string; description: string; reservations: FinancialPlanReservation[];
  requirements?: FinancialPlanReservation[]; surplusCentavos?: number;
  onReservationAmountChange?: (index: number, amount: string) => void;
  onValidityChange?: (key: string, valid: boolean) => void;
  onSurplusAmountChange?: (amount: string) => void;
  showSurplus?: boolean; emptyText?: string;
  showUnderfundedWarnings?: boolean;
  // Paid amounts keyed like commitments; when given, each row shows whether it is paid, partially paid or unpaid.
  payments?: PlanCommitmentPayments;
};

const PAYMENT_STATUS: Record<CommitmentPaymentStatus, { label: string; background: string; text: string }> = {
  paid: { label: "Paid", background: "#E3F2EA", text: "#0E6D46" },
  partial: { label: "Partially paid", background: "#FFF8E7", text: "#6F4A00" },
  unpaid: { label: "Unpaid", background: "#ECEDEA", text: "#414942" },
};

// A blank field means nothing is set aside yet, so zero amounts show as empty instead of "0.00".
const formatDraft = (amount: number) => amount === 0 ? "" : (amount / 100).toFixed(2);
const parseDraft = (value: string) => value.trim() === "" ? 0 : parseBudgetAmount(value);

function BudgetAmountField({ label, amount, onChange, onValidityChange }: { label: string; amount: number; onChange: (value: string) => void; onValidityChange?: (valid: boolean) => void }) {
  const [draft, setDraft] = useState(formatDraft(amount));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft((current) => parseDraft(current) === amount ? current : formatDraft(amount)); }, [amount]);
  const invalid = parseDraft(draft) === null;
  return <View style={{ flexBasis: 112 }}>
    <Text style={{ color: "#416153", fontFamily: "Manrope", fontSize: 11 }}>Amount for this plan (PHP)</Text>
    <TextInput value={draft} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}
      onChangeText={(value) => {
        setDraft(value);
        const valid = parseDraft(value) !== null;
        onValidityChange?.(valid);
        if (valid) onChange(value.trim() === "" ? "0" : value);
      }} accessibilityLabel={label} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A938C"
      style={{ height: 40, borderWidth: 1, borderColor: invalid ? "#D9001F" : "#D6D8D4", borderRadius: 9, paddingHorizontal: 9, fontFamily: "Manrope", color: "#1B1C1A", textAlign: "right", backgroundColor: "#FFFFFF", marginTop: 4 }} />
    {invalid ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontSize: 11 }}>Enter a valid amount.</Text> : null}
  </View>;
}

export function PlanReservations({ title, description, reservations, requirements = [], surplusCentavos = 0, onReservationAmountChange, onValidityChange, onSurplusAmountChange, showSurplus = true, emptyText = "No scheduled commitments for this month.", showUnderfundedWarnings = true, payments }: Props) {
  const dueAmounts = new Map(requirements.map((row) => [commitmentKey(row), row.amountCentavos]));
  const paymentStatuses = payments ? commitmentPayments(reservations, requirements, payments) : null;
  const total = reservations.reduce((sum, reservation) => sum + reservation.amountCentavos, 0) + surplusCentavos;
  return <View style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text accessibilityRole="header" style={{ flex: 1, fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#1B1C1A" }}>{title}</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>{formatPeso(total)}</Text>
    </View>
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, lineHeight: 17, color: "#6B7A6F", marginTop: 4 }}>{description}</Text>
    {reservations.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 6 }}>{emptyText}</Text> : null}
    {reservations.map((row, index) => {
      const key = commitmentKey(row);
      const due = dueAmounts.get(key);
      const payment = paymentStatuses?.get(key);
      const status = payment ? PAYMENT_STATUS[payment.status] : null;
      return <View key={key} style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#414942" }}>{reservationLabel(row)}</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F", marginTop: 2 }}>{row.dueDate ? `Due ${row.dueDate}` : "No scheduled date"}</Text>
            {due !== undefined ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F", marginTop: 2 }}>{row.savingsGoalId ? "Scheduled contribution" : "Amount due"}: {formatPeso(due)}</Text> : null}
            {payment && status ? <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              <View accessibilityLabel={`${reservationLabel(row)}: ${status.label}`} style={{ backgroundColor: status.background, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 10.5, color: status.text }}>{status.label}</Text></View>
              <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F" }}>Paid {formatPeso(payment.paidCentavos)} of {formatPeso(payment.dueCentavos)}</Text>
            </View> : null}
          </View>
          {onReservationAmountChange ? <BudgetAmountField label={`${reservationLabel(row)} budget amount in pesos`} amount={row.amountCentavos} onChange={(amount) => onReservationAmountChange(index, amount)} onValidityChange={(valid) => onValidityChange?.(key, valid)} /> : <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#1B1C1A" }}>{formatPeso(row.amountCentavos)}</Text>}
        </View>
        {showUnderfundedWarnings && due !== undefined && row.amountCentavos < due ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 11, color: "#B45309", marginTop: 6 }}>{row.savingsGoalId ? "This contribution is below your schedule and may delay your goal." : "This budget is below the amount due and may result in a missed payment."}</Text> : null}
      </View>;
    })}
    {showSurplus ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>
      <Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>Extra amount</Text>
      {onSurplusAmountChange ? <BudgetAmountField label={`${title} surplus amount in pesos`} amount={surplusCentavos} onChange={onSurplusAmountChange} onValidityChange={(valid) => onValidityChange?.(`${title}:surplus`, valid)} /> : <Text>{formatPeso(surplusCentavos)}</Text>}
    </View> : null}
  </View>;
}
