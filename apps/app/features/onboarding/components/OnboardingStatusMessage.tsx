import { Text, View } from "react-native";
import { INK, MUTED } from "../colors";

// Full-screen title + message used for the offline and init-error states.
export function OnboardingStatusMessage({ title, message }: { title: string; message: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-card px-6">
      <Text
        style={{
          fontFamily: "Manrope",
          fontWeight: "700",
          fontSize: 18,
          color: INK,
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: "Manrope",
          fontWeight: "400",
          fontSize: 14,
          color: MUTED,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </View>
  );
}
