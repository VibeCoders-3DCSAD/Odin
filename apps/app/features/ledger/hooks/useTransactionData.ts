import { useEffect, useMemo, useState } from "react";
import type { FinancialAccount } from "../../../local-db/repositories/foundations/financialFoundations";
import type { Category, Subcategory } from "../../../local-db/repositories/ledger/taxonomy";
import { listFinancialAccounts } from "../../../local-db/repositories/foundations/financialFoundations";
import { listCategories, listSubcategories } from "../../../local-db/repositories/ledger/taxonomy";

type TransactionKind = "expense" | "income" | "transfer";

const NO_CATEGORIES: Category[] = [];
const NO_SUBCATEGORIES: Subcategory[] = [];

// Loads everything once per user so switching the transaction type never
// flips `loading` back on and remounts the form.
export function useTransactionData(userId: string, kind: TransactionKind) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [subcategoriesByKind, setSubcategoriesByKind] = useState<Record<"expense" | "income", Subcategory[]>>({ expense: [], income: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [accts, localCategories, expenseSubs, incomeSubs] = await Promise.all([
          listFinancialAccounts(userId),
          listCategories(userId),
          listSubcategories(userId, undefined, "expense"),
          listSubcategories(userId, undefined, "income"),
        ]);
        if (!cancelled) {
          setAccounts(accts);
          setAllCategories(localCategories);
          setSubcategoriesByKind({ expense: expenseSubs, income: incomeSubs });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const categories = kind === "transfer" ? NO_CATEGORIES : allCategories;
  const subcategories = useMemo(
    () => (kind === "transfer" ? NO_SUBCATEGORIES : subcategoriesByKind[kind]),
    [kind, subcategoriesByKind],
  );

  return { accounts, categories, subcategories, loading, error };
}
