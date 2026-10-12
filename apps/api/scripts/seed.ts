import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
dotenv.config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), override: true });

function parseArgs() {
  const args = process.argv.slice(2);
  const valueFor = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const email = valueFor("--email")?.trim().toLowerCase();
  const password = valueFor("--password");
  if (!email || !password) throw new Error("Usage: pnpm seed -- --email <email> --password <password>");
  return { email, password };
}

async function runFinancialSeed(email: string, dryRun: boolean) {
  const args = ["dummy-data:financial", "--", "--email", email];
  if (dryRun) args.push("--dry-run");
  else args.push("--confirm", email);
  const child = spawn("pnpm", args, { stdio: "inherit", shell: process.platform === "win32" });
  const [exitCode] = await once(child, "exit") as [number | null];
  if (exitCode !== 0) throw new Error(`Financial data seed failed with exit code ${exitCode}`);
}

async function main() {
  const { email, password } = parseArgs();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  let existing;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1_000 });
    if (error) throw error;
    existing = data.users.find((user) => user.email?.toLowerCase() === email);
    if (existing || data.users.length < 1_000) break;
  }
  if (existing) {
    console.log(`Using existing user ${existing.id}.`);
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) throw createError ?? new Error("User creation returned no user");
    console.log(`Created verified user ${created.user.id}.`);
  }

  await runFinancialSeed(email, true);
  await runFinancialSeed(email, false);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
