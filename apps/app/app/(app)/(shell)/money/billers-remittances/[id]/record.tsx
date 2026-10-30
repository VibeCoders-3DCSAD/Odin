import { useLocalSearchParams } from "expo-router";
import { useToast } from "../../../../../../components/Toast";
import { useSession } from "../../../../../../features/auth/components/AccessProvider";
import RecordBillerPaymentScreen from "../../../../../../features/billers/RecordBillerPaymentScreen";
import { OwnedRecord } from "../../../../../../features/money/components/OwnedRecord";
import { billerHref } from "../../../../../../features/money/moneyRoutes";
import { FullScreenPage } from "../../../../../../features/shell/components/FullScreenPage";
import { goBackOr } from "../../../../../../features/shell/helpers/shellNavigation";
import { useSync } from "../../../../../../features/sync/SyncProvider";
import { getScheduledPayment } from "../../../../../../local-db/repositories/scheduledPayments";
import { ROUTES } from "../../../../../../routes";

// Pay a biller or remittance, then return to its detail. Link here only with billerRecordHref() from features/money/moneyRoutes.
export default function RecordBillerPaymentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, deviceId } = useSession();
  const { handleSync } = useSync();
  const { showToast } = useToast();
  return <FullScreenPage>
    <OwnedRecord id={id} load={getScheduledPayment} noun="biller or remittance" onClose={() => goBackOr(ROUTES.moneyBillers)}>
      {(scheduledPaymentId) => {
        const back = () => goBackOr(billerHref(scheduledPaymentId));
        return <RecordBillerPaymentScreen userId={userId} deviceId={deviceId} scheduledPaymentId={scheduledPaymentId} onClose={back}
          onRecorded={(message) => { showToast(message, "success"); back(); handleSync(); }} />;
      }}
    </OwnedRecord>
  </FullScreenPage>;
}
