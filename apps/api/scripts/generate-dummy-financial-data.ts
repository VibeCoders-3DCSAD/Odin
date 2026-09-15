import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

type AccountKey = "bank" | "wallet" | "savings";

type Account = {
  id: string;
  key: AccountKey;
  openingBalanceCentavos: number;
};

type Transaction = {
  user_id: string;
  transaction_type: "income" | "expense" | "transfer";
  status: "posted";
  entry_source: "manual";
  transaction_date: string;
  amount_centavos: number;
  subcategory_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  merchant_name: string | null;
  notes: string | null;
  client_mutation_id: string;
  metadata: Record<string, string | number | boolean>;
  deleted: false;
  version: 1;
};

type Category = {
  slug: string;
  id: string;
};

const seedMarker = "dummy-financial-data-v1";

function parseArgs() {
  const args = process.argv.slice(2);
  const valueFor = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };

  const userId = valueFor("--user-id");
  if (!userId) {
    throw new Error("Usage: pnpm dummy-data:financial -- --user-id <uuid> [--end-date YYYY-MM-DD] [--seed number] [--dry-run]");
  }

  const endDate = valueFor("--end-date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || Number.isNaN(Date.parse(`${endDate}T00:00:00Z`))) {
    throw new Error("--end-date must be a valid YYYY-MM-DD date");
  }

  const seed = Number(valueFor("--seed") ?? "42");
  if (!Number.isSafeInteger(seed)) throw new Error("--seed must be an integer");

  return { userId, endDate, seed, dryRun: args.includes("--dry-run") };
}

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function addMonths(date: Date, months: number) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  return result;
}

