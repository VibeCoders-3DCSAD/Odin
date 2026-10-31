import { Pressable, Text, TextInput, View } from "react-native";
import { Check } from "phosphor-react-native";
import { AQUA50, AQUA600, AQUA950, CARD, INK, INK2, LINE, MUTED } from "../colors";
import type { StepConfig } from "../types";

export function InputStep({
  step,
  value,
  onChangeText,
}: {
  step: StepConfig;
  value: string;
  onChangeText: (t: string) => void;
}) {
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1.5,
          borderColor: LINE,
          borderRadius: 14,
          backgroundColor: CARD,
        }}
      >
        {step.inputSuffix === "PHP" || step.inputSuffix === "%" ? (
          <>
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "500",
                fontSize: 12,
                color: MUTED,
                paddingLeft: 16,
              }}
            >
              {step.inputSuffix}
            </Text>
            <TextInput
              value={value !== "not_sure" && value ? Number(value).toLocaleString() : ""}
              onChangeText={(t) => onChangeText(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={MUTED}
              style={{
                flex: 1,
                fontFamily: "Manrope",
                fontWeight: "700",
                fontSize: 20,
                color: INK,
                padding: 16,
              }}
            />
          </>
        ) : (
          <TextInput
            value={value as string}
            onChangeText={(t) => onChangeText(t)}
            keyboardType="default"
            placeholder={step.inputPlaceholder ?? ""}
            placeholderTextColor={MUTED}
            style={{
              flex: 1,
              fontFamily: "Manrope",
              fontWeight: "700",
              fontSize: 20,
              color: INK,
              padding: 16,
            }}
          />
        )}
      </View>
      {step.allowUnknown ? (
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel="I don't know"
          accessibilityState={{ selected: value === "not_sure" }}
          onPress={() => onChangeText("not_sure")}
          style={{ marginTop: 12, padding: 16, minHeight: 56, borderRadius: 14, borderWidth: 1.5, borderColor: value === "not_sure" ? AQUA600 : LINE, backgroundColor: value === "not_sure" ? AQUA50 : CARD, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text style={{ color: value === "not_sure" ? AQUA950 : INK2, fontFamily: "Manrope", fontWeight: "700", fontSize: 18 }}>
            I don't know
          </Text>
          {value === "not_sure" ? <Check size={20} color={AQUA600} weight="bold" /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}
