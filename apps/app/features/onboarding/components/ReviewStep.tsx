import { Pressable, Text, View } from "react-native";
import { COLORS } from "../constants";
import type { OnboardingStepKey } from "../constants";

function formatAnswer(key: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key === "monthly_income" || key === "monthly_obligations") {
      return `₱${value.toLocaleString("en-PH")}`;
    }
    return String(value);
  }
  if (key === "income_type" && typeof value === "string") {
    const labels: Record<string, string> = {
      salary: "Salary",
      freelance: "Freelance",
      business: "Business",
      gig: "Gig Worker",
      investment: "Investment",
      other: "Other",
    };
    return labels[value] ?? value;
  }
  return String(value);
}

type ReviewStepProps = {
  answers: Record<string, unknown>;
  onEditStep: (step: OnboardingStepKey) => void;
};

export default function ReviewStep({ answers, onEditStep }: ReviewStepProps) {
  const answeredKeys = Object.keys(answers).filter(
    (k) => answers[k] !== undefined && answers[k] !== null && answers[k] !== "",
  );

  if (answeredKeys.length === 0) {
    return (
      <View className="items-center py-8">
        <Text
          className="text-sm"
          style={{ fontFamily: "Manrope", fontWeight: "400", color: COLORS.mut }}
        >
          No answers yet. Go back and fill in your information.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text
        className="text-lg"
        style={{ fontFamily: "Manrope", fontWeight: "700", color: COLORS.ink }}
      >
        Review your information
      </Text>
      <Text
        className="text-sm"
        style={{ fontFamily: "Manrope", fontWeight: "400", color: COLORS.mut }}
      >
        Check that everything looks right before submitting.
      </Text>
      <View className="gap-2">
        {answeredKeys.map((key) => (
          <View
            key={key}
            className="rounded-[14px] p-4"
            style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line }}
          >
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text
                  className="text-xs mb-0.5"
                  style={{ fontFamily: "Manrope", fontWeight: "500", color: COLORS.mut }}
                >
                  {key === "income_type"
                    ? "Income Type"
                    : key === "monthly_income"
                      ? "Monthly Income"
                      : key === "monthly_obligations"
                        ? "Monthly Obligations"
                        : key === "has_dependents"
                          ? "Has Dependents"
                          : key}
                </Text>
                <Text
                  className="text-sm"
                  style={{ fontFamily: "Manrope", fontWeight: "600", color: COLORS.ink }}
                >
                  {formatAnswer(key, answers[key])}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  const stepMap: Record<string, OnboardingStepKey> = {
                    income_type: "income_type",
                    monthly_income: "monthly_income",
                    monthly_obligations: "monthly_obligations",
                    has_dependents: "dependents",
                  };
                  const step = stepMap[key];
                  if (step) onEditStep(step);
                }}
                className="px-3 py-2 rounded-lg"
                style={{ backgroundColor: COLORS.brand }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ fontFamily: "Manrope", color: "#FFFFFF" }}
                >
                  Edit
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
