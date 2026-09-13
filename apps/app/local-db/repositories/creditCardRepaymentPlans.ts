import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import type { CreditCardRepaymentStrategy } from "./financialFoundations";

export type CreditCardStrategy = {
  accountId: string;
  strategy: CreditCardRepaymentStrategy;
  customAmountCentavos: number | null;
  percentageBps: number | null;
  version: number;
};

export async function listCreditCardStrategies(userId: string): Promise<CreditCardStrategy[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<{ account_id: string; strategy: CreditCardRepaymentStrategy; custom_amount_centavos: number | null; percentage_bps: number | null; version: number }>(
    "SELECT account_id, strategy, custom_amount_centavos, percentage_bps, version FROM credit_card_repayment_preferences WHERE user_id = ? AND deleted = 0",
    userId,
  );
  return rows.map((row) => ({ accountId: row.account_id, strategy: row.strategy, customAmountCentavos: row.custom_amount_centavos, percentageBps: row.percentage_bps, version: row.version }));
}

export async function saveCreditCardStrategy(userId: string, deviceId: string, accountId: string, strategy: CreditCardRepaymentStrategy, customAmountCentavos: number | null, percentageBps: number | null = null): Promise<void> {
  if (strategy === "custom_payment" && (customAmountCentavos === null || !Number.isSafeInteger(customAmountCentavos) || customAmountCentavos <= 0)) throw new LocalDbError("VALIDATION_ERROR", "Custom payment must be a positive whole-centavo amount.");
  if (strategy === "percentage_of_statement" && (percentageBps === null || !Number.isSafeInteger(percentageBps) || percentageBps <= 0 || percentageBps > 10_000)) throw new LocalDbError("VALIDATION_ERROR", "Percentage payment must be between 0.01% and 100%.");

  const db = await initDatabase();
  const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{ version: number }>("SELECT version FROM credit_card_repayment_preferences WHERE account_id = ? AND user_id = ? AND deleted = 0", accountId, userId);
    const custom = strategy === "custom_payment" ? customAmountCentavos : null;
    const percentage = strategy === "percentage_of_statement" ? percentageBps : null;
    if (current) {
      await db.runAsync("UPDATE credit_card_repayment_preferences SET strategy = ?, custom_amount_centavos = ?, percentage_bps = ?, version = version + 1, updated_at = ? WHERE account_id = ? AND user_id = ? AND deleted = 0", strategy, custom, percentage, timestamp, accountId, userId);
    } else {
      const card = await db.getFirstAsync<{ account_id: string }>("SELECT account_id FROM credit_card_details WHERE account_id = ? AND user_id = ? AND deleted = 0", accountId, userId);
      if (!card) throw new LocalDbError("NOT_FOUND", "Credit card not found.");
      await db.runAsync("INSERT INTO credit_card_repayment_preferences (account_id, user_id, strategy, custom_amount_centavos, percentage_bps, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)", accountId, userId, strategy, custom, percentage, timestamp, timestamp);
    }
    await enqueueOperation(db, { userId, deviceId, entity: "credit_card_repayment_preferences", recordId: accountId, operationType: current ? "update" : "create", baseVersion: current?.version ?? null, changedFields: ["account_id", "strategy", "custom_amount_centavos", "percentage_bps"], payload: { account_id: accountId, strategy, custom_amount_centavos: custom, percentage_bps: percentage }, failureMessage: "This credit-card repayment strategy changed elsewhere. Review it before retrying." });
  });
}

export function statementPaymentTargetCentavos(statement: { statement_balance_centavos: number; minimum_due_centavos: number }, strategy?: CreditCardStrategy): number | null {
  if (!strategy) return null;
  if (strategy.strategy === "pay_in_full") return statement.statement_balance_centavos;
  if (strategy.strategy === "pay_minimum") return statement.minimum_due_centavos;
  if (strategy.strategy === "percentage_of_statement" && strategy.percentageBps !== null) return Math.round(statement.statement_balance_centavos * strategy.percentageBps / 10_000);
  return strategy.customAmountCentavos;
}
