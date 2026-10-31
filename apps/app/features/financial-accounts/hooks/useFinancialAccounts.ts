import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  listFinancialAccounts,
  createFinancialAccount,
  updateFinancialAccount,
  deleteFinancialAccount,
  type FinancialAccount,
  type CreateFinancialAccountInput,
  type UpdateFinancialAccountInput,
} from "../../../local-db/repositories/foundations/financialFoundations";
import { type SavingsAccountDetailsInput, upsertSavingsAccountDetails, validateSavingsAccountDetails } from "../../../local-db/repositories/savings/savingsAccountDetails";
import { rebasedCurrentBalance } from "../helpers/accountDisplay";

type Options = { userId: string; deviceId: string; onSyncRequested?: () => void };

// Loads the user's accounts and persists create/update/delete. Callers reload and request sync after saves.
export function useFinancialAccounts({ userId, deviceId, onSyncRequested }: Options) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    const result = await listFinancialAccounts(userId);
    setAccounts(result);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const saveNewAccount = async (input: CreateFinancialAccountInput, savingsDetails: SavingsAccountDetailsInput | null) => {
    if (savingsDetails) validateSavingsAccountDetails(savingsDetails);
    const { account } = await createFinancialAccount(userId, deviceId, input);
    if (savingsDetails) await upsertSavingsAccountDetails(userId, deviceId, account.id, savingsDetails);
    return account;
  };

  const saveAccountChanges = async (account: FinancialAccount, input: CreateFinancialAccountInput, savingsDetails: SavingsAccountDetailsInput | null) => {
    if (savingsDetails) validateSavingsAccountDetails(savingsDetails);
    await updateFinancialAccount(userId, deviceId, account.id, {
      ...input,
      currentBalanceCentavos: rebasedCurrentBalance(account, input.openingBalanceCentavos ?? 0),
    } satisfies UpdateFinancialAccountInput);
    if (savingsDetails) await upsertSavingsAccountDetails(userId, deviceId, account.id, savingsDetails);
  };

  const confirmDeleteAccount = (account: FinancialAccount) => {
    Alert.alert(`Delete ${account.name}?`, "This account will be removed from active accounts. Its transaction history will be preserved.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteFinancialAccount(userId, deviceId, account.id); await loadAccounts(); onSyncRequested?.(); } },
    ]);
  };

  return { accounts, loading, loadAccounts, saveNewAccount, saveAccountChanges, confirmDeleteAccount };
}
