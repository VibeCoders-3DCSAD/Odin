import { router } from "expo-router";
import { useSession } from "../../../../../../features/auth/components/AccessProvider";
import DebtManagerScreen from "../../../../../../features/debt-manager/DebtManagerScreen";
import { InnerPage } from "../../../../../../features/shell/components/InnerPage";
import { useShellPage } from "../../../../../../features/shell/components/PageScroll";
import { ROUTES } from "../../../../../../routes";

function CreditCards() {
  const { userId, deviceId } = useSession();
  const { goBack } = useShellPage();
  return <DebtManagerScreen userId={userId} deviceId={deviceId} onBack={goBack}
    onOpenCard={(id) => router.push({ pathname: ROUTES.planCreditCard, params: { id } })} />;
}

export default function CreditCardsRoute() {
  return <InnerPage title="Credit Cards" fallbackHref={ROUTES.planDebts}><CreditCards /></InnerPage>;
}
