import { useToast } from "../../../components/Toast";
import { ROUTES } from "../../../routes";
import { useSession } from "../../auth/components/AccessProvider";
import IncomeSourceFormScreen from "../../income-sources/IncomeSourceFormScreen";
import { goBackOr } from "../../shell/helpers/shellNavigation";
import { useSync } from "../../sync/SyncProvider";

export const closeIncomeSourceForm = () => goBackOr(ROUTES.moneyIncome);

// Add (no id) or edit an income source; the edit route verifies the id first.
export function IncomeSourceFormPage({ incomeSourceId }: { incomeSourceId?: string }) {
  const { userId, deviceId } = useSession();
  const { handleSync } = useSync();
  const { showToast } = useToast();
  return <IncomeSourceFormScreen userId={userId} deviceId={deviceId} incomeSourceId={incomeSourceId} onClose={closeIncomeSourceForm}
    onSaved={(message) => { showToast(message, "success"); closeIncomeSourceForm(); handleSync(); }} />;
}
