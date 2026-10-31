import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { FieldError, Note, PickerField, Switch, TextField, styles, v4 } from "../../../components/BudgieForm";

export function SavingsInput({ label, value, onChange, error, numeric, multiline, placeholder, suffix }: { label: string; value: string; onChange: (value: string) => void; error?: string; numeric?: boolean; multiline?: boolean; placeholder?: string; suffix?: string }) {
  return <View><TextField label={label} accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? "decimal-pad" : "default"} multiline={multiline} placeholder={placeholder} suffix={suffix} error={Boolean(error)} />{error ? <FieldError>{error}</FieldError> : null}</View>;
}

export function SavingsDate({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  return <View><PickerField label={label} accessibilityLabel={label} value={value || "Select date"} placeholder={!value} error={Boolean(error)} onPress={() => setOpen(true)} />{error ? <FieldError>{error}</FieldError> : null}{open ? <DateTimePicker mode="date" value={value ? new Date(`${value}T12:00:00`) : new Date()} onChange={(event, date) => { setOpen(false); if (event.type === "set" && date) onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`); }} /> : null}</View>;
}

export function SavingsToggle({ label, description, value, onToggle }: { label: string; description: string; value: boolean; onToggle: () => void }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ flex: 1, gap: 4 }}><Text style={styles.cardTitle}>{label}</Text><Note>{description}</Note></View><Switch accessibilityLabel={label} value={value} onToggle={onToggle} /></View>;
}

export function SavingsAction({ label, onPress, secondary }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.button, secondary ? styles.buttonGhost : null]}><Text style={[styles.buttonText, secondary ? styles.buttonGhostText : null]}>{label}</Text></Pressable>;
}

export function SavingsReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 3, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: v4.hairline }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.cardTitle}>{value}</Text></View>;
}
