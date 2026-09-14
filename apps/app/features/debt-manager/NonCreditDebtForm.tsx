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
} from "../../local-db/repositories/debtAccounts";
import { listIncomeSources, type IncomeSource } from "../../local-db/repositories/financialFoundations";
import {
  DEBT_PLACEHOLDERS,
  DEBT_TYPE_OPTIONS,
  INTEREST_METHOD_OPTIONS,
  INTEREST_PERIOD_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
} from "./debtTypes";

const P = {
  shell: "#fcf8f0",
  card: "#F1F0EB",
  ink: "#1B1C1A",
  muted: "#6B7A6F",
  brand: "#013220",
  white: "#FFFFFF",
  softCard: "#f7eed9",
  optionLine: "#e8deca",
  line: "#EAEAE6",
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
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: P.line, gap: 12, paddingTop: first ? 0 : 16 }}>
      <View>
        <Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 11, fontWeight: "700", marginBottom: 3 }}>{eyebrow}</Text>
        <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 15, fontWeight: "800" }}>{title}</Text>
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
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
      <View style={{ alignItems: "center", backgroundColor: P.shell, borderColor: error ? P.error : P.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", height: 46, paddingHorizontal: 12 }}>
        {prefix ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 13, fontWeight: "700", marginRight: 7 }}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor="#919A91"
          value={value}
          onChangeText={onChangeText}
          keyboardType={numeric ? "decimal-pad" : "default"}
          style={{ color: P.ink, flex: 1, fontFamily: "Manrope", fontSize: 14, paddingVertical: 8 }}
        />
        {suffix ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, fontWeight: "700", marginLeft: 7 }}>{suffix}</Text> : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: P.error, fontFamily: "Manrope", fontSize: 11 }}>{error}</Text> : null}
    </View>
  );
}

