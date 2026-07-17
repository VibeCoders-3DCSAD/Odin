import { ArrowDownLeft, ArrowUpRight, ArrowsLeftRight } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

const palette = {
  brand: "#013220",
  danger: "#ff2f43",
  ink2: "#414942",
  card: "#F1F0EB",
  line: "#e2dccb",
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

function TypeIcon({ type, color }: { type: TransactionType; color: string }) {
  if (type === "expense") return <ArrowUpRight color={color} size={14} weight="bold" />;
  if (type === "income") return <ArrowDownLeft color={color} size={14} weight="bold" />;
  return <ArrowsLeftRight color={color} size={14} weight="bold" />;
}

export default function TransactionTypeSelector({ value, onChange }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 16,
        backgroundColor: palette.card,
        padding: 4,
        borderWidth: 1,
        borderColor: palette.line,
      }}
    >
      {TYPES.map((t) => {
        const selected = value === t.key;
        const selectedColor = t.key === "expense" ? palette.danger : palette.brand;
        const foreground = selected ? "#fff" : palette.ink2;

        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              paddingVertical: 11,
              borderRadius: 12,
              backgroundColor: selected ? selectedColor : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TypeIcon type={t.key} color={foreground} />
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "700",
                  fontSize: 13,
                  color: foreground,
                }}
              >
                {t.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
