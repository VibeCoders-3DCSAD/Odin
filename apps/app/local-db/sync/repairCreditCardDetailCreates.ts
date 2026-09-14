import * as SQLite from "expo-sqlite";

type QueueRow = {
  operation_id: string;
  entity: string;
  operation_type: string;
  changed_fields: string;
  payload: string;
};

const DERIVED_CREDIT_FIELDS = new Set([
  "available_credit_centavos",
  "reconciled_available_credit_centavos",
  "pre_reconciliation_available_credit_centavos",
  "available_credit_reconciled_at",
]);

export async function repairCreditCardDetailCreateRows(
  db: SQLite.SQLiteDatabase,
  rows: QueueRow[],
): Promise<void> {
  for (const row of rows) {
    if (row.entity !== "credit_card_details" || row.operation_type !== "create") continue;

    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    const changedFields = JSON.parse(row.changed_fields) as string[];
    const repairedFields = changedFields.filter((field) => !DERIVED_CREDIT_FIELDS.has(field));
    const hasDerivedFields = repairedFields.length !== changedFields.length;
    if (!hasDerivedFields) continue;

    for (const field of DERIVED_CREDIT_FIELDS) delete payload[field];
    row.payload = JSON.stringify(payload);
    row.changed_fields = JSON.stringify(repairedFields);
    await db.runAsync(
      "UPDATE sync_queue SET payload = ?, changed_fields = ? WHERE operation_id = ?",
      row.payload,
      row.changed_fields,
      row.operation_id,
    );
  }
}
