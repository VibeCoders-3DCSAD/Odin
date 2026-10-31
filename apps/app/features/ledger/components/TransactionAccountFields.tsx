import { PickerField } from "../../../components/BudgieForm";
import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";
import type { TransactionFormFields } from "../hooks/useTransactionFormFields";
import SavingsContributionAccounts from "./SavingsContributionAccounts";

type Props = {
  userId: string;
  transactionId?: string;
  accounts: FinancialAccount[];
  fields: TransactionFormFields;
  onPickAccount: (mode: "source" | "dest") => void;
};

// A savings contribution picks only its source (the goal fixes the destination); a plain transfer
// picks both ends; income and expense pick the one account they touch.
export default function TransactionAccountFields({ userId, transactionId, accounts, fields, onPickAccount }: Props) {
  const { txType, contributionGoalId, sourceAccountId, destAccountId, formError } = fields;
  const accountName = (id: string) => (id ? accounts.find((a) => a.id === id)?.name ?? "Select account" : "Select account");

  if (txType === "transfer" && contributionGoalId) {
    return <SavingsContributionAccounts key={contributionGoalId} userId={userId} goalId={contributionGoalId} transactionId={transactionId} accounts={accounts} sourceAccountId={sourceAccountId} onSourceChange={fields.setSourceAccountId} />;
  }
  if (txType === "transfer" && fields.isSavingsContribution) return null;
  if (txType === "transfer") {
    return (
      <>
        <PickerField
          label="From account"
          value={accountName(sourceAccountId)}
          placeholder={!sourceAccountId}
          error={formError === "Select a source account"}
          onPress={() => onPickAccount("source")}
        />
        <PickerField
          label="To account"
          value={accountName(destAccountId)}
          placeholder={!destAccountId}
          error={formError === "Select a destination account"}
          onPress={() => onPickAccount("dest")}
        />
      </>
    );
  }
  return (
    <PickerField
      label={txType === "income" ? "Destination account" : "Account"}
      value={accountName(txType === "income" ? destAccountId : sourceAccountId)}
      placeholder={txType === "income" ? !destAccountId : !sourceAccountId}
      error={formError === "Select a source account" || formError === "Select a destination account"}
      accessibilityLabel="Select account"
      onPress={() => onPickAccount(txType === "income" ? "dest" : "source")}
    />
  );
}
