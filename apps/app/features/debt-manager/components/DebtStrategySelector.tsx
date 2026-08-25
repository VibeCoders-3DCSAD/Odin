import { Pressable, Text, View } from "react-native";

type Strategy = "snowball" | "avalanche";

export function DebtStrategySelector({ strategy, onChange }: { strategy: Strategy; onChange: (value: Strategy) => void }) {
  return <View style={{ backgroundColor: "#F1F0EB", borderRadius: 16, padding: 14 }}><Text style={{ fontWeight: "700", color: "#1B1C1A" }}>Global strategy</Text><View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>{(["snowball", "avalanche"] as const).map((value) => <Pressable key={value} onPress={() => onChange(value)} accessibilityRole="radio" accessibilityState={{ selected: strategy === value }} style={{ backgroundColor: strategy === value ? "#0E6D46" : "#fff", padding: 10, borderRadius: 10 }}><Text style={{ color: strategy === value ? "#fff" : "#414942", textTransform: "capitalize" }}>{value}</Text></Pressable>)}</View></View>;
}
