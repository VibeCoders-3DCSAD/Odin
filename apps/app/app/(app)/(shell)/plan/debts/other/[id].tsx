import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../../../../../../features/auth/components/AccessProvider";
import NonCreditDebtDetailScreen from "../../../../../../features/debt-manager/NonCreditDebtDetailScreen";
import { transactionFormHref } from "../../../../../../features/ledger/transactionFormRoute";
import { OwnedRecordPage, type LoadOwnedRecord } from "../../../../../../features/shell/components/OwnedRecord";
import { useShellPage } from "../../../../../../features/shell/components/PageScroll";
import { listDebtAccounts } from "../../../../../../local-db/repositories/debts/debtAccounts";
import { ROUTES } from "../../../../../../routes";

// "all" is what the detail screen itself looks the debt up in, so archived and deleted debts still open.
const ownsDebt: LoadOwnedRecord = async (userId, id) => (await listDebtAccounts(userId, "all")).some((debt) => debt.id === id);

function OtherDebt({ debtId }: { debtId: string }) {
  const { userId, deviceId } = useSession();
  const { goBack } = useShellPage();
  return <NonCreditDebtDetailScreen userId={userId} deviceId={deviceId} debtId={debtId} onBack={goBack}
    onRecordPayment={(debtAccountId) => router.push(transactionFormHref({ kind: "record-debt-payment", debtAccountId }))}
    onEditPayment={(payment) => router.push(transactionFormHref({
      kind: "edit-debt-payment", transactionId: payment.transaction_id, debtPaymentId: payment.id, debtAccountId: payment.debt_account_id,
    }))} />;
}

export default function OtherDebtRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OwnedRecordPage title="Non Credit Card Debts" fallbackHref={ROUTES.planOtherDebts} id={id} load={ownsDebt}
    noun="debt">
    {(debtId) => <OtherDebt debtId={debtId} />}
  </OwnedRecordPage>;
}
