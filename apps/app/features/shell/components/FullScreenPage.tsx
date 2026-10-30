import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { shellPalette } from "../theme";

// Screens that draw their own header (forms) get no shell chrome around them.
export function FullScreenPage({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ backgroundColor: shellPalette.shell }} className="flex-1">
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}
