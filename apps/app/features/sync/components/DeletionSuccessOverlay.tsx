import { CheckCircle } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { shellPalette as palette } from "../../shell/theme";

type Props = { scheduledDate: string; onBackToLogin: () => void };

// Covers the whole shell after an account deletion request; the only way out is logging out.
export function DeletionSuccessOverlay({ scheduledDate: deletionSuccessDate, onBackToLogin }: Props) {
  return (
    <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.shell }}>
      <View style={{ flex: 1, paddingHorizontal: 30, justifyContent: "center", alignItems: "center" }}>
        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "#EFFEF7", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
          <CheckCircle size={56} color={palette.success} weight="fill" />
        </View>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: palette.ink }}>
          Deletion requested
        </Text>
        <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 14, lineHeight: 22.4, color: palette.mut, marginTop: 10, textAlign: "center", maxWidth: 270 }}>
          Your account is scheduled for deletion. You have{" "}
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: palette.ink2 }}>30 days</Text>
          {" "}to cancel by logging back in. After that, all data is permanently erased.
        </Text>
        <View style={{ width: "100%", marginTop: 26, padding: 16, borderRadius: 14, backgroundColor: "#F8EFDC", borderWidth: 1, borderColor: palette.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12.5, color: palette.mut }}>
              Scheduled deletion
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.ink }}>
              {new Date(deletionSuccessDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onBackToLogin}
          accessibilityRole="button"
          accessibilityLabel="Back to login"
          style={{
            width: "100%", marginTop: 26, height: 52, borderRadius: 14,
            backgroundColor: palette.brand,
            justifyContent: "center", alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14.5, color: "#FFFFFF" }}>
            Back to login
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
