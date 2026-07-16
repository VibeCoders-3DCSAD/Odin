import { Pressable, Text, View } from "react-native";

const palette = {
  brand: "#013220",
  ink2: "#414942",
  card: "#F1F0EB",
};

export type TransactionType = "expense" | "income" | "transfer";

type Props = {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
};

const TYPES: { key: TransactionType; label: string }[] = [
  { key: "expense", label: "Expense" },
  { key: "income", label: "Income" },
  { key: "transfer", label: "Transfer" },
];

export default function TransactionTypeSelector({ value, onChange }: Props) {
  return (
    <View style={{ flexDirection: "row", borderRadius: 12, backgroundColor: palette.card, padding: 4 }}>
      {TYPES.map((t) => {
        const selected = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: selected ? palette.brand : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "600",
                fontSize: 13,
                color: selected ? "#fff" : palette.ink2,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
