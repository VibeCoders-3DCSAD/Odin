import { Text, View } from "react-native";
import { INK, MUTED } from "../colors";
import type { StepConfig } from "../types";

export function OnboardingStepHeader({ step }: { step: StepConfig }) {
  return (
    <>
      <Text
        style={{
          fontFamily: "Manrope",
          fontWeight: "800",
          fontSize: 24,
          color: INK,
          marginBottom: 4,
        }}
      >
        {step.title}
      </Text>
      {step.subtitle ? (
        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "400",
            fontSize: 14,
            color: MUTED,
            marginBottom: 24,
            lineHeight: 20,
          }}
        >
          {step.subtitle}
        </Text>
      ) : (
        <View className="h-6" />
      )}
    </>
  );
}
