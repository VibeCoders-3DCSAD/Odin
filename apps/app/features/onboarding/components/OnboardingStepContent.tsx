import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { normalizeCustomEvents } from "@odin/spending-insights/seasons";
import type { StepConfig } from "../types";
import { availableOnboardingStep, SEASONAL_QUESTION_KEYS } from "../helpers/seasonalAnswers";
import { CustomSeasonalEventForm } from "./CustomSeasonalEventForm";
import { CardSelectStep } from "../steps/CardSelectStep";
import { CardMultiSelectStep } from "../steps/CardMultiSelectStep";
import { DateStep } from "../steps/DateStep";
import { InputStep } from "../steps/InputStep";
import { AmountListStep } from "../steps/AmountListStep";
import { ReviewStep } from "../steps/ReviewStep";

type OnboardingStepContentProps = {
  step: StepConfig;
  answers: Record<string, unknown>;
  saveAnswer: (key: string, value: unknown) => void;
  incomeText: string;
  setIncomeText: (text: string) => void;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  onEdit: (stepIndex: number) => void;
};

// Renders the input for the current step kind and maps its events to answer updates.
export function OnboardingStepContent({
  step,
  answers,
  saveAnswer,
  incomeText,
  setIncomeText,
  showDatePicker,
  setShowDatePicker,
  onEdit,
}: OnboardingStepContentProps) {
  const dateOfBirth = (answers.date_of_birth as string) ?? "";

  return (
    <>
      {(step.kind === "card_select" || step.kind === "dropdown") && (
        <CardSelectStep
          step={step}
          selected={answers[step.questionKey] as string | undefined}
          onSelect={(val) => saveAnswer(step.questionKey, val)}
          variant={step.kind === "dropdown" ? "dropdown" : "card"}
        />
      )}

      {step.kind === "card_multi_select" && (
        <CardMultiSelectStep
          step={availableOnboardingStep(step, answers)}
          selected={(answers[step.questionKey] as string[]) ?? []}
          onToggle={(val) => {
            const prev = (answers[step.questionKey] as string[]) ?? [];
            const noneKey = step.options?.find((o) => o.key === "none")?.key;
            if (val === noneKey) {
              saveAnswer(step.questionKey, [noneKey]);
              return;
            }
            const withoutNone = prev.filter((k) => k !== noneKey);
            const next = withoutNone.includes(val)
              ? withoutNone.filter((k) => k !== val)
              : [...withoutNone, val];
            saveAnswer(step.questionKey, next);
          }}
        />
      )}

      {SEASONAL_QUESTION_KEYS.includes(step.questionKey) && (
        <CustomSeasonalEventForm
          key={step.questionKey}
          events={normalizeCustomEvents(answers.custom_seasonal_events)}
          onAdd={(event) => {
            saveAnswer("custom_seasonal_events", [...normalizeCustomEvents(answers.custom_seasonal_events), event]);
            const selected = Array.isArray(answers[step.questionKey]) ? answers[step.questionKey] as string[] : [];
            saveAnswer(step.questionKey, [...selected.filter((key) => key !== "none"), event.id]);
          }}
        />
      )}

      {step.kind === "input" && step.key === "date_of_birth" ? (
        <DateStep
          step={step}
          value={dateOfBirth}
          showPicker={showDatePicker}
          onPress={() => setShowDatePicker(true)}
          onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const yyyy = selectedDate.getFullYear();
              const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
              const dd = String(selectedDate.getDate()).padStart(2, "0");
              saveAnswer("date_of_birth", `${yyyy}-${mm}-${dd}`);
            }
          }}
        />
      ) : step.kind === "input" && (
        <InputStep
          step={step}
          value={step.key === "monthly_income" ? incomeText : (answers[step.questionKey] as string) ?? ""}
          onChangeText={
            step.key === "monthly_income"
              ? (t: string) => {
                  const digits = t.replace(/[^0-9]/g, "");
                  setIncomeText(digits);
                  saveAnswer(step.questionKey, digits === "" ? "" : digits);
                }
              : (t: string) => saveAnswer(
                  step.questionKey,
                  step.allowUnknown && t === "not_sure" ? t : step.inputSuffix ? t.replace(/[^0-9]/g, "") : t,
                )
          }
        />
      )}

      {step.kind === "amount_list" && (
        <AmountListStep
          step={step}
          selected={(answers[step.amountSourceKey ?? ""] as string[] | undefined) ?? []}
          values={(answers[step.questionKey] as Record<string, string> | undefined) ?? {}}
          onChange={(key, value) => saveAnswer(step.questionKey, {
            ...((answers[step.questionKey] as Record<string, string> | undefined) ?? {}),
            [key]: value.replace(/[^0-9]/g, ""),
          })}
        />
      )}

      {step.kind === "review" && (
        <ReviewStep
          answers={answers}
          onEdit={onEdit}
          incomeText={incomeText}
        />
      )}
    </>
  );
}
