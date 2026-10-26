import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { CaretDown, CaretRight } from "phosphor-react-native";
import MonthPicker from "../../alerts/MonthPicker";
import { monthList } from "../../alerts/recurrenceOptions";
import { changeRecurrenceMonths, listPersistedUnusualSpendings, stopRecurrence, type UnusualSpendingInsight } from "../../../local-db/repositories/unusualSpending";

const C = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", brand: "#0B8A55", danger: "#B3261E" };

type Props = { userId: string; deviceId: string };

function formatCurrency(amountCentavos: number): string {
  return `PHP ${(amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A payment answered without months comes back in its own month.
function paymentMonths(payment: UnusualSpendingInsight): number[] {
  return payment.recurrenceMonths ?? [Number(payment.transactionDate.slice(5, 7))];
}

// Unusual payments the user said come back in certain months, whose months they can change or which they can
// stop expecting. Stored on this device, so it works offline.
export function RecurringPaymentsSection({ userId, deviceId }: Props) {
  const [payments, setPayments] = useState<UnusualSpendingInsight[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const insights = await listPersistedUnusualSpendings(userId);
      setPayments(insights.filter((insight) => insight.recurrence === "yearly").reverse());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: C.ink }}>Payments in certain months</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 13, color: C.muted }}>Unusual payments you said come back in certain months. Your forecast expects them in these months.</Text>
      {loadError ? <Text accessibilityRole="alert">Unable to load these payments.</Text>
        : payments === null ? <ActivityIndicator accessibilityLabel="Loading payments in certain months" color="#08B16A" />
        : payments.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 13, color: C.muted }}>None yet. When an unusual expense comes back in certain months, answer "Yes, in certain months" on its alert.</Text>
        : (
          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: "hidden" }}>
            {payments.map((payment, index) => (
              <RecurringPaymentRow key={payment.transactionId} payment={payment} first={index === 0} expanded={editing === payment.transactionId}
                onToggle={() => setEditing((current) => current === payment.transactionId ? null : payment.transactionId)}
                onSave={async (months) => { await changeRecurrenceMonths(userId, deviceId, payment.transactionId, months); setEditing(null); await load(); }}
                onRemove={async () => { await stopRecurrence(userId, deviceId, payment.transactionId); setEditing(null); await load(); }} />
            ))}
          </View>
        )}
    </View>
  );
}

type RowProps = {
  payment: UnusualSpendingInsight;
  first: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSave: (months: number[]) => Promise<void>;
  onRemove: () => Promise<void>;
};

function RecurringPaymentRow({ payment, first, expanded, onToggle, onSave, onRemove }: RowProps) {
  const [months, setMonths] = useState(() => paymentMonths(payment));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = new Date(`${payment.transactionDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const label = `${payment.subcategoryLabel}, ${formatCurrency(payment.amountCentavos)}`;

  useEffect(() => { if (!expanded) { setMonths(paymentMonths(payment)); setError(null); } }, [expanded, payment]);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("Your change could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove() {
    Alert.alert(`Stop expecting ${payment.subcategoryLabel}?`, "Your forecast will no longer expect this payment. It becomes a one-time expense.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void run(onRemove) },
    ]);
  }

  const Caret = expanded ? CaretDown : CaretRight;
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit months for ${label}`} accessibilityState={{ expanded }} onPress={onToggle} disabled={saving}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: C.ink }}>{payment.subcategoryLabel} · {formatCurrency(payment.amountCentavos)}</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: C.muted }}>Paid {date} · {monthList(paymentMonths(payment))}</Text>
        </View>
        <Caret size={16} color={C.muted} weight="bold" />
      </Pressable>
      {expanded ? (
        <View style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
          <MonthPicker months={months} onChange={setMonths} disabled={saving} />
          {error ? <Text accessibilityRole="alert" style={{ color: C.danger }}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Save months for ${label}`} onPress={() => void run(() => onSave(months))} disabled={saving || months.length === 0}
            style={{ minHeight: 48, borderRadius: 12, backgroundColor: months.length === 0 ? C.line : "#013220", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: months.length === 0 ? C.muted : "#FFFFFF" }}>{saving ? "Saving..." : months.length === 0 ? "Choose at least one month" : "Save months"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} onPress={confirmRemove} disabled={saving} style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: C.danger }}>Remove</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
