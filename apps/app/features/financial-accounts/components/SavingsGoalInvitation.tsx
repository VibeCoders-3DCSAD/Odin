import { Modal, Pressable, Text, View } from "react-native";
import { v4, v4Font } from "../../../components/BudgieForm";

type Props = { onAddGoal: () => void; onDismiss: () => void };

export default function SavingsGoalInvitation({ onAddGoal, onDismiss }: Props) {
  return <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
    <View style={{ flex: 1, backgroundColor: "rgba(27,28,26,0.4)", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 420, backgroundColor: v4.surface, borderRadius: 20, padding: 20, gap: 16 }}>
        <Text accessibilityRole="header" style={{ fontFamily: v4Font, fontSize: 20, fontWeight: "800", color: v4.ink }}>Congratulations on your new savings account!</Text>
        <Text style={{ fontFamily: v4Font, fontSize: 14, color: v4.ink2 }}>Do you want to add a goal?</Text>
        <Pressable accessibilityRole="button" onPress={onAddGoal} style={{ backgroundColor: v4.brand, borderRadius: 10, padding: 14, alignItems: "center" }}>
          <Text style={{ fontFamily: v4Font, fontWeight: "700", color: v4.surface }}>Yes</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDismiss} style={{ borderColor: v4.hairline, borderWidth: 1, borderRadius: 10, padding: 14, alignItems: "center" }}>
          <Text style={{ fontFamily: v4Font, fontWeight: "700", color: v4.ink }}>Maybe next time</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
