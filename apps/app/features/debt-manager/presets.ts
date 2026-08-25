export type DebtPresetField = { key: string; label: string; placeholder: string };
export type DebtPreset = { key: string; label: string; fields: DebtPresetField[] };
type PresetValidator = (data: Record<string, unknown>) => void;

const numberField = (key: string, label: string, placeholder: string): DebtPresetField => ({ key, label, placeholder });
const PRESET_ENTRIES: DebtPreset[] = [
  { key: "credit_card", label: "Credit card", fields: [numberField("statementDay", "Statement day", "1-31")] },
  { key: "personal_salary_loan", label: "Personal or salary loan", fields: [numberField("termMonths", "Loan term (months)", "e.g. 24")] },
  { key: "auto_loan", label: "Auto or vehicle loan", fields: [numberField("termMonths", "Loan term (months)", "e.g. 60")] },
  { key: "housing_loan", label: "Housing or mortgage loan", fields: [numberField("termMonths", "Loan term (months)", "e.g. 20")] },
  { key: "informal_loan", label: "Family or friend loan", fields: [numberField("termMonths", "Agreed term (months)", "e.g. 12")] },
  { key: "bnpl", label: "Buy now, pay later", fields: [numberField("termMonths", "Installment term (months)", "e.g. 6")] },
  { key: "online_lending_app", label: "Online lending app", fields: [numberField("termMonths", "Loan term (months)", "e.g. 3")] },
  { key: "product_installment", label: "Product or gadget installment", fields: [numberField("termMonths", "Installment term (months)", "e.g. 12")] },
  { key: "government_member_loan", label: "Government member loan", fields: [numberField("termMonths", "Loan term (months)", "e.g. 24")] },
  { key: "microfinance_loan", label: "Microfinance loan", fields: [numberField("termMonths", "Loan term (months)", "e.g. 12")] },
];
export const DEBT_PRESETS = PRESET_ENTRIES;

const optionalNumber = (data: Record<string, unknown>, field: string) => {
  if (data[field] !== undefined && (!Number.isInteger(data[field]) || (data[field] as number) < 0)) throw new Error(`${field} must be a non-negative integer`);
};
const PRESET_VALIDATORS: Record<string, PresetValidator> = Object.fromEntries(
  PRESET_ENTRIES.map((preset) => [preset.key, (data: Record<string, unknown>) => {
    const allowed = new Set(preset.fields.map((field) => field.key));
    for (const key of Object.keys(data)) {
      if (!allowed.has(key)) throw new Error(`${key} is not supported for ${preset.label}`);
    }
    preset.fields.forEach((field) => optionalNumber(data, field.key));
    if (preset.key === "credit_card" && data.statementDay !== undefined && (data.statementDay as number) < 1) {
      throw new Error("statementDay must be between 1 and 31");
    }
    if (preset.key === "credit_card" && data.statementDay !== undefined && (data.statementDay as number) > 31) {
      throw new Error("statementDay must be between 1 and 31");
    }
  }]),
);

export function validatePresetData(key: string, data: Record<string, unknown>): void {
  PRESET_VALIDATORS[key]?.(data);
}

export function getDebtPreset(key: string): DebtPreset {
  return DEBT_PRESETS.find((preset) => preset.key === key) ?? { key, label: "Unknown preset", fields: [] };
}

export function getDebtPresetFields(key: string): DebtPresetField[] {
  return getDebtPreset(key).fields;
}
