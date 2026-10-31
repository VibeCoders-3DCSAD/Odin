import React from "react";
import { Pressable, Text } from "react-native";
import { P } from "../helpers/accountsTheme";

// Kept local: the shared components/DateField shows a formatted "Mon D YYYY" label through PickerField
// and owns its own picker, whereas this form shows the raw YYYY-MM-DD value and drives the picker itself.
export function AccountDateField({ placeholder, value, error, onPress }: { placeholder: string; value: string | null; error?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: error ? P.error : P.line, paddingHorizontal: 14, justifyContent: "center", backgroundColor: P.card }}
    >
      <Text style={{ fontFamily: "Manrope", fontSize: 14, color: value ? P.ink : P.muted }}>{value ?? placeholder}</Text>
    </Pressable>
  );
}
