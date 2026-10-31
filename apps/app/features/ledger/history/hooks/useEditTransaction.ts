import { useCallback, useEffect, useRef, useState } from "react";
import { getTransaction, type Transaction, type TransactionListItem } from "../../../../local-db/repositories/ledger/ledger";
import { useToast } from "../../../../components/Toast";

type EditTargetOptions = {
  getScrollOffset?: () => number;
  scrollTo?: (y: number) => void;
  onEditingChange?: (editing: boolean) => void;
};

// The transaction being edited and the list scroll offset to return to once the form closes.
export function useEditTarget({ getScrollOffset, scrollTo, onEditingChange }: EditTargetOptions) {
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const listScrollY = useRef<number | null>(null);

  const editing = editTarget !== null;
  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);

  const beginEdit = useCallback((transaction: Transaction) => {
    listScrollY.current = getScrollOffset?.() ?? null;
    setEditTarget(transaction);
  }, [getScrollOffset]);

  // The edit form shares the shell's scroll view, so the list's offset is restored once it is laid out again;
  // any earlier and the scroll view is still only as tall as the form.
  function restoreListScroll() {
    if (editTarget || listScrollY.current === null) return;
    scrollTo?.(listScrollY.current);
    listScrollY.current = null;
  }

  return { editTarget, editing, beginEdit, closeEdit: () => setEditTarget(null), restoreListScroll };
}

// Opens a row in the edit form, refusing scheduled payments which must be deleted and recorded again.
export function useEditTransaction(userId: string, transactions: TransactionListItem[], beginEdit: (transaction: Transaction) => void) {
  const { showToast } = useToast();
  // Stable so memoized rows skip re-rendering on unrelated state changes like search typing.
  return useCallback((transactionId: string) => {
    if (transactions.some((transaction) => transaction.id === transactionId && transaction.is_scheduled_payment)) {
      showToast("This transaction pays a biller or remittance. Delete it and record the payment again.", "danger");
      return;
    }
    getTransaction(userId, transactionId)
      .then((transaction) => {
        if (!transaction) {
          showToast("Transaction not found", "danger");
          return;
        }
        beginEdit(transaction);
      })
      .catch(() => showToast("Could not open transaction", "danger"));
  }, [userId, showToast, beginEdit, transactions]);
}
