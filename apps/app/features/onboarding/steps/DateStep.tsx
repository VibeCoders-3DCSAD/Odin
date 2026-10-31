import { Pressable, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CARD, INK, INK2, LINE, MUTED } from "../colors";
import type { StepConfig } from "../types";

export function DateStep({
  step,
  value,
  showPicker,
  onPress,
  onChange,
}: {
  step: StepConfig;
  value: string;
  showPicker: boolean;
  onPress: () => void;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
}) {
  const parsed = value ? new Date(value + "T00:00:00") : new Date();
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <View>
      {step.inputLabel ? (
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "600",
            fontSize: 14,
            color: INK2,
            marginBottom: 10,
          }}
        >
          {step.inputLabel}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        style={{
          borderWidth: 1.5,
          borderColor: LINE,
          borderRadius: 14,
          backgroundColor: CARD,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "700",
            fontSize: 20,
            color: value ? INK : MUTED,
          }}
        >
          {value ? display : "Select date"}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={parsed}
          mode="date"
          onChange={onChange}
        />
      )}
    </View>
  );
}
