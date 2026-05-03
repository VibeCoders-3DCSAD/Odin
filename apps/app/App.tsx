import "./global.css";

import { StatusBar } from "expo-status-bar";
import { SafeAreaView, Text, View } from "react-native";
import { Button, PaperProvider } from "react-native-paper";

export default function App() {
  return (
    <PaperProvider>
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-1 justify-between px-6 py-10">
          <View className="gap-4">
            <Text className="text-sm font-medium uppercase tracking-[2px] text-accent">
              Odin
            </Text>
            <Text className="text-4xl font-bold leading-tight text-ink">
              Expo, React Native Web, and NativeWind are wired up.
            </Text>
            <Text className="text-base leading-6 text-slate-600">
              This starter is ready for cross-platform feature work with shared
              TypeScript configuration.
            </Text>
          </View>

          <Button mode="contained" onPress={() => undefined}>
            Open the app shell
          </Button>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </PaperProvider>
  );
}
