import { Text, View } from "react-native";
import { ONBOARDING_STEPS, STEP_LABELS } from "../constants";
import type { OnboardingStepKey } from "../constants";

const palette = {
  brand: "#013220",
  brandMedium: "#0E6D46",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  card: "#F1F0EB",
};

type StepProgressBarProps = {
  currentStep: OnboardingStepKey;
  completedSteps: OnboardingStepKey[];
};

export default function StepProgressBar({ currentStep, completedSteps }: StepProgressBarProps) {
  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);

  return (
    <View className="px-1 py-4">
      <View className="flex-row items-center justify-between">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step);
          const isCurrent = step === currentStep;

          return (
            <View key={step} className="flex-1 items-center">
              <View className="flex-row items-center w-full">
                <View
                  className="h-[3px] flex-1 rounded-full"
                  style={{
                    backgroundColor: index <= currentIndex ? palette.brand : palette.line,
                  }}
                />
                <View
                  className="w-[20px] h-[20px] rounded-full items-center justify-center"
                  style={{
                    backgroundColor: isCompleted
                      ? palette.brandMedium
                      : isCurrent
                        ? palette.brand
                        : palette.card,
                    borderWidth: isCurrent ? 0 : 1,
                    borderColor: isCompleted ? palette.brandMedium : palette.line,
                  }}
                >
                  <Text
                    className="text-[10px] font-bold"
                    style={{
                      color: isCompleted || isCurrent ? "#FFFFFF" : palette.mut,
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <View
                    className="h-[3px] flex-1 rounded-full"
                    style={{
                      backgroundColor: index < currentIndex ? palette.brand : palette.line,
                    }}
                  />
                )}
              </View>
              <Text
                className="text-[10px] mt-1.5"
                style={{
                  color: isCurrent ? palette.brand : palette.mut,
                  fontWeight: isCurrent ? "600" : "400",
                }}
              >
                {STEP_LABELS[step]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
