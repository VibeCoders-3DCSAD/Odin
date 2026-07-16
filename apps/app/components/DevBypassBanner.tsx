import { Text, View } from "react-native";
import { isDevAuthBypassEnabled } from "../lib/devBypass";

/** Visible only when local auth bypass is active. Never ship enabled to main. */
export default function DevBypassBanner() {
  if (!isDevAuthBypassEnabled) return null;

  return (
    <View className="bg-[#FFF8E7] px-4 py-2">
      <Text className="text-center text-xs font-medium text-[#8A6A00]">
        Local preview mode — auth and API calls are bypassed
      </Text>
    </View>
  );
}
