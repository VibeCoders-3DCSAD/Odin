import { Pressable, Text } from "react-native";
import { ArrowLeft } from "phosphor-react-native";

export function PlanBackLink({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Back to plan setup" onPress={onPress} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 4 }}>
    <ArrowLeft size={15} color="#0E6D46" weight="bold" />
    <Text style={{ fontFamily: "Manrope", fontSize: 12, fontWeight: "800", color: "#0E6D46" }}>Back to setup</Text>
  </Pressable>;
}
