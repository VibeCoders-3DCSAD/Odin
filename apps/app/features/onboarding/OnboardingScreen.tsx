import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { COLORS, ONBOARDING_STEPS } from "./constants";
import type { OnboardingStepKey } from "./constants";
import { useOnboardingSession } from "./hooks/useOnboardingSession";
import StepProgressBar from "./components/StepProgressBar";
import IncomeTypeStep from "./components/IncomeTypeStep";
import IncomeAmountStep from "./components/IncomeAmountStep";
import ObligationsStep from "./components/ObligationsStep";
import DependentsStep from "./components/DependentsStep";
import ReviewStep from "./components/ReviewStep";

type OnboardingScreenProps = {
  accessToken: string;
  onComplete?: () => void;
};

export default function OnboardingScreen({ accessToken, onComplete }: OnboardingScreenProps) {
  const {
    currentStep,
    answers,
    goToStep,
    updateAnswers,
    isCreating,
    isSaving,
    error,
    ready,
  } = useOnboardingSession(accessToken);

  if (isCreating || !ready) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator color={COLORS.brand} />
        <Text
          className="text-sm mt-3"
          style={{ fontFamily: "Manrope", fontWeight: "400", color: COLORS.mut }}
        >
          Setting up...
        </Text>
      </View>
    );
  }

  const stepIndex = ONBOARDING_STEPS.indexOf(currentStep);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  const completedSteps = ONBOARDING_STEPS.slice(0, stepIndex);

  function handleNext() {
    if (isLastStep) {
      onComplete?.();
      return;
    }
    goToStep(ONBOARDING_STEPS[stepIndex + 1] as OnboardingStepKey);
  }

  function handleBack() {
    if (isFirstStep) return;
    goToStep(ONBOARDING_STEPS[stepIndex - 1] as OnboardingStepKey);
  }

  function handleEditStep(step: OnboardingStepKey) {
    goToStep(step);
  }

  return (
    <View className="flex-1 gap-6 py-4">
      <StepProgressBar currentStep={currentStep} completedSteps={completedSteps} />

      {currentStep === "income_type" && (
        <IncomeTypeStep
          value={answers.income_type as string | undefined}
          onChange={(v) => updateAnswers({ income_type: v })}
        />
      )}

      {currentStep === "monthly_income" && (
        <IncomeAmountStep
          value={answers.monthly_income as number | undefined}
          onChange={(v) => updateAnswers({ monthly_income: v })}
        />
      )}

      {currentStep === "monthly_obligations" && (
        <ObligationsStep
          value={answers.monthly_obligations as number | undefined}
          onChange={(v) => updateAnswers({ monthly_obligations: v })}
        />
      )}

      {currentStep === "dependents" && (
        <DependentsStep
          value={answers.has_dependents as boolean | undefined}
          onChange={(v) => updateAnswers({ has_dependents: v })}
        />
      )}

      {currentStep === "review" && (
        <ReviewStep answers={answers} onEditStep={handleEditStep} />
      )}

      {error ? (
        <View
          className="rounded-[14px] p-3"
          style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" }}
        >
          <Text
            className="text-sm"
            style={{ fontFamily: "Manrope", fontWeight: "500", color: COLORS.error }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-3 mt-auto">
        {!isFirstStep && (
          <Pressable
            onPress={handleBack}
            disabled={isSaving}
            className="flex-1 min-h-[52px] rounded-[14px] items-center justify-center"
            style={{
              backgroundColor: COLORS.card,
              borderWidth: 1,
              borderColor: COLORS.line,
            }}
          >
            <Text
              className="text-sm font-bold"
              style={{ fontFamily: "Manrope", color: COLORS.ink }}
            >
              Back
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleNext}
          disabled={isSaving}
          className="flex-1 min-h-[52px] rounded-[14px] items-center justify-center"
          style={{
            backgroundColor: COLORS.brand,
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              className="text-sm font-bold"
              style={{ fontFamily: "Manrope", color: "#FFFFFF" }}
            >
              {isLastStep ? "Finish" : "Next"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
