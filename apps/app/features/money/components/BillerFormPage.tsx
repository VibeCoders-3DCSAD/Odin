import { useToast } from "../../../components/Toast";
import { ROUTES } from "../../../routes";
import { useSession } from "../../auth/components/AccessProvider";
import BillerFormScreen from "../../billers/BillerFormScreen";
import { goBackOr } from "../../shell/helpers/shellNavigation";
import { useSync } from "../../sync/SyncProvider";

// Back returns to whichever page opened the form: the list for adds and list edits, the detail for its edits.
export const closeBillerForm = () => goBackOr(ROUTES.moneyBillers);

// Add (no id) or edit a biller or remittance; the edit route verifies the id first.
export function BillerFormPage({ scheduledPaymentId }: { scheduledPaymentId?: string }) {
  const { userId, deviceId } = useSession();
  const { handleSync } = useSync();
  const { showToast } = useToast();
  return <BillerFormScreen userId={userId} deviceId={deviceId} scheduledPaymentId={scheduledPaymentId} onClose={closeBillerForm}
    onSaved={(message) => { showToast(message, "success"); closeBillerForm(); handleSync(); }} />;
}
