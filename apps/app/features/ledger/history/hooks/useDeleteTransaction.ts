import { useCallback, useState } from "react";
import { deleteTransaction, getTransaction, type Transaction } from "../../../../local-db/repositories/ledger/ledger";
import { getCreditCardPurchaseMetadataForTransaction } from "../../../../local-db/repositories/credit-cards/creditCardInstallments";
import { runSync } from "../../../../local-db/sync/runSync";
import { useToast } from "../../../../components/Toast";

type Options = {
  userId: string;
  deviceId: string;
  accessToken: string;
  // Called after the delete is saved so the list can drop the row and refresh.
  onDeleted: (transactionId: string) => void;
};

// Confirmed deletes, with installment purchases blocked behind their own explanation.
export function useDeleteTransaction({ userId, deviceId, accessToken, onDeleted }: Options) {
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteBlockedTarget, setDeleteBlockedTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Stable so memoized rows skip re-rendering on unrelated state changes like search typing.
  const selectDeleteTarget = useCallback((transactionId: string) => {
    getTransaction(userId, transactionId)
      .then((transaction) => {
        if (!transaction) {
          showToast("Transaction not found", "danger");
          return;
        }
        return requestDelete(transaction);
      })
      .catch(() => showToast("Could not open transaction", "danger"));
  }, [userId, showToast]);

  async function requestDelete(transaction: Transaction) {
    if (transaction.transaction_type === "expense" && transaction.source_account_id) {
      try {
        const metadata = await getCreditCardPurchaseMetadataForTransaction(userId, transaction.id);
        if (metadata?.purchase_type === "installment") {
          setDeleteBlockedTarget(transaction);
          return;
        }
      } catch {
        setDeleteBlockedTarget(transaction);
        return;
      }
    }
    setDeleteTarget(transaction);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTransaction(userId, deviceId, deleteTarget.id);
      showToast("Transaction deleted", "success");
      runSync(userId, deviceId, accessToken).catch(() => {});
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      onDeleted(deletedId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "danger");
    } finally {
      setDeleting(false);
    }
  }

  return {
    deleteTarget,
    deleteBlockedTarget,
    deleting,
    selectDeleteTarget,
    confirmDelete,
    cancelDelete: () => setDeleteTarget(null),
    closeDeleteBlocked: () => setDeleteBlockedTarget(null),
  };
}
