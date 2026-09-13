import type * as SQLite from "expo-sqlite";

type QueueRow = {
  operation_id: string;
  entity: string;
  record_id: string;
  operation_type: string;
  changed_fields: string;
  payload: string;
};

type PaymentRow = {
  cycle_id: string;
  statement_id: string;
  transaction_id: string;
  amount_centavos: number;
  payment_date: string;
  source_account_id: string;
  notes: string | null;
  client_mutation_id: string;
};

export async function repairCreditCardPaymentCreateRows(
  db: Pick<SQLite.SQLiteDatabase, "getFirstAsync" | "runAsync">,
  userId: string,
  rows: QueueRow[],
): Promise<void> {
  for (const row of rows) {
    if (row.entity !== "credit_card_payments" || row.operation_type !== "create") continue;

    const payment = await db.getFirstAsync<PaymentRow>(
      `SELECT cycle_id, statement_id, transaction_id, amount_centavos, payment_date,
              source_account_id, notes, client_mutation_id
         FROM credit_card_payments
        WHERE id = ? AND user_id = ? AND deleted = 0`,
      row.record_id,
      userId,
    );
    if (!payment) continue;

    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    const paymentFields = {
      cycle_id: payment.cycle_id,
      statement_id: payment.statement_id,
      transaction_id: payment.transaction_id,
      amount_centavos: payment.amount_centavos,
      payment_date: payment.payment_date,
      source_account_id: payment.source_account_id,
      notes: payment.notes,
      client_mutation_id: payment.client_mutation_id,
    };
    const changedFields = [...new Set([
      ...(JSON.parse(row.changed_fields) as string[]),
      ...Object.keys(paymentFields),
    ])];
    const repairedPayload = { ...payload, ...paymentFields };

    row.payload = JSON.stringify(repairedPayload);
    row.changed_fields = JSON.stringify(changedFields);
    await db.runAsync(
      "UPDATE sync_queue SET payload = ?, changed_fields = ? WHERE operation_id = ?",
      row.payload,
      row.changed_fields,
      row.operation_id,
    );
  }
}