function formatDate(date: Date, day: number) {
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function centavos(pesos: number) {
  return Math.round(pesos * 100);
}

function amountWithNoise(basePesos: number, random: () => number, spread = 0.12) {
  return centavos(basePesos * (1 - spread + random() * spread * 2));
}

function buildTransactions(userId: string, endDate: string, seed: number, accounts: Account[], categories: Category[]) {
  const random = createRandom(seed);
  const categoryIdBySlug = new Map(categories.map((category) => [category.slug, category.id]));
  const requiredSlugs = [
    "income_salary",
    "essentials_food_groceries",
    "essentials_transportation_commute",
    "essentials_electricity",
    "essentials_water",
    "essentials_connectivity",
    "obligatory_housing_rent",
    "discretionary_dining_out",
    "discretionary_shopping",
  ];
  const missingSlugs = requiredSlugs.filter((slug) => !categoryIdBySlug.has(slug));
  if (missingSlugs.length > 0) throw new Error(`Missing seeded subcategories: ${missingSlugs.join(", ")}`);

  const accountIdByKey = new Map(accounts.map((account) => [account.key, account.id]));
  const transaction = (
    date: string,
    type: Transaction["transaction_type"],
    amount: number,
    slug: string | null,
    source: AccountKey | null,
    destination: AccountKey | null,
    merchant: string | null,
    notes: string | null,
  ): Transaction => ({
    user_id: userId,
    transaction_type: type,
    status: "posted",
    entry_source: "manual",
    transaction_date: date,
    amount_centavos: amount,
    subcategory_id: slug ? categoryIdBySlug.get(slug)! : null,
    source_account_id: source ? accountIdByKey.get(source)! : null,
    destination_account_id: destination ? accountIdByKey.get(destination)! : null,
    merchant_name: merchant,
    notes,
    client_mutation_id: randomUUID(),
    metadata: { dummy_data_source: seedMarker, generated_seed: seed },
    deleted: false,
    version: 1,
  });

  const end = new Date(`${endDate}T00:00:00Z`);
  const firstMonth = addMonths(end, -23);
  const transactions: Transaction[] = [];

  for (let offset = 0; offset < 24; offset += 1) {
    const month = addMonths(firstMonth, offset);
    const monthlyIncome = amountWithNoise(52_000, random, 0.06);
    transactions.push(transaction(formatDate(month, 15), "income", monthlyIncome, "income_salary", null, "bank", "Northstar Services", "Monthly salary"));
    transactions.push(transaction(formatDate(month, 2), "expense", amountWithNoise(13_500, random, 0.03), "obligatory_housing_rent", "bank", null, "Apartment rent", null));
    transactions.push(transaction(formatDate(month, 6), "expense", amountWithNoise(2_800, random), "essentials_electricity", "bank", null, "Meralco", null));
    transactions.push(transaction(formatDate(month, 8), "expense", amountWithNoise(550, random), "essentials_water", "bank", null, "Maynilad", null));
    transactions.push(transaction(formatDate(month, 10), "expense", amountWithNoise(1_699, random, 0.03), "essentials_connectivity", "bank", null, "PLDT Home", null));
    transactions.push(transaction(formatDate(month, 16), "transfer", amountWithNoise(7_000, random, 0.1), null, "bank", "savings", null, "Monthly savings allocation"));
    transactions.push(transaction(formatDate(month, 17), "transfer", amountWithNoise(26_000, random, 0.08), null, "bank", "wallet", null, "Wallet top-up"));

    for (const day of [3, 7, 10, 14, 18, 21, 28]) {
      transactions.push(transaction(formatDate(month, day), "expense", amountWithNoise(2_100, random, 0.22), "essentials_food_groceries", "wallet", null, "SM Supermarket", null));
    }
    for (const day of [2, 5, 8, 11, 14, 17, 20, 23, 26, 28]) {
      transactions.push(transaction(formatDate(month, day), "expense", amountWithNoise(420, random, 0.25), "essentials_transportation_commute", "wallet", null, "MRT and jeepney fares", null));
    }
    for (const day of [7, 12, 16, 20, 22, 26]) {
      transactions.push(transaction(formatDate(month, day), "expense", amountWithNoise(650, random, 0.3), "discretionary_dining_out", "wallet", null, "Local cafe", null));
    }
    transactions.push(transaction(formatDate(month, 14), "expense", amountWithNoise(700, random, 0.25), "discretionary_shopping", "wallet", null, "Convenience store", null));
    if (random() > 0.35) {
      transactions.push(transaction(formatDate(month, 23), "expense", amountWithNoise(1_800, random, 0.35), "discretionary_shopping", "wallet", null, "Online shopping", null));
    }
  }

  const filteredTransactions = transactions.filter((transactionRow) => transactionRow.transaction_date <= endDate);
  if (filteredTransactions.length < 700) throw new Error("Generator must produce at least 700 transactions across two years");
  return filteredTransactions;
}

function calculateBalances(accounts: Account[], transactions: Transaction[]) {
  const balances = new Map(accounts.map((account) => [account.id, account.openingBalanceCentavos]));
  for (const transaction of transactions) {
    if (transaction.source_account_id) balances.set(transaction.source_account_id, balances.get(transaction.source_account_id)! - transaction.amount_centavos);
    if (transaction.destination_account_id) balances.set(transaction.destination_account_id, balances.get(transaction.destination_account_id)! + transaction.amount_centavos);
  }
  return balances;
}

async function main() {
  const { userId, endDate, seed, dryRun } = parseArgs();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [{ data: profile, error: profileError }, { data: existingRows, error: existingError }, { data: categories, error: categoryError }] = await Promise.all([
    supabase.from("profiles").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("financial_accounts").select("id").eq("user_id", userId).contains("metadata", { dummy_data_source: seedMarker }).limit(1),
    supabase.from("subcategories").select("id, slug").in("slug", ["income_salary", "essentials_food_groceries", "essentials_transportation_commute", "essentials_electricity", "essentials_water", "essentials_connectivity", "obligatory_housing_rent", "discretionary_dining_out", "discretionary_shopping"]),
  ]);
  if (profileError) throw profileError;
  if (!profile) throw new Error(`No profile exists for user ${userId}`);
  if (existingError) throw existingError;
  if (existingRows.length > 0) throw new Error("Dummy financial data already exists for this user. It is intentionally not overwritten.");
  if (categoryError) throw categoryError;

  const start = formatDate(addMonths(new Date(`${endDate}T00:00:00Z`), -11), 1);
  const accounts: Account[] = [
    { id: randomUUID(), key: "bank", openingBalanceCentavos: centavos(100_000) },
    { id: randomUUID(), key: "wallet", openingBalanceCentavos: centavos(15_000) },
    { id: randomUUID(), key: "savings", openingBalanceCentavos: centavos(75_000) },
  ];
  const transactions = buildTransactions(userId, endDate, seed, accounts, categories ?? []);
  const balances = calculateBalances(accounts, transactions);

  if ([...balances.values()].some((balance) => balance < 0)) throw new Error("Generated data would overdraw an account; change the seed or generator.");
  console.log(`Prepared ${accounts.length} accounts and ${transactions.length} transactions from ${start} through ${endDate}.`);
  if (dryRun) return;

  const accountRows = [
    { id: accounts[0].id, user_id: userId, name: "Demo Payroll Account", kind: "bank", opening_balance_centavos: accounts[0].openingBalanceCentavos, current_balance_centavos: balances.get(accounts[0].id), include_in_dashboard_balance: true, institution_name: "Demo Bank", opened_on: start, sort_order: 1, metadata: { dummy_data_source: seedMarker }, deleted: false, version: 1 },
    { id: accounts[1].id, user_id: userId, name: "Demo Daily Wallet", kind: "e_wallet", opening_balance_centavos: accounts[1].openingBalanceCentavos, current_balance_centavos: balances.get(accounts[1].id), include_in_dashboard_balance: true, institution_name: "Demo Wallet", opened_on: start, sort_order: 2, metadata: { dummy_data_source: seedMarker }, deleted: false, version: 1 },
    { id: accounts[2].id, user_id: userId, name: "Demo Emergency Savings", kind: "savings", opening_balance_centavos: accounts[2].openingBalanceCentavos, current_balance_centavos: balances.get(accounts[2].id), include_in_dashboard_balance: true, institution_name: "Demo Bank", opened_on: start, sort_order: 3, metadata: { dummy_data_source: seedMarker }, deleted: false, version: 1 },
  ];
  const { error: accountsError } = await supabase.from("financial_accounts").insert(accountRows);
  if (accountsError) throw accountsError;

  const { error: transactionsError } = await supabase.from("transactions").insert(transactions);
  if (transactionsError) {
    const { error: cleanupError } = await supabase
      .from("financial_accounts")
      .delete()
      .eq("user_id", userId)
      .in("id", accounts.map((account) => account.id));
    if (cleanupError) {
      throw new Error(`Transaction insert failed: ${transactionsError.message}. Account cleanup also failed: ${cleanupError.message}`);
    }
    throw transactionsError;
  }
  console.log(`Created dummy financial data for ${userId}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
