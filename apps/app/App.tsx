import "./global.css";

import { StatusBar } from "expo-status-bar";
import { SafeAreaView, Text, View } from "react-native";
import { Button, PaperProvider } from "react-native-paper";

export default function App() {
  return (
    <PaperProvider>
      <SafeAreaView className="flex-1 bg-canvas px-6 py-10">
        <View className="flex-1 justify-between">
          <View className="gap-4">
            <Text className="text-sm font-medium uppercase tracking-[2px] text-accent">
              Odin QA
            </Text>
            <Text className="text-4xl font-bold leading-tight text-ink">
              Google auth smoke test
            </Text>
            <Text className="text-base leading-6 text-slate-600">
              Google Sign-In is only available in the native dev build right
              now. Use iOS or Android for this smoke test.
            </Text>
          </View>

          <Button disabled mode="contained">
            Native only
          </Button>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </PaperProvider>
  );
}
