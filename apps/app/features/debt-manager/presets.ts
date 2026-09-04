export type DebtPresetField = { key: string; label: string; placeholder: string; required?: boolean; kind?: "number" | "text"; options?: readonly string[] };
export type DebtPreset = { key: string; label: string; fields: DebtPresetField[] };
type PresetValidator = (data: Record<string, unknown>) => void;

const numberField = (key: string, label: string, placeholder: string): DebtPresetField => ({ key, label, placeholder, kind: "number" });
const textField = (key: string, label: string, placeholder: string): DebtPresetField => ({ key, label, placeholder, kind: "text" });
const choiceField = (key: string, label: string, placeholder: string, options: readonly string[]): DebtPresetField => ({ key, label, placeholder, kind: "text", options });
const LEGACY_PRESET_ENTRIES: DebtPreset[] = [
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
export const DEBT_PRESETS: DebtPreset[] = [
  { key: "personal_loan", label: "Personal", fields: [choiceField("purpose", "Loan purpose", "Select loan purpose", ["Emergency", "Medical", "Education", "Home Improvement", "Debt Consolidation", "Personal Purchase", "Other"])] },
  { key: "salary_loan", label: "Salary", fields: [textField("linkedIncomeSourceId", "Linked income source", "Select linked income source"), choiceField("repaymentMethod", "Repayment method", "Select repayment method", ["payroll_deduction", "automatic_debit", "manual_payment", "other"]), numberField("deductionAmountCentavos", "Deduction amount", "Enter deduction amount"), textField("deductionSchedule", "Deduction schedule", "Select deduction schedule")] },
  { key: "multipurpose_loan", label: "Multipurpose", fields: [choiceField("purpose", "Loan purpose", "Select loan purpose or purposes", ["Home Improvement", "Education", "Medical", "Livelihood", "Emergency", "Utility", "Other"])] },
  { key: "business_loan", label: "Business", fields: [textField("linkedBusinessOrIncomeSourceId", "Business or income source", "Select linked business or income source"), choiceField("purpose", "Business loan purpose", "Select business loan purpose", ["Working Capital", "Inventory", "Equipment", "Expansion", "Operating Expenses", "Emergency", "Other"])] },
  { key: "auto_loan", label: "Auto", fields: [textField("vehicleDescription", "Vehicle description", "Enter vehicle description"), numberField("vehiclePurchasePriceCentavos", "Vehicle purchase price", "Enter vehicle purchase price"), numberField("downpaymentCentavos", "Downpayment", "Enter downpayment")] },
  { key: "custom_debt", label: "Custom Debt", fields: [choiceField("interestChoice", "Interest method", "Select interest method", ["no_interest", "specified", "provider_calculated"]), numberField("interestRateBps", "Specified interest rate (bps)", "e.g. 1200"), choiceField("interestMethod", "Specified interest calculation", "Select interest method", ["flat_add_on", "diminishing_balance"])] },
];
const PRESET_ENTRIES = [
  ...LEGACY_PRESET_ENTRIES.filter(({ key }) => key !== "auto_loan"),
  ...DEBT_PRESETS.map((preset) => preset.key === "auto_loan"
    ? { ...preset, fields: [numberField("termMonths", "Loan term (months)", "e.g. 60"), ...preset.fields] }
    : preset),
];
export const ALL_DEBT_PRESETS = PRESET_ENTRIES;
const COMMON_FIELDS = new Set(["startDate", "feesCentavos", "penaltiesCentavos"]);

const optionalNumber = (data: Record<string, unknown>, field: string) => {
  if (data[field] !== undefined && (!Number.isInteger(data[field]) || (data[field] as number) < 0)) throw new Error(`${field} must be a non-negative integer`);
};
const PRESET_VALIDATORS: Record<string, PresetValidator> = Object.fromEntries(
  PRESET_ENTRIES.map((preset) => [preset.key, (data: Record<string, unknown>) => {
    const allowed = new Set(preset.fields.map((field) => field.key));
    for (const key of Object.keys(data)) {
       if (!allowed.has(key) && !COMMON_FIELDS.has(key)) throw new Error(`${key} is not supported for ${preset.label}`);
    }
     for (const field of preset.fields) {
      if (["purpose", "linkedIncomeSourceId", "repaymentMethod", "linkedBusinessOrIncomeSourceId", "vehicleDescription", "interestChoice"].includes(field.key)) {
        if (typeof data[field.key] !== "string" || !String(data[field.key]).trim()) throw new Error(`${field.key} is required`);
      } else optionalNumber(data, field.key);
     }
     optionalNumber(data, "feesCentavos"); optionalNumber(data, "penaltiesCentavos");
    if (preset.key === "credit_card" && data.statementDay !== undefined && (data.statementDay as number) < 1) {
      throw new Error("statementDay must be between 1 and 31");
    }
    if (preset.key === "credit_card" && data.statementDay !== undefined && (data.statementDay as number) > 31) {
      throw new Error("statementDay must be between 1 and 31");
    }
  }]),
);

PRESET_VALIDATORS.personal_loan = (data) => { if (data.purpose !== undefined && typeof data.purpose !== "string") throw new Error("purpose must be a string"); };
PRESET_VALIDATORS.multipurpose_loan = PRESET_VALIDATORS.personal_loan;
PRESET_VALIDATORS.salary_loan = (data) => {
  if (typeof data.linkedIncomeSourceId !== "string" || !data.linkedIncomeSourceId) throw new Error("linkedIncomeSourceId is required");
  if (typeof data.repaymentMethod !== "string" || !data.repaymentMethod) throw new Error("repaymentMethod is required");
  if (data.repaymentMethod === "payroll_deduction" && (!Number.isInteger(data.deductionAmountCentavos) || (data.deductionAmountCentavos as number) <= 0 || typeof data.deductionSchedule !== "string" || !data.deductionSchedule)) throw new Error("payroll deduction requires deduction amount and schedule");
};
PRESET_VALIDATORS.business_loan = (data) => { if (typeof data.linkedBusinessOrIncomeSourceId !== "string" || !data.linkedBusinessOrIncomeSourceId) throw new Error("linkedBusinessOrIncomeSourceId is required"); if (typeof data.purpose !== "string" || !data.purpose) throw new Error("purpose is required"); };
PRESET_VALIDATORS.auto_loan = (data) => { if (typeof data.vehicleDescription !== "string" || !data.vehicleDescription) throw new Error("vehicleDescription is required"); if (!Number.isInteger(data.vehiclePurchasePriceCentavos) || (data.vehiclePurchasePriceCentavos as number) <= 0) throw new Error("vehicle purchase price is required"); if (!Number.isInteger(data.downpaymentCentavos) || (data.downpaymentCentavos as number) < 0) throw new Error("downpayment is required"); if ((data.downpaymentCentavos as number) > (data.vehiclePurchasePriceCentavos as number)) throw new Error("downpayment cannot exceed vehicle purchase price"); };
PRESET_VALIDATORS.custom_debt = (data) => { if (!["no_interest", "specified", "provider_calculated"].includes(data.interestChoice as string)) throw new Error("interestChoice is invalid"); if (data.interestChoice === "specified" && (!Number.isInteger(data.interestRateBps) || (data.interestRateBps as number) < 0 || !["simple", "amortized", "compound"].includes(data.interestMethod as string))) throw new Error("specified interest requires a valid rate and method"); };

export function validatePresetData(key: string, data: Record<string, unknown>): void {
  PRESET_VALIDATORS[key]?.(data);
}

export function getDebtPreset(key: string): DebtPreset {
  return DEBT_PRESETS.find((preset) => preset.key === key)
    ?? PRESET_ENTRIES.find((preset) => preset.key === key)
    ?? { key, label: "Unknown preset", fields: [] };
}

export function getDebtPresetFields(key: string): DebtPresetField[] {
  return getDebtPreset(key).fields;
}
