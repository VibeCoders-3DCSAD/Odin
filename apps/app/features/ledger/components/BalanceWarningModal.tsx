import { Modal, Pressable, Text, View } from "react-native";
import { Note, styles as ui, v4, v4Font } from "../../../components/BudgieForm";
import type { BalanceWarning } from "../helpers/balanceWarning";
import { formatCurrency } from "../helpers/transactionFormat";

type Props = {
  warning: BalanceWarning | null;
  onCancel: () => void;
  onConfirm: () => void;
};

// Asks before a save takes the paying account's available balance or credit below zero.
export default function BalanceWarningModal({ warning, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={warning !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(27,28,26,0.4)" }}>
        <Pressable onPress={() => {}}>
          <View style={{ borderRadius: 20, padding: 20, backgroundColor: v4.surface, gap: 10 }}>
            <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 17, color: v4.ink }}>Insufficient available balance</Text>
            <Text style={{ fontFamily: v4Font, fontSize: 13.5, lineHeight: 20, color: v4.ink2 }}>
              {warning?.isCreditCard
                ? `This transaction exceeds ${warning.accountName}'s available credit by ${formatCurrency(warning.deficitCentavos)}.`
                : `This transaction exceeds ${warning?.accountName}'s available balance by ${formatCurrency(warning?.deficitCentavos ?? 0)}.`}
            </Text>
            <Note>
              Continue recording? The available {warning?.isCreditCard ? "credit" : "balance"} will be negative.
            </Note>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel transaction" style={[ui.button, ui.buttonGhost, { flex: 1 }]}>
                <Text style={[ui.buttonText, ui.buttonGhostText]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                accessibilityRole="button"
                accessibilityLabel="Confirm record transaction"
                style={[ui.button, { flex: 1 }]}
              >
                <Text style={ui.buttonText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
