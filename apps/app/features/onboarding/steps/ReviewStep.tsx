import { Pressable, Text, View } from "react-native";
import { PencilSimple } from "phosphor-react-native";
import { AQUA50, AQUA600, INK, LINE, MUTED } from "../colors";
import { STEPS } from "../types";
import { availableOnboardingStep } from "../helpers/seasonalAnswers";
import { formatPeso } from "../../../lib/format/money";

export function ReviewStep({
  answers,
  onEdit,
  incomeText,
}: {
  answers: Record<string, unknown>;
  onEdit: (stepIndex: number) => void;
  incomeText: string;
}) {
  const rows: { label: string; value: string; stepIndex: number }[] = [];
  const stepFor = (key: string) => STEPS.find((step) => step.questionKey === key);
  const addOptionRow = (label: string, questionKey: string) => {
    const step = stepFor(questionKey);
    const option = step?.options?.find((item) => item.key === answers[questionKey]);
    if (step && option) rows.push({ label, value: option.label, stepIndex: STEPS.indexOf(step) });
  };
  const addMultiOptionRow = (label: string, questionKey: string) => {
    const originalStep = stepFor(questionKey);
    const step = originalStep ? availableOnboardingStep(originalStep, answers) : undefined;
    const selections = answers[questionKey];
    if (!step || !Array.isArray(selections)) return;
    const labels = selections
      .map((selection) => {
        const option = step.options?.find((item) => item.key === selection);
        return option ? `${option.label}${option.description ? ` (${option.description})` : ""}` : undefined;
      })
      .filter(Boolean)
      .join(", ");
    if (labels && originalStep) rows.push({ label, value: labels, stepIndex: STEPS.indexOf(originalStep) });
  };
  const addAmountMapRows = (questionKey: string) => {
    const step = stepFor(questionKey);
    const values = answers[questionKey];
    if (!step || !values || typeof values !== "object" || Array.isArray(values)) return;
    for (const [key, amount] of Object.entries(values as Record<string, unknown>)) {
      const option = step.amountOptions?.find((item) => item.key === key);
      if (option && typeof amount === "string") {
        rows.push({ label: `${option.label} Monthly Amount`, value: formatPeso(Math.round(Number(amount) * 100)), stepIndex: STEPS.indexOf(step) });
      }
    }
  };

  const displayName = answers.display_name;
  if (displayName && displayName !== "") rows.push({ label: "Name", value: displayName as string, stepIndex: STEPS.findIndex((step) => step.questionKey === "display_name") });

  if (incomeText)
    rows.push({
      label: "Monthly Income After Deductions",
      value: formatPeso(Math.round(Number(incomeText) * 100)),
      stepIndex: STEPS.findIndex((step) => step.questionKey === "monthly_income"),
    });
  addMultiOptionRow("Monthly Deductions", "monthly_deductions");
  addAmountMapRows("monthly_deduction_amounts");
  addOptionRow("Savings Runway", "emergency_savings_runway");
  const emergencySavings = answers.liquid_emergency_savings;
  if (typeof emergencySavings === "string") rows.push({ label: "Emergency Savings", value: formatPeso(Math.round(Number(emergencySavings) * 100)), stepIndex: STEPS.findIndex((step) => step.questionKey === "liquid_emergency_savings") });
  const essentialCosts = answers.monthly_essential_living_costs;
  if (typeof essentialCosts === "string") rows.push({ label: "Monthly Essential Costs", value: essentialCosts === "not_sure" ? "Not sure" : formatPeso(Math.round(Number(essentialCosts) * 100)), stepIndex: STEPS.findIndex((step) => step.questionKey === "monthly_essential_living_costs") });
  addOptionRow("Currently Paying Off Debt", "paying_off_debt");
  const debtPercentage = answers.monthly_debt_payment_percentage;
  if (answers.paying_off_debt === "true" && typeof debtPercentage === "string") rows.push({ label: "Debt Payment Percentage", value: debtPercentage === "not_sure" ? "Not sure" : `${debtPercentage}%`, stepIndex: STEPS.findIndex((step) => step.questionKey === "monthly_debt_payment_percentage") });
  addOptionRow("Credit Card Payments", "credit_card_revolving_months");

  addMultiOptionRow("Higher-Expense Seasons", "high_expense_seasons");
  addMultiOptionRow("Lower-Expense Seasons", "low_expense_seasons");
  addMultiOptionRow("Savings Seasons", "saving_seasons");

  return (
    <View>
      {rows.map((row, i) => (
        <View key={i}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: LINE,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "500",
                  fontSize: 12,
                  color: MUTED,
                  marginBottom: 2,
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "600",
                  fontSize: 14,
                  color: INK,
                }}
              >
                {row.value}
              </Text>
            </View>
            <Pressable
              onPress={() => onEdit(row.stepIndex)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${row.label}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: AQUA50,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 12,
              }}
            >
              <PencilSimple size={14} color={AQUA600} />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
