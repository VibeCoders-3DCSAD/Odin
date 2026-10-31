import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { dashboardColors as P } from "../../../dashboard/dashboardAppearance";

type ConfirmProps = {
  visible: boolean;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteTransactionModal({ visible, deleting, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
        <View style={{ borderRadius: 20, backgroundColor: P.surface, padding: 20 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
            Delete transaction?
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: P.secondary, marginTop: 8 }}>
            This will reverse any balance changes. The transaction will remain as a tombstone record and stay syncable.
          </Text>
          <View style={{ gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={onConfirm}
              disabled={deleting}
              style={{ minHeight: 50, borderRadius: 12, backgroundColor: P.error, alignItems: "center", justifyContent: "center" }}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
                  Delete
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={onCancel}
              style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: P.border, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function InstallmentDeleteBlockedModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
        <View style={{ borderRadius: 20, backgroundColor: P.surface, padding: 20 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
            Cannot delete installment purchase
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: P.secondary, marginTop: 8 }}>
            Installment transactions cannot be deleted after creation because billing-cycle amortizations, issuer statement values, and available-credit holds may already depend on them.
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: P.secondary, marginTop: 8 }}>
            Record an issuer-recognized settlement or reversal separately when that flow is available.
          </Text>
          <Pressable
            onPress={onClose}
            style={{ minHeight: 50, borderRadius: 12, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", marginTop: 18 }}
            accessibilityRole="button"
            accessibilityLabel="Close installment delete restriction"
          >
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
              Got it
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
