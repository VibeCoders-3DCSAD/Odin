import { Pressable, Text, View } from "react-native";

export function DebtHeader({ onCreate }: { onCreate: () => void }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
    <View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Debt Manager</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F" }}>Flat, offline-first debt planning</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Create debt" onPress={onCreate} style={{ backgroundColor: "#013220", borderRadius: 12, padding: 12 }}><Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text></Pressable>
  </View>;
}
