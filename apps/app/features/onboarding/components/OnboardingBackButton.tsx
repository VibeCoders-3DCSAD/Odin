import { Pressable, Text, View } from "react-native";
import { CaretLeft } from "phosphor-react-native";
import { INK2 } from "../colors";

export function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className="px-5 pb-2"
    >
      <View className="flex-row items-center gap-1">
        <CaretLeft size={16} color={INK2} weight="bold" />
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: INK2 }}>
          Back
        </Text>
      </View>
    </Pressable>
  );
}
