import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SpendingRecurrence } from "../../local-db/repositories/unusualSpending";
import { MONTH_NAMES, RECURRENCE_OPTIONS } from "./recurrenceOptions";

const C = { brand: "#013220", border: "#D8D8D2", muted: "#6B7A6F", warning: "#C25E00", selected: "#E6EFE9" };

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

  function toggle(month: number) {
    setMonths((current) => current.includes(month) ? current.filter((item) => item !== month) : [...current, month].sort((left, right) => left - right));
  }

  const errorText = error ? <Text style={{ color: C.warning, marginTop: 4, textAlign: "center" }}>{error}</Text> : null;

  if (choosingMonths) {
    return <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: C.brand }}>Which months do you pay this?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MONTH_NAMES.map((name, index) => {
          const month = index + 1;
          const selected = months.includes(month);
          return <Pressable key={name} accessibilityRole="checkbox" accessibilityLabel={name} accessibilityState={{ checked: selected }} onPress={() => toggle(month)} disabled={saving !== null} style={{ width: "22%", flexGrow: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: selected ? C.brand : C.border, backgroundColor: selected ? C.selected : "transparent", alignItems: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: selected ? "800" : "600", color: C.brand }}>{name.slice(0, 3)}</Text>
          </Pressable>;
        })}
      </View>
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
