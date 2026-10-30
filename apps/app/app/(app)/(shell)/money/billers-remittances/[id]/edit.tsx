import { useLocalSearchParams } from "expo-router";
import { BillerFormPage, closeBillerForm } from "../../../../../../features/money/components/BillerFormPage";
import { OwnedRecord } from "../../../../../../features/money/components/OwnedRecord";
import { FullScreenPage } from "../../../../../../features/shell/components/FullScreenPage";
import { getScheduledPayment } from "../../../../../../local-db/repositories/scheduledPayments";

// Edit a biller or remittance. Link here only with billerEditHref() from features/money/moneyRoutes.
export default function EditBillerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FullScreenPage>
    <OwnedRecord id={id} load={getScheduledPayment} noun="biller or remittance" onClose={closeBillerForm}>
      {(scheduledPaymentId) => <BillerFormPage scheduledPaymentId={scheduledPaymentId} />}
    </OwnedRecord>
  </FullScreenPage>;
}
