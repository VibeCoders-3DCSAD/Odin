export type DebtPreset = { key: string; label: string };

const PRESET_ENTRIES: Array<[string, string]> = [
  ["credit_card", "Credit card"], ["personal_salary_loan", "Personal or salary loan"],
  ["auto_loan", "Auto or vehicle loan"], ["housing_loan", "Housing or mortgage loan"],
  ["informal_loan", "Family or friend loan"], ["bnpl", "Buy now, pay later"],
  ["online_lending_app", "Online lending app"], ["product_installment", "Product or gadget installment"],
  ["government_member_loan", "Government member loan"], ["microfinance_loan", "Microfinance loan"],
];
export const DEBT_PRESETS: DebtPreset[] = PRESET_ENTRIES.map(([key, label]) => ({ key, label }));

export function getDebtPreset(key: string): DebtPreset {
  return DEBT_PRESETS.find((preset) => preset.key === key) ?? { key, label: "Unknown preset" };
}
