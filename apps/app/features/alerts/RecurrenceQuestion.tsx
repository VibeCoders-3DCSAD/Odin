import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SpendingRecurrence } from "../../local-db/repositories/unusualSpending";
import MonthPicker from "./MonthPicker";
import { RECURRENCE_OPTIONS } from "./recurrenceOptions";

const C = { brand: "#013220", border: "#D8D8D2", muted: "#6B7A6F", warning: "#C25E00" };

type Props = {
  // The expense's date (YYYY-MM-DD); its month starts out chosen.
  transactionDate: string;
  onAnswer: (recurrence: SpendingRecurrence, months?: number[]) => Promise<void>;
};

// The answers to an unusual expense. "Yes, in certain months" opens a month picker before saving.
export default function RecurrenceQuestion({ transactionDate, onAnswer }: Props) {
  const [choosingMonths, setChoosingMonths] = useState(false);
  const [months, setMonths] = useState<number[]>(() => [Number(transactionDate.slice(5, 7))]);
  const [saving, setSaving] = useState<SpendingRecurrence | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(recurrence: SpendingRecurrence, chosen?: number[]) {
    setSaving(recurrence);
    try {
      await onAnswer(recurrence, chosen);
      setError(null);
    } catch {
      setError("Your answer could not be saved. Try again.");
    } finally {
      setSaving(null);
    }
  }

  const errorText = error ? <Text style={{ color: C.warning, marginTop: 4, textAlign: "center" }}>{error}</Text> : null;

  if (choosingMonths) {
    return <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: C.brand }}>Which months do you pay this?</Text>
      <MonthPicker months={months} onChange={setMonths} disabled={saving !== null} />
      {errorText}
      <Pressable accessibilityRole="button" accessibilityLabel="Save months" onPress={() => void save("yearly", months)} disabled={saving !== null || months.length === 0} style={{ minHeight: 48, borderRadius: 12, backgroundColor: months.length === 0 ? C.border : C.brand, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#FFFFFF" }}>{saving ? "Saving..." : months.length === 0 ? "Choose at least one month" : "Save months"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to answers" onPress={() => setChoosingMonths(false)} disabled={saving !== null} style={{ alignItems: "center", paddingVertical: 8 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: C.muted }}>Back</Text>
      </Pressable>
    </View>;
  }

  return <View style={{ gap: 10 }}>
    {errorText}
    {RECURRENCE_OPTIONS.map(({ recurrence, label }) => (
      <Pressable key={recurrence} accessibilityRole="button" accessibilityLabel={label} onPress={() => recurrence === "yearly" ? setChoosingMonths(true) : void save(recurrence)} disabled={saving !== null} style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: C.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: C.brand, textAlign: "center" }}>{saving === recurrence ? "Saving..." : label}</Text>
      </Pressable>
    ))}
  </View>;
}
