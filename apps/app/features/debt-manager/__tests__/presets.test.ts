import { DEBT_PRESETS, getDebtPreset, validatePresetData } from "../presets";

test("exposes the canonical debt preset registry", () => {
  expect(DEBT_PRESETS.map((preset) => preset.key)).toEqual([
    "personal_loan", "salary_loan", "multipurpose_loan", "business_loan", "auto_loan", "custom_debt",
  ]);
});

test("preserves legacy preset readability and validates salary requirements", () => {
  expect(getDebtPreset("personal_salary_loan").label).toBe("Personal or salary loan");
  expect(() => validatePresetData("salary_loan", { linkedIncomeSourceId: "income-1", repaymentMethod: "payroll_deduction" })).toThrow("payroll deduction");
});

test("rejects an auto-loan downpayment above purchase price", () => {
  expect(() => validatePresetData("auto_loan", {
    vehicleDescription: "Sedan",
    vehiclePurchasePriceCentavos: 100000,
    downpaymentCentavos: 100001,
  })).toThrow("downpayment cannot exceed vehicle purchase price");
});

test("validates specified custom-debt interest details", () => {
  expect(() => validatePresetData("custom_debt", { interestChoice: "specified" })).toThrow("specified interest");
  expect(() => validatePresetData("custom_debt", { interestChoice: "specified", interestRateBps: 1200, interestMethod: "amortized" })).not.toThrow();
});
