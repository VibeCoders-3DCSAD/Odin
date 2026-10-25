import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BottomSheet, FieldError, PickerField, v4, v4Font } from "./BudgieForm";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function fromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  return `${MONTHS[Number(value.slice(5, 7)) - 1]} ${Number(value.slice(8, 10))} ${value.slice(0, 4)}`;
}

// A YYYY-MM-DD date field: the native dialog on Android, a spinner sheet with Cancel/Done on iOS.
export function DateField({ label, value, placeholder, onChange, error }: { label: string; value: string | null; placeholder: string; onChange: (value: string) => void; error?: boolean | string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? toDate(value) : new Date());
  const field = (
    <View>
      <PickerField label={label} accessibilityLabel={label} value={value ? formatDate(value) : placeholder} placeholder={!value} error={Boolean(error)} onPress={() => { setDraft(value ? toDate(value) : new Date()); setOpen(true); }} />
      {typeof error === "string" && error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
  if (!open) return field;
  if (Platform.OS === "android") {
    // Android also calls onChange when the dialog is dismissed, so only a "set" event picks a date.
    return <>{field}<DateTimePicker value={draft} mode="date" onChange={(event, next) => { setOpen(false); if (event.type === "set" && next) onChange(fromDate(next)); }} /></>;
  }
  return (
    <>
      {field}
      <BottomSheet visible onClose={() => setOpen(false)}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}><Text style={{ fontFamily: v4Font, fontWeight: "600", fontSize: 14, color: v4.mut }}>Cancel</Text></Pressable>
          <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 16, color: v4.ink }}>{label}</Text>
          <Pressable onPress={() => { onChange(fromDate(draft)); setOpen(false); }} accessibilityRole="button" accessibilityLabel="Done" hitSlop={8}><Text style={{ fontFamily: v4Font, fontWeight: "700", fontSize: 14, color: v4.brandMid }}>Done</Text></Pressable>
        </View>
        <DateTimePicker value={draft} mode="date" display="spinner" onChange={(_event, next) => { if (next) setDraft(next); }} />
      </BottomSheet>
    </>
  );
}
