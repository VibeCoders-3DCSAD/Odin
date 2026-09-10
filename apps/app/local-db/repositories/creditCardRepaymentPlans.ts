import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";

export type CreditCardRepaymentStrategy = "pay_in_full" | "pay_minimum" | "percentage_of_statement" | "custom_payment";
export type CreditCardStatementStrategy = { statementId: string; strategy: CreditCardRepaymentStrategy; customAmountCentavos: number | null; percentageBps: number | null; version: number };

export async function listCreditCardStatementStrategies(userId: string): Promise<CreditCardStatementStrategy[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<{ statement_id: string; strategy: CreditCardRepaymentStrategy; custom_amount_centavos: number | null; percentage_bps: number | null; version: number }>("SELECT statement_id, strategy, custom_amount_centavos, percentage_bps, version FROM credit_card_statement_strategies WHERE user_id = ? AND deleted = 0", userId);
  return rows.map((row) => ({ statementId: row.statement_id, strategy: row.strategy, customAmountCentavos: row.custom_amount_centavos, percentageBps: row.percentage_bps, version: row.version }));
}

export async function saveCreditCardStatementStrategy(userId: string, deviceId: string, statementId: string, strategy: CreditCardRepaymentStrategy, customAmountCentavos: number | null, percentageBps: number | null = null): Promise<void> {
  const db = await initDatabase(); const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const statement = await db.getFirstAsync<{ statement_balance_centavos: number; minimum_due_centavos: number }>("SELECT statement_balance_centavos, minimum_due_centavos FROM credit_card_statements WHERE id = ? AND user_id = ? AND authoritative = 1 AND deleted = 0", statementId, userId);
    if (!statement) throw new LocalDbError("NOT_FOUND", "Credit-card statement not found.");
    const percentageTarget = percentageBps === null ? null : Math.round(statement.statement_balance_centavos * percentageBps / 10_000);
    if (strategy === "custom_payment" && (customAmountCentavos === null || !Number.isSafeInteger(customAmountCentavos) || customAmountCentavos < statement.minimum_due_centavos || customAmountCentavos >= statement.statement_balance_centavos)) throw new LocalDbError("VALIDATION_ERROR", "Custom payment must meet the minimum amount due and be less than the statement balance.");
    if (strategy === "percentage_of_statement" && (percentageBps === null || !Number.isSafeInteger(percentageBps) || percentageBps <= 0 || percentageBps > 10_000 || percentageTarget === null || percentageTarget < statement.minimum_due_centavos || percentageTarget > statement.statement_balance_centavos)) throw new LocalDbError("VALIDATION_ERROR", "Percentage payment must meet the minimum amount due and not exceed the statement balance.");
    const custom = strategy === "custom_payment" ? customAmountCentavos : null;
    const percentage = strategy === "percentage_of_statement" ? percentageBps : null;
    const current = await db.getFirstAsync<{ version: number }>("SELECT version FROM credit_card_statement_strategies WHERE statement_id = ? AND user_id = ?", statementId, userId);
    if (current) await db.runAsync("UPDATE credit_card_statement_strategies SET strategy = ?, custom_amount_centavos = ?, percentage_bps = ?, deleted = 0, version = version + 1, updated_at = ? WHERE statement_id = ? AND user_id = ?", strategy, custom, percentage, timestamp, statementId, userId);
    else await db.runAsync("INSERT INTO credit_card_statement_strategies (statement_id, user_id, strategy, custom_amount_centavos, percentage_bps, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)", statementId, userId, strategy, custom, percentage, timestamp, timestamp);
    await enqueueOperation(db, { userId, deviceId, entity: "credit_card_statement_strategies", recordId: statementId, operationType: current ? "update" : "create", baseVersion: current?.version ?? null, changedFields: ["statement_id", "strategy", "custom_amount_centavos", "percentage_bps"], payload: { statement_id: statementId, strategy, custom_amount_centavos: custom, percentage_bps: percentage }, failureMessage: "Your credit-card repayment strategy could not be saved." });
  });
}

export function statementPaymentTargetCentavos(statement: { statement_balance_centavos: number; minimum_due_centavos: number }, strategy?: CreditCardStatementStrategy): number | null {
  if (!strategy) return null;
  if (strategy.strategy === "pay_in_full") return statement.statement_balance_centavos;
  if (strategy.strategy === "pay_minimum") return statement.minimum_due_centavos;
  if (strategy.strategy === "percentage_of_statement" && strategy.percentageBps !== null) return Math.round(statement.statement_balance_centavos * strategy.percentageBps / 10_000);
  return strategy.customAmountCentavos;
}
