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
  const rows = await db.getAllAsync<{ account_id: string; repayment_strategy: CreditCardRepaymentStrategy; repayment_custom_amount_centavos: number | null; repayment_percentage_bps: number | null; version: number }>(
    "SELECT account_id, repayment_strategy, repayment_custom_amount_centavos, repayment_percentage_bps, version FROM credit_card_details WHERE user_id = ? AND deleted = 0 AND repayment_strategy IS NOT NULL",
    userId,
  );
  return rows.map((row) => ({ accountId: row.account_id, strategy: row.repayment_strategy, customAmountCentavos: row.repayment_custom_amount_centavos, percentageBps: row.repayment_percentage_bps, version: row.version }));
}

export async function saveCreditCardStrategy(userId: string, deviceId: string, accountId: string, strategy: CreditCardRepaymentStrategy, customAmountCentavos: number | null, percentageBps: number | null = null): Promise<void> {
  if (strategy === "custom_payment" && (customAmountCentavos === null || !Number.isSafeInteger(customAmountCentavos) || customAmountCentavos <= 0)) throw new LocalDbError("VALIDATION_ERROR", "Custom payment must be a positive whole-centavo amount.");
  if (strategy === "percentage_of_statement" && (percentageBps === null || !Number.isSafeInteger(percentageBps) || percentageBps <= 0 || percentageBps > 10_000)) throw new LocalDbError("VALIDATION_ERROR", "Percentage payment must be between 0.01% and 100%.");

  const db = await initDatabase();
  const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{ version: number }>("SELECT version FROM credit_card_details WHERE account_id = ? AND user_id = ? AND deleted = 0", accountId, userId);
    if (!current) throw new LocalDbError("NOT_FOUND", "Credit card not found.");
    const custom = strategy === "custom_payment" ? customAmountCentavos : null;
    const percentage = strategy === "percentage_of_statement" ? percentageBps : null;
    await db.runAsync("UPDATE credit_card_details SET repayment_strategy = ?, repayment_custom_amount_centavos = ?, repayment_percentage_bps = ?, version = version + 1, updated_at = ? WHERE account_id = ? AND user_id = ? AND deleted = 0", strategy, custom, percentage, timestamp, accountId, userId);
    await enqueueOperation(db, { userId, deviceId, entity: "credit_card_details", recordId: accountId, operationType: "update", baseVersion: current.version, changedFields: ["account_id", "repayment_strategy", "repayment_custom_amount_centavos", "repayment_percentage_bps"], payload: { account_id: accountId, repayment_strategy: strategy, repayment_custom_amount_centavos: custom, repayment_percentage_bps: percentage }, failureMessage: "Your credit-card repayment strategy could not be saved." });
  });
}

export function statementPaymentTargetCentavos(statement: { statement_balance_centavos: number; minimum_due_centavos: number }, strategy?: CreditCardStrategy): number | null {
  if (!strategy) return null;
  if (strategy.strategy === "pay_in_full") return statement.statement_balance_centavos;
  if (strategy.strategy === "pay_minimum") return statement.minimum_due_centavos;
  if (strategy.strategy === "percentage_of_statement" && strategy.percentageBps !== null) return Math.round(statement.statement_balance_centavos * strategy.percentageBps / 10_000);
  return strategy.customAmountCentavos;
}
