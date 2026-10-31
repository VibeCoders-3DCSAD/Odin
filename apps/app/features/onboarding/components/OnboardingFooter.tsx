import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { CaretRight } from "phosphor-react-native";
import { AQUA950, CARD, LINE } from "../colors";

// Sticky bottom CTA: "Submit Assessment" on the review step, "Continue" otherwise.
export function OnboardingFooter({
  isReview,
  submitting,
  onSubmit,
  onContinue,
}: {
  isReview: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onContinue: () => void;
}) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 36,
        backgroundColor: CARD,
        borderTopWidth: 1,
        borderTopColor: LINE,
      }}
    >
      {isReview ? (
        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Submit assessment"
          style={{
            height: 54,
            borderRadius: 14,
            backgroundColor: AQUA950,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 8,
            opacity: submitting ? 0.45 : 1,
            shadowColor: AQUA950,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.28,
            shadowRadius: 20,
            elevation: 6,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "700",
                fontSize: 15,
                color: "#FFFFFF",
              }}
            >
              Submit Assessment
            </Text>
          )}
        </Pressable>
      ) : (
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          style={{
            height: 54,
            borderRadius: 14,
            backgroundColor: AQUA950,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 8,
            opacity: 1,
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
            Continue
          </Text>
          <CaretRight size={16} color="#FFFFFF" weight="bold" />
        </Pressable>
      )}
    </View>
  );
}
