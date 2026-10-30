import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../../../../../../features/auth/components/AccessProvider";
import BillerDetailScreen from "../../../../../../features/billers/BillerDetailScreen";
import { OwnedRecord } from "../../../../../../features/shell/components/OwnedRecord";
import { billerEditHref, billerRecordHref } from "../../../../../../features/money/moneyRoutes";
import { InnerPage } from "../../../../../../features/shell/components/InnerPage";
import { useShellPage } from "../../../../../../features/shell/components/PageScroll";
import { useSync } from "../../../../../../features/sync/SyncProvider";
import { getScheduledPayment } from "../../../../../../local-db/repositories/scheduledPayments";
import { ROUTES } from "../../../../../../routes";

function Detail({ id }: { id: string | string[] | undefined }) {
  const { userId, deviceId } = useSession();
  const { syncVersion, handleSync } = useSync();
  const { goBack } = useShellPage();
  return <OwnedRecord id={id} load={getScheduledPayment} noun="biller or remittance" onClose={goBack}>
    {(scheduledPaymentId) => <BillerDetailScreen userId={userId} deviceId={deviceId} scheduledPaymentId={scheduledPaymentId} syncVersion={syncVersion}
      onEdit={() => router.push(billerEditHref(scheduledPaymentId))} onRecordPayment={() => router.push(billerRecordHref(scheduledPaymentId))}
      onDeleted={() => router.dismissTo(ROUTES.moneyBillers)} onSyncRequested={handleSync} />}
  </OwnedRecord>;
}

// A biller or remittance's schedule and payments. Link here only with billerHref() from features/money/moneyRoutes.
export default function BillerDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InnerPage title="Biller or Remittance" fallbackHref={ROUTES.moneyBillers}><Detail id={id} /></InnerPage>;
}