function Options<T extends string>({ values, selected, onChange, compact = false }: { values: Option<T>[]; selected: T; onChange: (value: T) => void; compact?: boolean }) {
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
              borderRadius: 10,
              borderWidth: 1,
              flexDirection: "row",
              gap: 7,
              justifyContent: "center",
              minHeight: 44,
              opacity: pressed ? 0.8 : 1,
              paddingHorizontal: compact ? 10 : 12,
              paddingVertical: compact ? 6 : 9,
            })}
          >
            <View style={{ alignItems: "center", backgroundColor: active ? P.white : "transparent", borderColor: active ? P.white : P.muted, borderRadius: 6, borderWidth: 1.5, height: 12, justifyContent: "center", width: 12 }}>
              {active ? <View style={{ backgroundColor: P.brand, borderRadius: 3, height: 6, width: 6 }} /> : null}
            </View>
            <Text style={{ color: active ? P.white : P.ink, fontFamily: "Manrope", fontSize: compact ? 12 : 13, fontWeight: "700" }}>{item.label}</Text>
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
      type, name, lenderName: lender || null, originalBalanceCentavos: pesos(original), currentBalanceCentavos: pesos(balance), annualInterestRateBps: Math.round(Number(rate) * 100), minimumPaymentCentavos: pesos(payment), paymentFrequency: frequency, paymentSchedule: { semiMonthlyDays: frequency === "semi_monthly" ? [Number(semiMonthlyFirstDay), Number(semiMonthlySecondDay)] : undefined, customIntervalDays: frequency === "custom" ? Number(customIntervalDays) : undefined }, startDate, nextDueDate, maturityDate: maturityDate || null, targetPayoffDate, interestPeriod: period, interestMethod: method, notes: notes || null,
      typeSpecific: {
        startDate, feesCentavos: fees ? pesos(fees) : 0, penaltyInfo: penaltyInfo || null, termMonths: termMonths ? Number(termMonths) : null,
        personalLoan: type === "personal_loan" ? { purpose: purpose || null } : undefined,
        salaryLoan: type === "salary_loan" ? { linkedIncomeSourceId: incomeSource || null, repaymentMethod, deductionAmountCentavos: deduction ? pesos(deduction) : null, deductionSchedule } : undefined,
        multipurposeLoan: type === "multipurpose_loan" ? { purposes: purpose ? [purpose] : [] } : undefined,
        businessLoan: type === "business_loan" ? { linkedBusinessOrIncomeSourceId: businessSource || null, purpose: purpose || null } : undefined,
        autoLoan: type === "auto_loan" ? { vehicleDescription: vehicle || null, vehiclePurchasePriceCentavos: vehiclePrice ? pesos(vehiclePrice) : null, downpaymentCentavos: downpayment ? pesos(downpayment) : null, financedPrincipalCentavos: vehiclePrice ? pesos(vehiclePrice) - pesos(downpayment || "0") : null } : undefined,
      },
    };

    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Debt name is required.";
    if (type !== "custom_debt" && !lender.trim()) nextErrors.lender = "Lender or provider is required.";
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
    if (type === "salary_loan") return <View style={{ gap: 12 }}><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Linked income source</Text>{incomeOptions.length ? <Options values={incomeOptions} selected={incomeSource} onChange={setIncomeSource} compact /> : <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Add an income source before creating a salary loan.</Text>}</View><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Repayment method</Text><Options values={[...REPAYMENT_METHODS]} selected={repaymentMethod} onChange={setRepaymentMethod} compact /></View>{repaymentMethod === "payroll_deduction" ? <><Field label="Payroll deduction" placeholder={DEBT_PLACEHOLDERS.salaryDeductionAmount} value={deduction} onChangeText={setDeduction} numeric prefix="PHP" /><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Deduction schedule</Text><Options values={PAYMENT_FREQUENCY_OPTIONS} selected={deductionSchedule} onChange={setDeductionSchedule} compact /></View></> : null}</View>;
    if (type === "auto_loan") return <View style={{ gap: 12 }}><Field label="Vehicle" placeholder={DEBT_PLACEHOLDERS.autoVehicleDescription} value={vehicle} onChangeText={setVehicle} /><Field label="Vehicle purchase price" placeholder={DEBT_PLACEHOLDERS.autoPurchasePrice} value={vehiclePrice} onChangeText={setVehiclePrice} numeric prefix="PHP" /><Field label="Downpayment" placeholder={DEBT_PLACEHOLDERS.autoDownpayment} value={downpayment} onChangeText={setDownpayment} numeric prefix="PHP" /></View>;
    if (type === "business_loan") return <View style={{ gap: 12 }}><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Linked income source</Text>{incomeOptions.length ? <Options values={incomeOptions} selected={businessSource} onChange={setBusinessSource} compact /> : <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Add an income source before linking this business loan.</Text>}</View><View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Loan purpose</Text><Options values={purposeOptions} selected={purpose} onChange={setPurpose} compact /></View></View>;
    return <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Loan purpose</Text><Options values={purposeOptions} selected={purpose} onChange={setPurpose} compact /></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>{debt ? "Edit debt" : "Add debt"}</Text>
        <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>{debt ? "Update the account terms and repayment details." : "Add the account terms to track your repayment progress."}</Text>
      </View>

      <View style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 14, borderWidth: 1, gap: 16, padding: 14 }}>
        <Section first eyebrow="Account" title="What are you tracking?">
          <Options values={DEBT_TYPE_OPTIONS} selected={type} onChange={setType} />
          <Field label="Debt name" placeholder={DEBT_PLACEHOLDERS.debtName} value={name} onChangeText={setName} error={errors.name} />
          <Field label={`Lender or provider${type === "custom_debt" ? " (optional)" : ""}`} placeholder={DEBT_PLACEHOLDERS.lenderName} value={lender} onChangeText={setLender} error={errors.lender} />
        </Section>

        <Section eyebrow="Balance" title="Set the starting point">
        <Field label="Original amount" placeholder={DEBT_PLACEHOLDERS.originalAmount} value={original} onChangeText={setOriginal} numeric prefix="PHP" error={errors.original} />
        <Field label="Current balance" placeholder={DEBT_PLACEHOLDERS.currentBalance} value={balance} onChangeText={setBalance} numeric prefix="PHP" error={errors.balance} />
        <Field label="Minimum payment" placeholder={DEBT_PLACEHOLDERS.paymentAmount} value={payment} onChangeText={setPayment} numeric prefix="PHP" error={errors.payment} />
        <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, lineHeight: 16 }}>Enter amounts in Philippine pesos. You can update the balance later as payments are made.</Text>
        </Section>

        <Section eyebrow="Terms" title="How does repayment work?">
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

         <Section eyebrow="Calendar" title="Anchor the payment plan">
          <Field label="Start date" placeholder={DEBT_PLACEHOLDERS.startDate} value={startDate} onChangeText={setStartDate} error={errors.startDate} />
           <Field label="Next payment date" placeholder={DEBT_PLACEHOLDERS.nextPaymentDate} value={nextDueDate} onChangeText={setNextDueDate} error={errors.nextDueDate} />
          <Field label="Maturity date" placeholder={DEBT_PLACEHOLDERS.maturityDate} value={maturityDate} onChangeText={setMaturityDate} />
          <Field label="When do you want to get this debt paid?" placeholder={DEBT_PLACEHOLDERS.targetPayoffDate} value={targetPayoffDate} onChangeText={setTargetPayoffDate} error={errors.targetPayoffDate} />
         </Section>

         {type !== "custom_debt" ? <Section eyebrow="Additional details" title="Add the details that matter">{renderTypeFields()}</Section> : null}
         <Section eyebrow="Notes" title="Anything else to remember?"><Field label="Notes" placeholder={DEBT_PLACEHOLDERS.notes} value={notes} onChangeText={setNotes} /></Section>

        {message ? <Text accessibilityLiveRegion="polite" style={{ color: P.error, fontFamily: "Manrope", fontSize: 12, marginTop: 2 }}>{message}</Text> : null}

        <View style={{ flexDirection: "row", gap: 10, paddingTop: 2 }}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => save().catch(() => {})} style={({ pressed }) => ({ alignItems: "center", backgroundColor: P.brand, borderRadius: 10, flex: 1, height: 46, justifyContent: "center", opacity: saving || pressed ? 0.6 : 1 })}><Text style={{ color: P.white, fontFamily: "Manrope", fontSize: 13, fontWeight: "700" }}>{saving ? "Saving..." : debt ? "Save changes" : "Save debt"}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={({ pressed }) => ({ alignItems: "center", borderColor: P.line, borderRadius: 10, borderWidth: 1, flex: 1, height: 46, justifyContent: "center", opacity: saving || pressed ? 0.6 : 1 })}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "700" }}>Cancel</Text></Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
