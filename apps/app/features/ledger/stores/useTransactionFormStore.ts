import { create } from "zustand";
import type { UnusualSpendingInsight } from "../../../local-db/repositories/alerts/unusualSpending";

type TransactionFormState = {
  // Bumped when /activity/new saves a new transaction or closes an edit (the form does not say whether an
  // edit was saved). Screens left mounted under the form can use it as a reload key.
  formVersion: number;
  // The insight from the last create, shown once by Activity and then dismissed. Objects never go through route params.
  pendingUnusualSpending: UnusualSpendingInsight | null;
  recordCreated: (unusualSpending: UnusualSpendingInsight | null) => void;
  recordEditClosed: () => void;
  dismissUnusualSpending: () => void;
};

export const useTransactionFormStore = create<TransactionFormState>((set) => ({
  formVersion: 0,
  pendingUnusualSpending: null,
  recordCreated: (pendingUnusualSpending) => set((state) => ({ formVersion: state.formVersion + 1, pendingUnusualSpending })),
  recordEditClosed: () => set((state) => ({ formVersion: state.formVersion + 1 })),
  dismissUnusualSpending: () => set({ pendingUnusualSpending: null }),
}));
