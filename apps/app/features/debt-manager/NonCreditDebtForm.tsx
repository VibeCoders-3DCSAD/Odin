import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  createDebtAccount,
  updateDebtAccount,
  type CreateDebtAccountInput,
  type DebtAccount,
  type DebtTypePreset,
  type InterestMethod,
  type InterestRatePeriod,
  type PaymentFrequency,
  type SalaryLoanProvider,
} from "../../local-db/repositories/debtAccounts";
import { listIncomeSources, type IncomeSource } from "../../local-db/repositories/financialFoundations";
import {
  DEBT_PLACEHOLDERS,
  DEBT_TYPE_OPTIONS,
  INTEREST_METHOD_OPTIONS,
  INTEREST_PERIOD_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  SALARY_LOAN_PROVIDER_OPTIONS,
} from "./debtTypes";

const P = {
  shell: "#F8F4EB",
  card: "#FFFDF8",
  ink: "#17261E",
  muted: "#66736A",
  brand: "#123F2C",
  white: "#FFFFFF",
  softCard: "#E5F0E3",
  optionLine: "#C8D9C6",
  line: "#E2E4DC",
  error: "#D9001F",
} as const;
const PERSONAL_PURPOSES = ["Emergency", "Medical", "Education", "Home Improvement", "Debt Consolidation", "Personal Purchase", "Other"];
const MULTIPURPOSE_PURPOSES = ["Home Improvement", "Education", "Medical", "Livelihood", "Emergency", "Utility", "Other"];
const BUSINESS_PURPOSES = ["Working Capital", "Inventory", "Equipment", "Expansion", "Operating Expenses", "Emergency", "Other"];
const REPAYMENT_METHODS = [{ value: "payroll_deduction", label: "Payroll Deduction" }, { value: "automatic_debit", label: "Automatic Debit" }, { value: "manual_payment", label: "Manual Payment" }, { value: "other", label: "Other" }] as const;

type NonCreditDebtFormProps = {
  userId: string;
  deviceId: string;
  debt?: DebtAccount | null;
  onCancel: () => void;
  onSaved: (debt: DebtAccount) => void;
};

type Option<T extends string> = { value: T; label: string };

function pesos(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

function Section({ eyebrow, title, children, first = false }: { eyebrow: string; title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <View style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 18, borderWidth: 1, gap: 16, padding: 16 }}>
      <View style={{ flexDirection: "row", gap: 11, alignItems: "center" }}>
        <View style={{ alignItems: "center", backgroundColor: first ? P.brand : P.softCard, borderRadius: 9, height: 32, justifyContent: "center", width: 32 }}>
          <Text style={{ color: first ? P.white : P.brand, fontFamily: "Manrope", fontSize: 10, fontWeight: "800" }}>{eyebrow}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 2 }}>{first ? "START HERE" : "DETAILS"}</Text>
          <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 16, fontWeight: "800" }}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function Field({ label, placeholder, value, onChangeText, numeric = false, prefix, suffix, error }: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
  prefix?: string;
  suffix?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 11.5, fontWeight: "800" }}>{label}</Text>
      <View style={{ alignItems: "center", backgroundColor: "#FBFAF5", borderColor: error ? P.error : focused ? P.brand : P.line, borderRadius: 12, borderWidth: focused || error ? 1.5 : 1, flexDirection: "row", height: 50, paddingHorizontal: 13 }}>
        {prefix ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 13, fontWeight: "700", marginRight: 7 }}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor="#919A91"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={numeric ? "decimal-pad" : "default"}
          style={{ color: P.ink, flex: 1, fontFamily: "Manrope", fontSize: 14, paddingVertical: 8 }}
        />
        {suffix ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, fontWeight: "700", marginLeft: 7 }}>{suffix}</Text> : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: P.error, fontFamily: "Manrope", fontSize: 11 }}>{error}</Text> : null}
    </View>
  );
}

