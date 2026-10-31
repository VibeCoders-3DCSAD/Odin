import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { CaretDown, CaretRight } from "phosphor-react-native";
import MonthPicker from "../../alerts/MonthPicker";
import { monthList } from "../../alerts/recurrenceOptions";
import { listPersistedUnusualSpendings, reviseRecurringPaymentGroup } from "../../../local-db/repositories/unusualSpending";
import { groupRecurringPayments, type RecurringPaymentGroup } from "../helpers/recurringPaymentGroups";
import { formatPhp } from "../../../lib/format/money";

const C = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", brand: "#0B8A55", danger: "#B3261E" };

type Props = { userId: string; deviceId: string };

// Unusual payments the user said come back in certain months, whose months they can change or which they can
// stop expecting. Stored on this device, so it works offline.
export function RecurringPaymentsSection({ userId, deviceId }: Props) {
  const [payments, setPayments] = useState<RecurringPaymentGroup[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const insights = await listPersistedUnusualSpendings(userId);
      setPayments(groupRecurringPayments(insights));
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
            {payments.map((group, index) => (
              <RecurringPaymentRow key={group.key} group={group} first={index === 0} expanded={editing === group.key}
                onToggle={() => setEditing((current) => current === group.key ? null : group.key)}
                onSave={async (months) => { await reviseRecurringPaymentGroup(userId, deviceId, group.transactionIds, months); setEditing(null); await load(); }}
                onRemove={async () => { await reviseRecurringPaymentGroup(userId, deviceId, group.transactionIds, null); setEditing(null); await load(); }} />
            ))}
          </View>
        )}
    </View>
  );
}

type RowProps = {
  group: RecurringPaymentGroup;
  first: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSave: (months: number[]) => Promise<void>;
  onRemove: () => Promise<void>;
};

function RecurringPaymentRow({ group, first, expanded, onToggle, onSave, onRemove }: RowProps) {
  const { payment, transactionIds } = group;
  const [months, setMonths] = useState(() => group.months);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = new Date(`${payment.transactionDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const label = `${payment.subcategoryLabel}, ${formatPhp(payment.amountCentavos)}`;

  useEffect(() => { if (!expanded) { setMonths(group.months); setError(null); } }, [expanded, group]);

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
    Alert.alert(`Stop expecting ${payment.subcategoryLabel}?`, transactionIds.length > 1
      ? `Your forecast will no longer expect these payments. All ${transactionIds.length} payments in this group become one-time expenses.`
      : "Your forecast will no longer expect this payment. It becomes a one-time expense.", [
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
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: C.ink }}>{payment.subcategoryLabel} · {formatPhp(payment.amountCentavos)}</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: C.muted }}>{transactionIds.length > 1 ? `${transactionIds.length} payments · Last paid ${date}` : `Paid ${date}`} · Yearly, every {monthList(group.months)}</Text>
        </View>
        <Caret size={16} color={C.muted} weight="bold" />
      </Pressable>
      {expanded ? (
        <View style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
          {transactionIds.length > 1 ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: C.muted }}>Changes apply to all {transactionIds.length} payments in this group.</Text> : null}
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
