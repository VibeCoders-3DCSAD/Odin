import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CaretDown } from "phosphor-react-native";
import { formatPeso, reservationLabel } from "./financialPlanPresentation";
import { commitmentKey, parseBudgetAmount } from "./helpers/commitmentBudget";
import { commitmentPayments, type CommitmentPaymentStatus, type PlanCommitmentPayments } from "./helpers/commitmentPayments";
import { PlanAmountInput } from "./PlanAmountInput";
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
  // Starts folded to its total and item count; the header opens the rows.
  collapsible?: boolean;
  defaultOpen?: boolean;
};

const PAYMENT_STATUS: Record<CommitmentPaymentStatus, { label: string; background: string; text: string }> = {
  paid: { label: "Paid", background: "#E3F2EA", text: "#0E6D46" },
  partial: { label: "Partially paid", background: "#FFF8E7", text: "#6F4A00" },
  unpaid: { label: "Unpaid", background: "#ECEDEA", text: "#414942" },
};

const meta = { fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F" } as const;

// A blank field means nothing is set aside yet, so zero amounts show as empty instead of "0.00".
const formatDraft = (amount: number) => amount === 0 ? "" : (amount / 100).toFixed(2);
const parseDraft = (value: string) => value.trim() === "" ? 0 : parseBudgetAmount(value);

function BudgetAmountField({ label, amount, onChange, onValidityChange }: { label: string; amount: number; onChange: (value: string) => void; onValidityChange?: (valid: boolean) => void }) {
  const [draft, setDraft] = useState(formatDraft(amount));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft((current) => parseDraft(current) === amount ? current : formatDraft(amount)); }, [amount]);
  const invalid = parseDraft(draft) === null;
  return <View style={{ alignItems: "flex-end" }}>
    <PlanAmountInput value={draft} invalid={invalid} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}
      onChangeText={(value) => {
        setDraft(value);
        const valid = parseDraft(value) !== null;
        onValidityChange?.(valid);
        if (valid) onChange(value.trim() === "" ? "0" : value);
      }} accessibilityLabel={label} />
    {invalid ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontSize: 11, marginTop: 3 }}>Enter a valid amount.</Text> : null}
  </View>;
}

export function PlanReservations({ title, description, reservations, requirements = [], surplusCentavos = 0, onReservationAmountChange, onValidityChange, onSurplusAmountChange, showSurplus = true, emptyText = "No scheduled commitments for this month.", showUnderfundedWarnings = true, payments, collapsible = false, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(!collapsible || defaultOpen);
  const dueAmounts = new Map(requirements.map((row) => [commitmentKey(row), row.amountCentavos]));
  const paymentStatuses = payments ? commitmentPayments(reservations, requirements, payments) : null;
  const total = reservations.reduce((sum, reservation) => sum + reservation.amountCentavos, 0) + surplusCentavos;
  const belowDue = reservations.filter((row) => { const due = dueAmounts.get(commitmentKey(row)); return due !== undefined && row.amountCentavos < due; }).length;
  const header = <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
    <Text accessibilityRole="header" style={{ flex: 1, fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>{title}</Text>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>{formatPeso(total)}</Text>
    {collapsible ? <CaretDown size={14} color="#6B7A6F" weight="bold" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} /> : null}
  </View>;
  const summary = `${reservations.length} ${reservations.length === 1 ? "item" : "items"}${showUnderfundedWarnings && belowDue ? ` · ${belowDue} below amount due` : ""}`;

  return <View style={{ marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: "#EAEAE6", backgroundColor: "#FFFFFF", overflow: "hidden" }}>
    {collapsible ? <Pressable accessibilityRole="button" accessibilityLabel={`${open ? "Hide" : "Show"} ${title}`} accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)} style={{ padding: 14 }}>
      {header}
      <Text style={[meta, { marginTop: 3, color: showUnderfundedWarnings && belowDue ? "#B45309" : "#6B7A6F" }]}>{open ? description : summary}</Text>
    </Pressable> : <View style={{ padding: 14 }}>
      {header}
      <Text style={[meta, { marginTop: 3, lineHeight: 16 }]}>{description}</Text>
    </View>}
    {open ? <>
      {reservations.length === 0 ? <Text style={[meta, { paddingHorizontal: 14, paddingBottom: 14, fontSize: 12 }]}>{emptyText}</Text> : null}
      {reservations.map((row, index) => {
        const key = commitmentKey(row);
        const due = dueAmounts.get(key);
        const payment = paymentStatuses?.get(key);
        const status = payment ? PAYMENT_STATUS[payment.status] : null;
        const label = reservationLabel(row);
        return <View key={key} style={{ borderTopWidth: 1, borderTopColor: "#EFEEE8", paddingHorizontal: 14, paddingVertical: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{label}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 4, marginTop: 2 }}>
                <Text style={meta}>{row.dueDate ? `Due ${row.dueDate}` : "No scheduled date"}</Text>
                {due !== undefined ? <><Text style={meta}>·</Text><Text style={meta}>{row.savingsGoalId ? "Scheduled contribution" : "Amount due"}: {formatPeso(due)}</Text></> : null}
              </View>
              {payment && status ? <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                <View accessibilityLabel={`${label}: ${status.label}`} style={{ backgroundColor: status.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 10.5, color: status.text }}>{status.label}</Text></View>
                <Text style={meta}>Paid {formatPeso(payment.paidCentavos)} of {formatPeso(payment.dueCentavos)}</Text>
              </View> : null}
            </View>
            {onReservationAmountChange ? <BudgetAmountField label={`${label} budget amount in pesos`} amount={row.amountCentavos} onChange={(amount) => onReservationAmountChange(index, amount)} onValidityChange={(valid) => onValidityChange?.(key, valid)} /> : <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "#1B1C1A" }}>{formatPeso(row.amountCentavos)}</Text>}
          </View>
          {onReservationAmountChange && due !== undefined && row.amountCentavos !== due ? <Pressable accessibilityRole="button" accessibilityLabel={`Use the amount due for ${label}`} onPress={() => { onValidityChange?.(key, true); onReservationAmountChange(index, (due / 100).toFixed(2)); }} hitSlop={6} style={{ alignSelf: "flex-end", marginTop: 6 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 11.5, color: "#0E6D46" }}>Use {formatPeso(due)}</Text>
          </Pressable> : null}
          {showUnderfundedWarnings && due !== undefined && row.amountCentavos < due ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 11, color: "#B45309", marginTop: 6 }}>{row.savingsGoalId ? "This contribution is below your schedule and may delay your goal." : "This budget is below the amount due and may result in a missed payment."}</Text> : null}
        </View>;
      })}
      {showSurplus ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "#EFEEE8", paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>Extra amount</Text><Text style={[meta, { marginTop: 2 }]}>Optional, on top of what is due</Text></View>
        {onSurplusAmountChange ? <BudgetAmountField label={`${title} surplus amount in pesos`} amount={surplusCentavos} onChange={onSurplusAmountChange} onValidityChange={(valid) => onValidityChange?.(`${title}:surplus`, valid)} /> : <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "#1B1C1A" }}>{formatPeso(surplusCentavos)}</Text>}
      </View> : null}
    </> : null}
  </View>;
}
