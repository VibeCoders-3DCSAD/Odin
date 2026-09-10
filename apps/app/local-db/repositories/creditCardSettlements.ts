import { initDatabase } from "../client";
import { enqueueOperation, LocalDbError } from "../helpers";
import { randomUUID } from "../uuid";

export type CreditCardSettlementStatus = "requested" | "recognized" | "rejected";
export type CreditCardSettlement = { id: string; installment_id: string; settlement_date: string; remaining_principal_centavos: number; settlement_amount_centavos: number; pretermination_fee_centavos: number; status: CreditCardSettlementStatus; version: number };

export async function listCreditCardSettlements(userId: string): Promise<CreditCardSettlement[]> {
  const db = await initDatabase();
  return db.getAllAsync<CreditCardSettlement>("SELECT id, installment_id, settlement_date, remaining_principal_centavos, settlement_amount_centavos, pretermination_fee_centavos, status, version FROM credit_card_settlements WHERE user_id = ? AND deleted = 0 ORDER BY created_at DESC", userId);
}

export async function requestCreditCardSettlement(userId: string, deviceId: string, input: { installmentId: string; settlementDate: string; remainingPrincipalCentavos: number; settlementAmountCentavos: number; preterminationFeeCentavos?: number }): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.settlementDate) || !Number.isSafeInteger(input.remainingPrincipalCentavos) || input.remainingPrincipalCentavos < 0 || !Number.isSafeInteger(input.settlementAmountCentavos) || input.settlementAmountCentavos <= 0 || !Number.isSafeInteger(input.preterminationFeeCentavos ?? 0) || (input.preterminationFeeCentavos ?? 0) < 0) throw new LocalDbError("VALIDATION_ERROR", "Some early-settlement details are not valid.");
  const db = await initDatabase(); const id = randomUUID(); const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const installment = await db.getFirstAsync<{ id: string }>("SELECT id FROM credit_card_installments WHERE id = ? AND user_id = ? AND settlement_status = 'active' AND deleted = 0", input.installmentId, userId);
    if (!installment) throw new LocalDbError("NOT_FOUND", "Active installment not found.");
    await db.runAsync("INSERT INTO credit_card_settlements (id, user_id, installment_id, settlement_date, remaining_principal_centavos, settlement_amount_centavos, pretermination_fee_centavos, status, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', 1, 0, ?, ?)", id, userId, input.installmentId, input.settlementDate, input.remainingPrincipalCentavos, input.settlementAmountCentavos, input.preterminationFeeCentavos ?? 0, timestamp, timestamp);
    await db.runAsync("UPDATE credit_card_installments SET settlement_status = 'early_settlement_requested', version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", timestamp, input.installmentId, userId);
    await enqueueOperation(db, { userId, deviceId, entity: "credit_card_settlements", recordId: id, operationType: "create", baseVersion: null, changedFields: ["installment_id", "settlement_date", "remaining_principal_centavos", "settlement_amount_centavos", "pretermination_fee_centavos", "status"], payload: { installment_id: input.installmentId, settlement_date: input.settlementDate, remaining_principal_centavos: input.remainingPrincipalCentavos, settlement_amount_centavos: input.settlementAmountCentavos, pretermination_fee_centavos: input.preterminationFeeCentavos ?? 0, status: "requested" }, failureMessage: "Your early settlement request could not be recorded." });
  });
}

export async function recognizeCreditCardSettlement(userId: string, deviceId: string, settlementId: string): Promise<void> {
  const db = await initDatabase(); const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const settlement = await db.getFirstAsync<CreditCardSettlement>("SELECT id, installment_id, settlement_date, remaining_principal_centavos, settlement_amount_centavos, pretermination_fee_centavos, status, version FROM credit_card_settlements WHERE id = ? AND user_id = ? AND deleted = 0", settlementId, userId);
    if (!settlement || settlement.status !== "requested") throw new LocalDbError("NOT_FOUND", "Requested early settlement not found.");
    await db.runAsync("UPDATE credit_card_settlements SET status = 'recognized', version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", timestamp, settlementId, userId);
    await db.runAsync("UPDATE credit_card_installments SET settlement_status = 'completed', remaining_principal_centavos = 0, remaining_months = 0, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?", timestamp, settlement.installment_id, userId);
    await enqueueOperation(db, { userId, deviceId, entity: "credit_card_settlements", recordId: settlementId, operationType: "update", baseVersion: settlement.version, changedFields: ["installment_id", "settlement_date", "remaining_principal_centavos", "settlement_amount_centavos", "pretermination_fee_centavos", "status"], payload: { installment_id: settlement.installment_id, settlement_date: settlement.settlement_date, remaining_principal_centavos: settlement.remaining_principal_centavos, settlement_amount_centavos: settlement.settlement_amount_centavos, pretermination_fee_centavos: settlement.pretermination_fee_centavos, status: "recognized" }, failureMessage: "The issuer recognition could not be recorded." });
  });
}
