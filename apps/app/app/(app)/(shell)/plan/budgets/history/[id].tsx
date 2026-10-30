import { useLocalSearchParams } from "expo-router";
import { useSession } from "../../../../../../features/auth/components/AccessProvider";
import PastFinancialPlanDetailScreen from "../../../../../../features/financial-plan/PastFinancialPlanDetailScreen";
import { OwnedRecordPage, type OwnsRecord } from "../../../../../../features/shell/components/OwnedRecordPage";
import { useShellPage } from "../../../../../../features/shell/components/PageScroll";
import { getFinancialPlan } from "../../../../../../local-db/repositories/financialPlans";
import { ROUTES } from "../../../../../../routes";

const ownsPlan: OwnsRecord = async (userId, id) => (await getFinancialPlan(userId, id)) !== null;

function PastPlan({ planId }: { planId: string }) {
  const { userId } = useSession();
  const { goBack } = useShellPage();
  return <PastFinancialPlanDetailScreen userId={userId} planId={planId} onBack={goBack} />;
}

export default function PastPlanRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OwnedRecordPage title="Past Plan" fallbackHref={ROUTES.planPastPlans} id={id} owns={ownsPlan}
    notFoundMessage="This plan can't be opened">
    {(planId) => <PastPlan planId={planId} />}
  </OwnedRecordPage>;
}
