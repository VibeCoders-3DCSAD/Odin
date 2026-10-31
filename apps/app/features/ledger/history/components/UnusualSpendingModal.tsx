import { Image, Modal, Text, View } from "react-native";
import type { SpendingRecurrence, UnusualSpendingInsight } from "../../../../local-db/repositories/alerts/unusualSpending";
import RecurrenceQuestion from "../../../alerts/RecurrenceQuestion";
import { dashboardColors as P } from "../../../dashboard/dashboardAppearance";
import { formatPeso } from "../../../../lib/format/money";

const budgieThink = require("../../../../assets/budgie-think.png");

type Props = {
  visible: boolean;
  unusualSpending: UnusualSpendingInsight | null;
  onAnswer: (recurrence: SpendingRecurrence, months?: number[]) => Promise<void>;
};

// Unanswered on purpose: the only way out is one of the three answers.
export function UnusualSpendingModal({ visible, unusualSpending, onAnswer }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View style={{ borderRadius: 20, padding: 22, backgroundColor: P.surface }}>
          <Image source={budgieThink} accessibilityIgnoresInvertColors style={{ width: "100%", height: undefined, aspectRatio: 3 / 2 }} resizeMode="contain" />
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink, marginTop: 12, textAlign: "center" }}>Budgie wants to learn about you</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.secondary, marginTop: 10, textAlign: "center" }}>
            You spent {formatPeso(unusualSpending?.amountCentavos ?? 0)} on {unusualSpending?.subcategoryLabel ?? "this subcategory"}, more than your usual {formatPeso(unusualSpending?.usualSpendingCentavos ?? 0)}. Will you be making this expense again?
          </Text>
          <View style={{ marginTop: 18 }}>
            {unusualSpending ? <RecurrenceQuestion key={unusualSpending.transactionId} transactionDate={unusualSpending.transactionDate} onAnswer={onAnswer} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
