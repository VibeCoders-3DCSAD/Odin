import { Text, View } from "react-native";
import { FormCard, Note, PickerField, Segment, styles as ui, v4 } from "../../../components/BudgieForm";
import type { CreditCardPurchase } from "../hooks/useCreditCardPurchase";
import { formatDate, fromDateKey } from "../helpers/transactionFormat";
import CreditCardInstallmentFields from "./CreditCardInstallmentFields";

type Props = {
  card: CreditCardPurchase;
  isEdit: boolean;
  onPickPostingDate: () => void;
};

export default function CreditCardPurchaseCard({ card, isEdit, onPickPostingDate }: Props) {
  return (
    <FormCard title="This is a credit card">
      <Segment
        options={[{ key: "regular", label: "Regular purchase" }, { key: "installment", label: "Installment" }]}
        value={card.creditCardPurchaseType}
        onChange={card.setCreditCardPurchaseType}
        disabled={isEdit}
      />
      {isEdit ? <Note>Purchase type is locked after creation. Installment transactions cannot be converted or edited once billing-cycle amortizations may exist.</Note> : null}
      <View>
        <PickerField
          label="Posting date (optional)"
          value={card.postingDate ? formatDate(fromDateKey(card.postingDate)) : "Select posting date"}
          placeholder={!card.postingDate}
          accessibilityLabel="Credit-card posting date"
          onPress={onPickPostingDate}
        />
        <Text style={[ui.note, { marginTop: 5, color: v4.mut }]}>
          Use YYYY-MM-DD when the issuer provides a posting date. Otherwise Budgie uses the transaction date as an estimate.
        </Text>
      </View>
      {card.creditCardPurchaseType === "installment" ? <CreditCardInstallmentFields value={card.installment} errors={card.installmentErrors} readOnly={card.editInstallmentLocked} onChange={card.changeInstallment} /> : null}
    </FormCard>
  );
}
