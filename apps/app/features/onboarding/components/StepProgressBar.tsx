import { Text, View } from "react-native";
import { COLORS, ONBOARDING_STEPS, STEP_LABELS } from "../constants";
import type { OnboardingStepKey } from "../constants";

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
                    backgroundColor: index <= currentIndex ? COLORS.brand : COLORS.line,
                  }}
                />
                <View
                  className="w-[20px] h-[20px] rounded-full items-center justify-center"
                  style={{
                    backgroundColor: isCompleted
                      ? COLORS.brandMedium
                      : isCurrent
                        ? COLORS.brand
                        : COLORS.card,
                    borderWidth: isCurrent ? 0 : 1,
                    borderColor: isCompleted ? COLORS.brandMedium : COLORS.line,
                  }}
                >
                  <Text
                    className="text-[10px] font-bold"
                    style={{
                      color: isCompleted || isCurrent ? "#FFFFFF" : COLORS.mut,
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <View
                    className="h-[3px] flex-1 rounded-full"
                    style={{
                      backgroundColor: index < currentIndex ? COLORS.brand : COLORS.line,
                    }}
                  />
                )}
              </View>
              <Text
                className="text-[10px] mt-1.5"
                style={{
                  color: isCurrent ? COLORS.brand : COLORS.mut,
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
