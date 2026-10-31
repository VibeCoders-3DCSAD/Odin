import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../../../../../../features/auth/components/AccessProvider";
import DebtManagerScreen from "../../../../../../features/debt-manager/DebtManagerScreen";
import { transactionFormHref } from "../../../../../../features/ledger/transactionFormRoute";
import { OwnedRecordPage, type LoadOwnedRecord } from "../../../../../../features/shell/components/OwnedRecord";
import { useShellPage } from "../../../../../../features/shell/components/PageScroll";
import { getFinancialAccount } from "../../../../../../local-db/repositories/financialFoundations";
import { ROUTES } from "../../../../../../routes";

const ownsCreditCard: LoadOwnedRecord = async (userId, id) => (await getFinancialAccount(userId, id))?.kind === "credit_card";

function CreditCard({ accountId }: { accountId: string }) {
  const { userId, deviceId } = useSession();
  const { goBack } = useShellPage();
  return <DebtManagerScreen userId={userId} deviceId={deviceId} accountId={accountId} onBack={goBack}
    onPayStatement={({ statementId, cycleId }) => router.push(transactionFormHref({ kind: "pay-statement", statementId, cycleId }))}
    onEditPayment={(payment) => router.push(transactionFormHref({
      kind: "edit-statement-payment", transactionId: payment.transaction_id, statementId: payment.statement_id, cycleId: payment.cycle_id,
    }))} />;
}

export default function CreditCardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OwnedRecordPage title="Credit Card" fallbackHref={ROUTES.planCreditCards} id={id} load={ownsCreditCard}
    noun="credit card">
    {(accountId) => <CreditCard accountId={accountId} />}
  </OwnedRecordPage>;
}
