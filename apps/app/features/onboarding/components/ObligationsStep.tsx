import { useState } from "react";
import { Text, TextInput, View } from "react-native";

const palette = {
  brand: "#013220",
  ink: "#1B1C1A",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  card: "#F1F0EB",
};

type ObligationsStepProps = {
  value?: number;
  onChange: (value: number) => void;
};

export default function ObligationsStep({ value, onChange }: ObligationsStepProps) {
  const [input, setInput] = useState(value ? String(value) : "");

  function handleChange(text: string) {
    const digits = text.replace(/[^0-9]/g, "");
    setInput(digits);
    const num = parseInt(digits, 10);
    if (!isNaN(num)) onChange(num);
  }

  return (
    <View className="gap-4">
      <View>
        <Text
          className="text-lg"
          style={{ fontFamily: "Manrope", fontWeight: "700", color: palette.ink }}
        >
          What are your average monthly obligations?
        </Text>
        <Text
          className="text-sm mt-1"
          style={{ fontFamily: "Manrope", fontWeight: "400", color: palette.mut }}
        >
          Include rent, loans, bills, and other recurring payments.
        </Text>
      </View>
      <View
        className="flex-row items-center rounded-[14px] px-4"
        style={{
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: input ? palette.brand : palette.line,
        }}
      >
        <Text
          className="text-base mr-2"
          style={{ fontFamily: "Manrope", fontWeight: "700", color: palette.mut }}
        >
          ₱
        </Text>
        <TextInput
          value={input}
          onChangeText={handleChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={palette.mut}
          className="flex-1 py-4 text-base"
          style={{
            fontFamily: "Manrope",
            fontWeight: "600",
            color: palette.ink,
          }}
          accessibilityLabel="Monthly obligations in Philippine Pesos"
        />
      </View>
    </View>
  );
}
