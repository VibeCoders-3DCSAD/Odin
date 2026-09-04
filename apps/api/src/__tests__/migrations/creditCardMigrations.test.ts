import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = (name: string) => readFileSync(resolve(process.cwd(), "../../supabase/migrations", name), "utf8");

test("credit-card migration evolution keeps the hardened core name available", () => {
  const five = migration("20260902000005_harden_credit_card_sync.sql");
  const six = migration("20260902000006_repair_debt_and_credit_card_operations.sql");
  expect(five).toContain("CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation_core");
  expect(six).not.toContain("RENAME TO apply_credit_card_sync_operation_core");
  expect(six).toContain("CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation(");
});

test("credit-card wrapper checks operation and record identity before balance effects", () => {
  const sql = migration("20260902000006_repair_debt_and_credit_card_operations.sql");
  const identity = sql.indexOf("EXECUTE format('SELECT user_id FROM %I WHERE %I=$1'");
  const purchaseDebit = sql.indexOf("UPDATE credit_card_details SET available_credit_centavos=COALESCE(available_credit_centavos,credit_limit_centavos)-v_amount");
  const applicationDebit = sql.indexOf("UPDATE credit_card_details SET available_credit_centavos=COALESCE(available_credit_centavos,credit_limit_centavos)+v_amount");
  expect(identity).toBeGreaterThan(-1);
  expect(identity).toBeLessThan(purchaseDebit);
  expect(identity).toBeLessThan(applicationDebit);
  expect(sql.indexOf("credit application target transaction is invalid")).toBeLessThan(applicationDebit);
});

test("credit-card installment links are scoped to the selected card", () => {
  const sql = migration("20260902000005_harden_credit_card_sync.sql");
  expect(sql).toContain("installment_id does not belong to this user and card");
  expect(sql).toContain("account_id=(v_payload->>'account_id')::uuid");
});

test("nullable credit-card references are ignored by the forward fix", () => {
  const sql = migration("20260905000002_fix_nullable_credit_card_references.sql");
  expect(sql).toContain("CREATE OR REPLACE FUNCTION apply_credit_card_sync_operation_core");
  expect(sql).toContain("v_payload->>'installment_id' IS NOT NULL");
  expect(sql).toContain("v_payload->>'statement_id' IS NOT NULL");
  expect(sql).toContain("v_payload->>'payment_id' IS NOT NULL");
  expect(sql).toContain("v_payload->>'transaction_id' IS NOT NULL");
});

test("payment credit is released only on issuer recognition", () => {
  const sql = migration("20260903000000_credit_card_issuer_recognition.sql");
  expect(sql).toContain("issuer_recognized boolean NOT NULL DEFAULT false");
  expect(sql).toContain("Payment creation records issuer recognition state only; it never frees credit.");
  expect(sql).toContain("issuer_recognized=false");
  expect(sql).toContain("LEAST(credit_limit_centavos");
});

test("final credit-card migration locks relationships, formula, and target cap", () => {
  const sql = migration("20260904000000_finalize_credit_card_invariants.sql");
  expect(sql).toContain("a.kind='credit_card'");
  expect(sql).toContain("t.source_account_id=NEW.account_id");
  expect(sql).toContain("monthly amortization does not match installment formula");
  expect(sql).toContain("credit application exceeds target charge");
  expect(sql.indexOf("SELECT user_id INTO v_existing_user FROM applied_operations")).toBeLessThan(sql.indexOf("UPDATE credit_card_payments SET issuer_recognized=true"));
});

test("final credit-card wrapper guards replay and applies each derived effect once", () => {
  const sql = migration("20260904000000_finalize_credit_card_invariants.sql");
  expect(sql.indexOf("SELECT user_id INTO v_existing_user FROM applied_operations")).toBeLessThan(sql.indexOf("IF p_entity='credit_card_transactions'"));
  expect(sql).toContain("credit_card_installments WHERE id=(p_payload->>'installment_id')::uuid");
  expect(sql).toContain("UPDATE credit_card_details SET available_credit_centavos=LEAST(credit_limit_centavos");
});

test("settlement recognition has one completion trigger", () => {
  const sql = migration("20260904000002_credit_card_settlement_recognition.sql");
  expect(sql).toContain("DROP TRIGGER IF EXISTS credit_card_settlement_completion");
  expect(sql).toContain("CREATE TRIGGER credit_card_settlement_recognition");
});
