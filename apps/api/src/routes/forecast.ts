import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  buildEmptyForecast,
  buildForecast,
  type ForecastTransaction,
} from "../services/forecastService.js";

const router = Router();

// ponytail: single mock provider today. Switching FORECAST_PROVIDER to the ML
// endpoint later replaces the two Supabase reads below with a provider call
// without touching the app caller or the panel.
const FORECAST_PROVIDER = process.env.FORECAST_PROVIDER ?? "mock";

type TransactionRow = {
  transaction_type: ForecastTransaction["transaction_type"];
  amount_centavos: number;
  transaction_date: string;
  subcategories: { label: string } | { label: string }[] | null;
};

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  if (FORECAST_PROVIDER !== "mock") {
    response.status(503).json({
      error: "Service Unavailable",
      message: "The forecast provider is not enabled yet.",
    });
    return;
  }

  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  const today = new Date();
  const windowStart = dateKey(today.getFullYear(), today.getMonth() - 3, 1);

  const { data: accounts, error: accountsError } = await authenticatedSupabase
    .from("financial_accounts")
    .select("current_balance_centavos")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("include_in_dashboard_balance", true)
    .is("deleted_at", null);

  if (accountsError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to load account balances",
    });
    return;
  }

  const openingBalanceCentavos =
    accounts?.reduce((sum, account) => sum + (account.current_balance_centavos ?? 0), 0) ?? 0;

  const { data: rows, error: transactionsError } = await authenticatedSupabase
    .from("transactions")
    .select("transaction_type, amount_centavos, transaction_date, subcategories(label)")
    .eq("user_id", userId)
    .eq("status", "posted")
    .is("deleted_at", null)
    .in("transaction_type", ["income", "expense"])
    .gte("transaction_date", windowStart)
    .order("transaction_date", { ascending: false });

  if (transactionsError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to load transaction history",
    });
    return;
  }

  const transactions: ForecastTransaction[] = (rows as unknown as TransactionRow[] | null)?.map((row) => {
    const subcategory = Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories;
    return {
      transaction_type: row.transaction_type,
      amount_centavos: row.amount_centavos,
      transaction_date: row.transaction_date,
      subcategory_label: subcategory?.label ?? null,
    };
  }) ?? [];

  if (transactions.length === 0) {
    response.status(200).json({ payload: buildEmptyForecast() });
    return;
  }

  response.status(200).json({
    payload: buildForecast({ openingBalanceCentavos, transactions }),
  });
});

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default router;