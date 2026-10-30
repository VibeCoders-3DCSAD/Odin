import { useSession } from "../../../../../features/auth/components/AccessProvider";
import DebtManagerOverview from "../../../../../features/debt-manager/DebtManagerOverview";

// TODO(plan routes): open the credit-card and non-credit-debt lists and details once they have routes.
const notRoutedYet = () => {};

export default function DebtsRoute() {
  const { userId } = useSession();
  return <DebtManagerOverview userId={userId} onOpenCreditCards={notRoutedYet} onOpenNonCreditDebts={notRoutedYet}
    onOpenCard={notRoutedYet} onOpenDebt={notRoutedYet} />;
}
