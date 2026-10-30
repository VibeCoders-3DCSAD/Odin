import { router } from "expo-router";
import { useSession } from "../../../../../../features/auth/components/AccessProvider";
import PastFinancialPlansScreen from "../../../../../../features/financial-plan/PastFinancialPlansScreen";
import { InnerPage } from "../../../../../../features/shell/components/InnerPage";
import { ROUTES } from "../../../../../../routes";

function PastPlans() {
  const { userId } = useSession();
  return <PastFinancialPlansScreen userId={userId} onOpenPlan={(id) => router.push({ pathname: ROUTES.planPastPlan, params: { id } })} />;
}

export default function PastPlansRoute() {
  return <InnerPage title="Past Plans" fallbackHref={ROUTES.planBudgets}><PastPlans /></InnerPage>;
}
