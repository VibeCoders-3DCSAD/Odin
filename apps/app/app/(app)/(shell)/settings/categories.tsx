import { useSession } from "../../../../features/auth/components/AccessProvider";
import { InnerPage } from "../../../../features/shell/components/InnerPage";
import { useShellPage } from "../../../../features/shell/components/PageScroll";
import { useSync } from "../../../../features/sync/SyncProvider";
import TaxonomyScreen from "../../../../features/taxonomy/TaxonomyScreen";
import { ROUTES } from "../../../../routes";

function Categories() {
  const { userId, deviceId } = useSession();
  const { syncVersion } = useSync();
  const { goBack, setBackIntercept } = useShellPage();
  return <TaxonomyScreen userId={userId} deviceId={deviceId} syncVersion={syncVersion} onBack={goBack} onBackInterceptChange={setBackIntercept} />;
}

export default function CategoriesRoute() {
  return <InnerPage title="Categories" fallbackHref={ROUTES.settings}><Categories /></InnerPage>;
}
