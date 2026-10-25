import { Text, TextInput, View, type TextInputProps } from "react-native";

type Props = Omit<TextInputProps, "style"> & { invalid?: boolean; width?: number };

// A compact peso field shared by commitment and category rows; the label lives in accessibilityLabel.
export function PlanAmountInput({ invalid = false, width = 124, ...props }: Props) {
  return <View style={{ width, height: 40, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: invalid ? "#D9001F" : "#D6D8D4", borderRadius: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 10 }}>
    <Text style={{ fontFamily: "Manrope", fontSize: 13, fontWeight: "700", color: "#8A938C", marginRight: 4 }}>₱</Text>
    <TextInput keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A938C" {...props} style={{ flex: 1, height: "100%", padding: 0, fontFamily: "Manrope", fontSize: 13, fontWeight: "700", color: "#1B1C1A", textAlign: "right" }} />
  </View>;
}
