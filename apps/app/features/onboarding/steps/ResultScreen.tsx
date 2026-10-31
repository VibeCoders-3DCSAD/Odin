import { Pressable, ScrollView, Text, View } from "react-native";
import { CheckCircle } from "phosphor-react-native";
import { FinancialHealthCard } from "../../dashboard/components/FinancialHealthCard";
import { AQUA50, AQUA600, AQUA950, ERROR, INK, MUTED } from "../colors";
import type { SubmitResult } from "../types";

export function ResultScreen({
  accessToken,
  result,
  error,
  onContinue,
}: {
  accessToken: string;
  result: SubmitResult;
  error: string | null;
  onContinue: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-card"
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
    >
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: AQUA50,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <CheckCircle size={36} color={AQUA600} weight="fill" />
        </View>

        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "800",
            fontSize: 26,
            color: INK,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Assessment Complete
        </Text>

        <Text
          style={{
            fontFamily: "Manrope",
            fontWeight: "400",
            fontSize: 14,
            color: MUTED,
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 20,
          }}
        >
          Your onboarding information has been saved.
        </Text>

        <View style={{ width: "100%", marginBottom: 20 }}>
          {result.assessment?.output_snapshot ? (
            <FinancialHealthCard accessToken={accessToken} initialClassification={result.assessment.output_snapshot} />
          ) : (
            <Text style={{ fontFamily: "Manrope", fontSize: 14, color: MUTED }}>
              Your classification is unavailable right now. You can try again from the dashboard check-in.
            </Text>
          )}
        </View>

        {error ? (
          <View
            style={{
              width: "100%",
              borderRadius: 14,
              padding: 16,
              backgroundColor: "#FFF0F2",
              borderWidth: 1,
              borderColor: "#FFCDD2",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "600",
                fontSize: 13,
                color: ERROR,
              }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue to Dashboard"
          style={{
            width: "100%",
            height: 54,
            borderRadius: 14,
            backgroundColor: AQUA950,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: AQUA950,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.28,
            shadowRadius: 20,
            elevation: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope",
              fontWeight: "700",
              fontSize: 15,
              color: "#FFFFFF",
            }}
          >
            Continue to Dashboard
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
