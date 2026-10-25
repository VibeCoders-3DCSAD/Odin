import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function UnderfundedCommitmentsDialog({ visible, onConfirm, onCancel }: Props) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.backdrop}>
      <View accessibilityRole="alert" style={styles.card}>
        <Text style={styles.title}>Continue with lower amounts?</Text>
        <Text style={styles.message}>Some savings, debt, or bill amounts are below their amount due. Lower debt and bill amounts may result in missed payments, and lower savings contributions may delay your goals.</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Review amounts" onPress={onCancel} style={[styles.button, styles.ghost]}><Text style={[styles.buttonText, styles.ghostText]}>Review amounts</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Yes, continue" onPress={onConfirm} style={styles.button}><Text style={styles.buttonText}>Yes, continue</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(27,28,26,0.4)", justifyContent: "center", padding: 28 },
  card: { backgroundColor: "#FCF8F0", borderRadius: 20, padding: 20, gap: 10 },
  title: { fontFamily: "Manrope", fontSize: 16, fontWeight: "800", color: "#1B1C1A" },
  message: { fontFamily: "Manrope", fontSize: 12, lineHeight: 18, color: "#414942" },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  button: { flex: 1, backgroundColor: "#013220", borderRadius: 14, padding: 14 },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#013220" },
  buttonText: { fontFamily: "Manrope", fontSize: 13, fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  ghostText: { color: "#013220" },
});
