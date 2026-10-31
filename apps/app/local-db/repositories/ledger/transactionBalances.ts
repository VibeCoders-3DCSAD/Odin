import * as SQLite from "expo-sqlite";

export async function applyBalanceEffects(
  db: SQLite.SQLiteDatabase,
  userId: string,
  transactionType: string,
  sourceAccountId: string | null,
  destinationAccountId: string | null,
  amountCentavos: number,
): Promise<void> {
  if (transactionType === "income" && destinationAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      destinationAccountId,
      userId,
    );
  } else if (transactionType === "expense" && sourceAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      sourceAccountId,
      userId,
    );
  } else if (transactionType === "transfer" && sourceAccountId && destinationAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      sourceAccountId,
      userId,
    );
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      destinationAccountId,
      userId,
    );
  }
}

export async function reverseBalanceEffects(
  db: SQLite.SQLiteDatabase,
  userId: string,
  transactionType: string,
  sourceAccountId: string | null,
  destinationAccountId: string | null,
  amountCentavos: number,
): Promise<void> {
  if (transactionType === "income" && destinationAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      destinationAccountId,
      userId,
    );
  } else if (transactionType === "expense" && sourceAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      sourceAccountId,
      userId,
    );
  } else if (transactionType === "transfer" && sourceAccountId && destinationAccountId) {
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos + ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      sourceAccountId,
      userId,
    );
    await db.runAsync(
      "UPDATE financial_accounts SET current_balance_centavos = current_balance_centavos - ? WHERE id = ? AND user_id = ? AND deleted = 0",
      amountCentavos,
      destinationAccountId,
      userId,
    );
  }
}
