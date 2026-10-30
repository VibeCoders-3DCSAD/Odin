import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { shellPalette as palette } from "../../shell/theme";

// Shown by /activity/new while it verifies its link, or when the link names records this user cannot open.
export function TransactionFormUnavailable({ loading, onClose }: { loading: boolean; onClose: () => void }) {
  if (loading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color={palette.brand} /></View>;
  }
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink, textAlign: "center" }}>
        This transaction can't be opened
      </Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8, textAlign: "center" }}>
        It may have been deleted or is no longer available.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}
        style={{ marginTop: 20, minHeight: 48, paddingHorizontal: 28, borderRadius: 14, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>Close</Text>
      </Pressable>
    </View>
  );
}
