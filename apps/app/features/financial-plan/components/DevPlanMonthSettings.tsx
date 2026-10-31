import { useState } from "react";
import { Pressable, Text, View } from "react-native";

type Props = { month: string; onChange: (month: string) => void };

export function DevPlanMonthSettings({ month, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!__DEV__) return null;
  const label = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const changeMonth = (offset: number) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    onChange(date.toISOString().slice(0, 7));
  };
  return (
    <View style={{ marginVertical: 12, borderWidth: 1, borderColor: "#D7DDD8", borderRadius: 12, padding: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Advanced plan settings" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#0E6D46" }}>Advanced settings (dev only)</Text>
      </Pressable>
      <Text style={{ fontFamily: "Manrope", color: "#414942", fontSize: 12, marginTop: 6 }}>Plan month: {label}</Text>
      {expanded ? <View style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: "Manrope", color: "#6B7A6F", fontSize: 11, marginBottom: 8 }}>Other months are previews only. Only current-month plans can be saved.</Text>
        <Text style={{ fontFamily: "Manrope", color: "#414942", fontSize: 12 }}>Plan month</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous plan month" disabled={month === "2000-01"} onPress={() => changeMonth(-1)} style={{ padding: 10 }}><Text style={{ color: "#0E6D46", fontFamily: "Manrope", fontWeight: "700" }}>Previous</Text></Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: "Manrope", fontWeight: "700", color: "#1B1C1A" }}>{label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next plan month" disabled={month === "2099-12"} onPress={() => changeMonth(1)} style={{ padding: 10 }}><Text style={{ color: "#0E6D46", fontFamily: "Manrope", fontWeight: "700" }}>Next</Text></Pressable>
        </View>
      </View> : null}
    </View>
  );
}