function Options<T extends string>({ values, selected, onChange, compact = false, cards = false }: { values: Option<T>[]; selected: T; onChange: (value: T) => void; compact?: boolean; cards?: boolean }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((item) => {
        const active = selected === item.value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Select ${item.label}`}
            accessibilityHint="Double tap to select this option"
            onPress={() => onChange(item.value)}
            style={({ pressed }) => ({
               alignItems: "center",
               backgroundColor: active ? P.brand : P.softCard,
               borderColor: active ? P.brand : P.optionLine,
               borderRadius: cards ? 14 : 11,
               borderWidth: 1,
               flexDirection: "row",
               gap: 7,
               justifyContent: "center",
               minHeight: cards ? 52 : 44,
               opacity: pressed ? 0.8 : 1,
               paddingHorizontal: compact ? 10 : 12,
               paddingVertical: compact ? 6 : 9,
               ...(cards ? { flexBasis: "47.5%", flexGrow: 1 } : {}),
             })}
           >
            <View style={{ alignItems: "center", backgroundColor: active ? P.white : "transparent", borderColor: active ? P.white : P.muted, borderRadius: 6, borderWidth: 1.5, height: 12, justifyContent: "center", width: 12 }}>
              {active ? <View style={{ backgroundColor: P.brand, borderRadius: 3, height: 6, width: 6 }} /> : null}
            </View>
             <Text style={{ color: active ? P.white : P.ink, fontFamily: "Manrope", fontSize: compact ? 12 : cards ? 12.5 : 13, fontWeight: "800" }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NonCreditDebtForm({ userId, deviceId, debt, onCancel, onSaved }: NonCreditDebtFormProps) {
  const [type, setType] = useState<DebtTypePreset>(debt?.type ?? "personal_loan");
  const [name, setName] = useState(debt?.name ?? "");
  const [lender, setLender] = useState(debt?.lenderName ?? "");
  const [original, setOriginal] = useState(debt ? String(debt.originalBalanceCentavos / 100) : "");
  const [balance, setBalance] = useState(debt ? String(debt.currentBalanceCentavos / 100) : "");
  const [payment, setPayment] = useState(debt ? String(debt.minimumPaymentCentavos / 100) : "");
  const [allowsExtraPayments, setAllowsExtraPayments] = useState(debt?.allowsExtraPayments ?? false);
  const [startDate, setStartDate] = useState(debt?.typeSpecific.startDate ?? "");
  const [nextDueDate, setNextDueDate] = useState(debt?.nextDueDate ?? "");
  const [targetPayoffDate, setTargetPayoffDate] = useState(debt?.targetPayoffDate ?? "");
  const [maturityDate, setMaturityDate] = useState(debt?.maturityDate ?? "");
  const [rate, setRate] = useState(debt ? String(debt.annualInterestRateBps / 100) : "0");
  const [frequency, setFrequency] = useState<PaymentFrequency>(debt?.paymentFrequency ?? "monthly");
  const [semiMonthlyFirstDay, setSemiMonthlyFirstDay] = useState(String(debt?.paymentSchedule.semiMonthlyDays?.[0] ?? 1));
  const [semiMonthlySecondDay, setSemiMonthlySecondDay] = useState(String(debt?.paymentSchedule.semiMonthlyDays?.[1] ?? 15));
  const [customIntervalDays, setCustomIntervalDays] = useState(debt?.paymentSchedule.customIntervalDays?.toString() ?? "");
  const [period, setPeriod] = useState<InterestRatePeriod>(debt?.interestPeriod ?? "annual");
  const [method, setMethod] = useState<InterestMethod>(debt?.interestMethod ?? "no_interest");
  const [purpose, setPurpose] = useState(debt?.typeSpecific.personalLoan?.purpose ?? "");
  const [incomeSource, setIncomeSource] = useState(debt?.typeSpecific.salaryLoan?.linkedIncomeSourceId ?? "");
  const [salaryLoanProvider, setSalaryLoanProvider] = useState<SalaryLoanProvider | "">(debt?.typeSpecific.salaryLoan?.provider ?? "");
  const [repaymentMethod, setRepaymentMethod] = useState(debt?.typeSpecific.salaryLoan?.repaymentMethod ?? "manual_payment");
  const [deduction, setDeduction] = useState(debt?.typeSpecific.salaryLoan?.deductionAmountCentavos ? String(debt.typeSpecific.salaryLoan.deductionAmountCentavos / 100) : "");
  const [deductionSchedule, setDeductionSchedule] = useState<PaymentFrequency>(debt?.typeSpecific.salaryLoan?.deductionSchedule ?? "monthly");
  const [businessSource, setBusinessSource] = useState(debt?.typeSpecific.businessLoan?.linkedBusinessOrIncomeSourceId ?? "");
  const [vehicle, setVehicle] = useState(debt?.typeSpecific.autoLoan?.vehicleDescription ?? "");
  const [vehiclePrice, setVehiclePrice] = useState(debt?.typeSpecific.autoLoan?.vehiclePurchasePriceCentavos == null ? "" : String(debt.typeSpecific.autoLoan.vehiclePurchasePriceCentavos / 100));
  const [downpayment, setDownpayment] = useState(debt?.typeSpecific.autoLoan?.downpaymentCentavos == null ? "" : String(debt.typeSpecific.autoLoan.downpaymentCentavos / 100));
  const [fees, setFees] = useState(debt ? String(debt.typeSpecific.feesCentavos / 100) : "");
  const [penaltyInfo, setPenaltyInfo] = useState(debt?.typeSpecific.penaltyInfo ?? "");
  const [termMonths, setTermMonths] = useState(debt?.typeSpecific.termMonths?.toString() ?? "");
  const [notes, setNotes] = useState(debt?.notes ?? "");
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { listIncomeSources(userId).then(setIncomeSources).catch(() => setIncomeSources([])); }, [userId]);
  useEffect(() => { setErrors({}); }, [balance, customIntervalDays, fees, lender, name, nextDueDate, original, payment, rate, semiMonthlyFirstDay, semiMonthlySecondDay, startDate, targetPayoffDate, termMonths]);

  async function save() {
    const input: CreateDebtAccountInput = {
      type, name, lenderName: lender || null, originalBalanceCentavos: pesos(original), currentBalanceCentavos: pesos(balance), annualInterestRateBps: Math.round(Number(rate) * 100), minimumPaymentCentavos: pesos(payment), allowsExtraPayments, paymentFrequency: frequency, paymentSchedule: { semiMonthlyDays: frequency === "semi_monthly" ? [Number(semiMonthlyFirstDay), Number(semiMonthlySecondDay)] : undefined, customIntervalDays: frequency === "custom" ? Number(customIntervalDays) : undefined }, startDate, nextDueDate, maturityDate: maturityDate || null, targetPayoffDate, interestPeriod: period, interestMethod: method, notes: notes || null,
      typeSpecific: {
        startDate, feesCentavos: fees ? pesos(fees) : 0, penaltyInfo: penaltyInfo || null, termMonths: termMonths ? Number(termMonths) : null,
        personalLoan: type === "personal_loan" ? { purpose: purpose || null } : undefined,
        salaryLoan: type === "salary_loan" ? { provider: salaryLoanProvider || null, linkedIncomeSourceId: incomeSource || null, repaymentMethod, deductionAmountCentavos: deduction ? pesos(deduction) : null, deductionSchedule } : undefined,
        multipurposeLoan: type === "multipurpose_loan" ? { purposes: purpose ? [purpose] : [] } : undefined,
        businessLoan: type === "business_loan" ? { linkedBusinessOrIncomeSourceId: businessSource || null, purpose: purpose || null } : undefined,
        autoLoan: type === "auto_loan" ? { vehicleDescription: vehicle || null, vehiclePurchasePriceCentavos: vehiclePrice ? pesos(vehiclePrice) : null, downpaymentCentavos: downpayment ? pesos(downpayment) : null, financedPrincipalCentavos: vehiclePrice ? pesos(vehiclePrice) - pesos(downpayment || "0") : null } : undefined,
      },
    };

    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Debt name is required.";
    if (type !== "custom_debt" && !lender.trim()) nextErrors.lender = "Lender or provider is required.";
    if (type === "salary_loan" && !salaryLoanProvider) nextErrors.salaryLoanProvider = "Choose the salary-loan provider.";
    if (type === "salary_loan" && !incomeSource) nextErrors.incomeSource = "Choose the income source that is deducted.";
    const salaryDeduction = input.typeSpecific.salaryLoan?.deductionAmountCentavos;
    if (type === "salary_loan" && repaymentMethod === "payroll_deduction" && (!deduction || typeof salaryDeduction !== "number" || !Number.isFinite(salaryDeduction) || salaryDeduction <= 0)) nextErrors.deduction = "Payroll deduction must be positive.";
    if (!Number.isFinite(input.originalBalanceCentavos) || input.originalBalanceCentavos <= 0) nextErrors.original = "Original amount must be positive.";
    if (!Number.isFinite(input.currentBalanceCentavos) || input.currentBalanceCentavos < 0) nextErrors.balance = "Current balance must be non-negative.";
    if (!Number.isFinite(input.minimumPaymentCentavos) || input.minimumPaymentCentavos <= 0) nextErrors.payment = "Minimum payment must be positive.";
    if (!Number.isFinite(input.annualInterestRateBps) || input.annualInterestRateBps < 0) nextErrors.rate = "Interest rate must be a non-negative number.";
    if (method === "no_interest" && input.annualInterestRateBps !== 0) nextErrors.rate = "No-interest debts must use a zero interest rate.";
    if (!Number.isFinite(input.typeSpecific.feesCentavos) || input.typeSpecific.feesCentavos < 0) nextErrors.fees = "Fees must be non-negative.";
    if (termMonths && (!Number.isSafeInteger(input.typeSpecific.termMonths) || input.typeSpecific.termMonths! <= 0)) nextErrors.termMonths = "Term must be a positive whole number of months.";
    if (!startDate) nextErrors.startDate = "Start date is required.";
    if (!nextDueDate) nextErrors.nextDueDate = "Next payment date is required.";
    if (!targetPayoffDate) nextErrors.targetPayoffDate = "Target payoff date is required.";
    if (targetPayoffDate && nextDueDate && targetPayoffDate < nextDueDate) nextErrors.targetPayoffDate = "Target payoff date must be on or after the next payment date.";
    if (frequency === "semi_monthly" && (!Number.isInteger(input.paymentSchedule.semiMonthlyDays?.[0]) || !Number.isInteger(input.paymentSchedule.semiMonthlyDays?.[1]) || input.paymentSchedule.semiMonthlyDays![0] < 1 || input.paymentSchedule.semiMonthlyDays![0] > 28 || input.paymentSchedule.semiMonthlyDays![1] < 1 || input.paymentSchedule.semiMonthlyDays![1] > 28 || input.paymentSchedule.semiMonthlyDays![0] === input.paymentSchedule.semiMonthlyDays![1])) nextErrors.semiMonthlyDays = "Enter two different days from 1 to 28.";
    if (frequency === "custom" && (!Number.isSafeInteger(input.paymentSchedule.customIntervalDays) || input.paymentSchedule.customIntervalDays! <= 0)) nextErrors.customIntervalDays = "Custom interval must be a positive whole number of days.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage("Some debt details are not valid. Check the highlighted fields and try again.");
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const result = debt ? await updateDebtAccount(userId, deviceId, debt.id, input) : await createDebtAccount(userId, deviceId, input);
      onSaved(result.debt);
    } catch {
      setMessage("Your debt information could not be loaded or saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function renderTypeFields() {
    const incomeOptions = incomeSources.map((source) => ({ value: source.id, label: source.name }));
    const purposeOptions = (type === "business_loan" ? BUSINESS_PURPOSES : type === "multipurpose_loan" ? MULTIPURPOSE_PURPOSES : PERSONAL_PURPOSES).map((value) => ({ value, label: value }));
    if (type === "salary_loan") return <View style={{ gap: 12 }}><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Provider</Text><Options values={[...SALARY_LOAN_PROVIDER_OPTIONS]} selected={salaryLoanProvider} onChange={setSalaryLoanProvider} compact />{errors.salaryLoanProvider ? <Text style={{ color: P.error, fontFamily: "Manrope", fontSize: 11 }}>{errors.salaryLoanProvider}</Text> : null}</View><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Income source to deduct from</Text>{incomeOptions.length ? <Options values={incomeOptions} selected={incomeSource} onChange={setIncomeSource} compact /> : <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Add an income source before creating a salary loan.</Text>}{errors.incomeSource ? <Text style={{ color: P.error, fontFamily: "Manrope", fontSize: 11 }}>{errors.incomeSource}</Text> : null}</View><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Repayment method</Text><Options values={[...REPAYMENT_METHODS]} selected={repaymentMethod} onChange={setRepaymentMethod} compact /></View>{repaymentMethod === "payroll_deduction" ? <><Field label="Payroll deduction" placeholder={DEBT_PLACEHOLDERS.salaryDeductionAmount} value={deduction} onChangeText={setDeduction} numeric prefix="PHP" error={errors.deduction} /><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, lineHeight: 16 }}>This amount is subtracted from the selected income source after its gross income is calculated.</Text><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Deduction schedule</Text><Options values={PAYMENT_FREQUENCY_OPTIONS} selected={deductionSchedule} onChange={setDeductionSchedule} compact /></View></> : null}</View>;
    if (type === "auto_loan") return <View style={{ gap: 12 }}><Field label="Vehicle" placeholder={DEBT_PLACEHOLDERS.autoVehicleDescription} value={vehicle} onChangeText={setVehicle} /><Field label="Vehicle purchase price" placeholder={DEBT_PLACEHOLDERS.autoPurchasePrice} value={vehiclePrice} onChangeText={setVehiclePrice} numeric prefix="PHP" /><Field label="Downpayment" placeholder={DEBT_PLACEHOLDERS.autoDownpayment} value={downpayment} onChangeText={setDownpayment} numeric prefix="PHP" /></View>;
    if (type === "business_loan") return <View style={{ gap: 12 }}><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Linked income source</Text>{incomeOptions.length ? <Options values={incomeOptions} selected={businessSource} onChange={setBusinessSource} compact /> : <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Add an income source before linking this business loan.</Text>}</View><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Loan purpose</Text><Options values={purposeOptions} selected={purpose} onChange={setPurpose} compact /></View></View>;
    return <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Loan purpose</Text><Options values={purposeOptions} selected={purpose} onChange={setPurpose} compact /></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 36 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ backgroundColor: P.brand, borderRadius: 22, overflow: "hidden", padding: 20 }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#B8D9BD", fontFamily: "Manrope", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }}>DEBT SETUP</Text>
          <View style={{ backgroundColor: "#2B5B43", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 }}>
            <Text style={{ color: P.white, fontFamily: "Manrope", fontSize: 10, fontWeight: "800" }}>{debt ? "EDITING" : "NEW ACCOUNT"}</Text>
          </View>
        </View>
        <Text style={{ color: P.white, fontFamily: "Manrope", fontSize: 25, fontWeight: "800", letterSpacing: -0.5, marginTop: 12 }}>{debt ? "Refine your plan." : "Give this debt a plan."}</Text>
        <Text style={{ color: "#C4D6C8", fontFamily: "Manrope", fontSize: 12.5, lineHeight: 18, marginTop: 6 }}>{debt ? "Update the numbers and keep your repayment forecast honest." : "A few precise details turn a balance into a repayment forecast."}</Text>
        <View style={{ flexDirection: "row", gap: 5, marginTop: 18 }}>
          {["Account", "Balance", "Terms", "Plan"].map((step, index) => (
            <View key={step} style={{ flex: 1, gap: 5 }}>
              <View style={{ backgroundColor: index === 0 ? "#B8D9BD" : "#497158", borderRadius: 99, height: 4 }} />
              <Text style={{ color: index === 0 ? P.white : "#A8C0AD", fontFamily: "Manrope", fontSize: 9.5, fontWeight: "700" }}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      <Section first eyebrow="01" title="What are you tracking?">
          <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, lineHeight: 17 }}>Choose the debt that best matches its repayment rules.</Text>
          <Options values={DEBT_TYPE_OPTIONS} selected={type} onChange={setType} cards />
          <Field label="Debt name" placeholder={DEBT_PLACEHOLDERS.debtName} value={name} onChangeText={setName} error={errors.name} />
          <Field label={`Lender or provider${type === "custom_debt" ? " (optional)" : ""}`} placeholder={DEBT_PLACEHOLDERS.lenderName} value={lender} onChangeText={setLender} error={errors.lender} />
      </Section>

      <Section eyebrow="02" title="Set the starting point">
        <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, lineHeight: 17 }}>Use the current balance for tracking. The original amount gives your progress context.</Text>
        <Field label="Original amount" placeholder={DEBT_PLACEHOLDERS.originalAmount} value={original} onChangeText={setOriginal} numeric prefix="PHP" error={errors.original} />
        <Field label="Current balance" placeholder={DEBT_PLACEHOLDERS.currentBalance} value={balance} onChangeText={setBalance} numeric prefix="PHP" error={errors.balance} />
         <Field label="Minimum payment" placeholder={DEBT_PLACEHOLDERS.paymentAmount} value={payment} onChangeText={setPayment} numeric prefix="PHP" error={errors.payment} />
         <View style={{ backgroundColor: "#FBFAF5", borderColor: P.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 12, padding: 12 }}>
           <Pressable accessibilityRole="switch" accessibilityLabel="Allow extra payments" accessibilityHint="Put extra money toward this debt when available" accessibilityState={{ checked: allowsExtraPayments }} onPress={() => setAllowsExtraPayments((value) => !value)} style={{ alignSelf: "center", backgroundColor: allowsExtraPayments ? P.brand : P.line, borderRadius: 99, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 44 }}>
             <View style={{ alignSelf: allowsExtraPayments ? "flex-end" : "flex-start", backgroundColor: P.white, borderRadius: 10, height: 20, width: 20 }} />
           </Pressable>
           <View style={{ flex: 1, gap: 2 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>Allow extra payments</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, lineHeight: 16 }}>Put extra money toward this debt when available.</Text></View>
         </View>
        <View style={{ backgroundColor: P.softCard, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }}><Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 11, fontWeight: "700", lineHeight: 16 }}>Amounts are in Philippine pesos. Recorded payments update your balance over time.</Text></View>
      </Section>

      <Section eyebrow="03" title="How does repayment work?">
        <Field label="Interest rate" placeholder={DEBT_PLACEHOLDERS.interestRate} value={rate} onChangeText={setRate} numeric suffix="%" error={errors.rate} />
        <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Rate period</Text><Options values={INTEREST_PERIOD_OPTIONS} selected={period} onChange={setPeriod} compact /></View>
        <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Interest method</Text><Options values={INTEREST_METHOD_OPTIONS} selected={method} onChange={setMethod} compact /></View>
          <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Payment frequency</Text><Options values={PAYMENT_FREQUENCY_OPTIONS} selected={frequency} onChange={setFrequency} compact /></View>
          {frequency === "semi_monthly" ? <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Field label="First payment day" placeholder="1" value={semiMonthlyFirstDay} onChangeText={setSemiMonthlyFirstDay} numeric error={errors.semiMonthlyDays} /></View><View style={{ flex: 1 }}><Field label="Second payment day" placeholder="15" value={semiMonthlySecondDay} onChangeText={setSemiMonthlySecondDay} numeric /></View></View> : null}
          {frequency === "custom" ? <Field label="Custom payment interval" placeholder="Enter number of days" value={customIntervalDays} onChangeText={setCustomIntervalDays} numeric suffix="days" error={errors.customIntervalDays} /> : null}
          <Field label="Loan or installment term (months)" placeholder={DEBT_PLACEHOLDERS.debtSpecificTerm} value={termMonths} onChangeText={setTermMonths} numeric error={errors.termMonths} />
          <Field label="Fees" placeholder="Enter fees" value={fees} onChangeText={setFees} numeric prefix="PHP" error={errors.fees} />
         <Field label="Penalty information" placeholder="Add penalty information" value={penaltyInfo} onChangeText={setPenaltyInfo} />
      </Section>

      <Section eyebrow="04" title="Anchor the payment plan">
        <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, lineHeight: 17 }}>Use YYYY-MM-DD so your schedule and forecast line up correctly.</Text>
          <Field label="Start date" placeholder={DEBT_PLACEHOLDERS.startDate} value={startDate} onChangeText={setStartDate} error={errors.startDate} />
           <Field label="Next payment date" placeholder={DEBT_PLACEHOLDERS.nextPaymentDate} value={nextDueDate} onChangeText={setNextDueDate} error={errors.nextDueDate} />
          <Field label="Maturity date" placeholder={DEBT_PLACEHOLDERS.maturityDate} value={maturityDate} onChangeText={setMaturityDate} />
          <Field label="When do you want to get this debt paid?" placeholder={DEBT_PLACEHOLDERS.targetPayoffDate} value={targetPayoffDate} onChangeText={setTargetPayoffDate} error={errors.targetPayoffDate} />
      </Section>

      {type !== "custom_debt" ? <Section eyebrow="05" title="Add the details that matter">{renderTypeFields()}</Section> : null}
      <Section eyebrow="06" title="Anything else to remember?"><Field label="Notes" placeholder={DEBT_PLACEHOLDERS.notes} value={notes} onChangeText={setNotes} /></Section>

      {message ? <View accessibilityLiveRegion="polite" style={{ backgroundColor: "#FFF0F2", borderColor: "#F3C6CE", borderRadius: 12, borderWidth: 1, padding: 12 }}><Text style={{ color: P.error, fontFamily: "Manrope", fontSize: 12, fontWeight: "700", lineHeight: 17 }}>{message}</Text></View> : null}

      <View style={{ gap: 8, paddingTop: 2 }}>
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => save().catch(() => {})} style={({ pressed }) => ({ alignItems: "center", backgroundColor: P.brand, borderRadius: 13, height: 54, justifyContent: "center", opacity: saving || pressed ? 0.6 : 1 })}><Text style={{ color: P.white, fontFamily: "Manrope", fontSize: 14, fontWeight: "800" }}>{saving ? "Saving..." : debt ? "Save changes" : "Save debt"}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={({ pressed }) => ({ alignItems: "center", borderRadius: 13, height: 46, justifyContent: "center", opacity: saving || pressed ? 0.6 : 1 })}><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>Cancel</Text></Pressable>
      </View>
    </ScrollView>
  );
}
