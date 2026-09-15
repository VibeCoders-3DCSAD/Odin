import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const seedMarker = "dummy-financial-data-v1";

function parseArgs() {
  const args = process.argv.slice(2);
  const valueFor = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const userId = valueFor("--user-id");
  const confirmation = valueFor("--confirm");
  if (!userId) throw new Error("Usage: pnpm dummy-data:reset -- --user-id <uuid> [--dry-run] [--confirm <uuid>]");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("--user-id must be a UUID");
  }
  if (!args.includes("--dry-run") && confirmation !== userId) {
    throw new Error("Reset is destructive. Re-run with --confirm <the same user UUID> after using --dry-run.");
  }
  return { userId, dryRun: args.includes("--dry-run") };
}

async function main() {
  const { userId, dryRun } = parseArgs();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [{ data: transactions, error: transactionsError }, { data: accounts, error: accountsError }] = await Promise.all([
    supabase.from("transactions").select("id", { count: "exact" }).eq("user_id", userId).contains("metadata", { dummy_data_source: seedMarker }),
    supabase.from("financial_accounts").select("id", { count: "exact" }).eq("user_id", userId).contains("metadata", { dummy_data_source: seedMarker }),
  ]);
  if (transactionsError) throw transactionsError;
  if (accountsError) throw accountsError;

  const transactionCount = transactions.length;
  const accountCount = accounts.length;
  console.log(`Found ${accountCount} dummy accounts and ${transactionCount} dummy transactions for ${userId}.`);
  if (dryRun || (accountCount === 0 && transactionCount === 0)) return;

  const { error: deleteTransactionsError } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .contains("metadata", { dummy_data_source: seedMarker });
  if (deleteTransactionsError) throw deleteTransactionsError;

  const { error: deleteAccountsError } = await supabase
    .from("financial_accounts")
    .delete()
    .eq("user_id", userId)
    .contains("metadata", { dummy_data_source: seedMarker });
  if (deleteAccountsError) throw deleteAccountsError;
  console.log(`Removed dummy financial data for ${userId}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
