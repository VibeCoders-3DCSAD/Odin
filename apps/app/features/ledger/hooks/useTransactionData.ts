import { useEffect, useState } from "react";
import type { FinancialAccount } from "../../../local-db/repositories/financialAccounts";
import type { Subcategory } from "../../../local-db/repositories/taxonomy";
import { listFinancialAccounts } from "../../../local-db/repositories/financialAccounts";
import { listSubcategories } from "../../../local-db/repositories/taxonomy";

type TransactionKind = "expense" | "income" | "transfer";

export function useTransactionData(userId: string, kind: TransactionKind) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [accts, subs] = await Promise.all([
          listFinancialAccounts(userId, "active"),
          kind !== "transfer"
            ? listSubcategories(userId, undefined, kind as "income" | "expense")
            : Promise.resolve([] as Subcategory[]),
        ]);
        if (!cancelled) {
          setAccounts(accts);
          setSubcategories(subs);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, kind]);

  return { accounts, subcategories, loading, error };
}
