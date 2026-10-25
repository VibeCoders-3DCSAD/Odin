import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

const GENERATING_BACKGROUND = "#fcf8f0";
const MESSAGE_INTERVAL_MS = 2_400;
const MESSAGES = [
  "Syncing your recent spending...",
  "Setting aside savings, debt and bills...",
  "Forecasting this month's spending...",
  "Balancing your categories...",
];

export function PlanGeneratingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMessageIndex((index) => (index + 1) % MESSAGES.length), MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return <View accessibilityRole="progressbar" accessibilityLabel="Generating your Financial Plan" style={{ marginTop: 16, minHeight: 420, borderRadius: 20, backgroundColor: GENERATING_BACKGROUND, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 }}>
    <ActivityIndicator color="#0E6D46" size="large" />
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: "#1B1C1A", marginTop: 20, textAlign: "center" }}>Building your plan</Text>
    <Text accessibilityLiveRegion="polite" style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: "#6B7A6F", marginTop: 6, textAlign: "center", minHeight: 19 }}>{MESSAGES[messageIndex]}</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#8A938C", marginTop: 18, textAlign: "center" }}>This usually takes a few seconds.</Text>
  </View>;
}
