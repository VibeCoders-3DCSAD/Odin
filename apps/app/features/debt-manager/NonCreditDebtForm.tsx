import React, { useState } from "react";
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

function Field({ label, placeholder, value, onChangeText, numeric = false, prefix, suffix, invalid = false }: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
      <View style={{ alignItems: "center", backgroundColor: P.shell, borderColor: invalid ? P.error : P.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", height: 46, paddingHorizontal: 12 }}>
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
  const [rate, setRate] = useState(debt ? String(debt.annualInterestRateBps / 100) : "0");
  const [frequency, setFrequency] = useState<PaymentFrequency>(debt?.paymentFrequency ?? "monthly");
  const [period, setPeriod] = useState<InterestRatePeriod>(debt?.interestPeriod ?? "annual");
  const [method, setMethod] = useState<InterestMethod>(debt?.interestMethod ?? "no_interest");
  const [purpose, setPurpose] = useState(debt?.typeSpecific.personalLoan?.purpose ?? "");
  const [incomeSource, setIncomeSource] = useState(debt?.typeSpecific.salaryLoan?.linkedIncomeSourceId ?? "");
  const [repaymentMethod, setRepaymentMethod] = useState(debt?.typeSpecific.salaryLoan?.repaymentMethod ?? "manual_payment");
  const [deduction, setDeduction] = useState(debt?.typeSpecific.salaryLoan?.deductionAmountCentavos ? String(debt.typeSpecific.salaryLoan.deductionAmountCentavos / 100) : "");
  const [businessSource, setBusinessSource] = useState(debt?.typeSpecific.businessLoan?.linkedBusinessOrIncomeSourceId ?? "");
  const [vehicle, setVehicle] = useState(debt?.typeSpecific.autoLoan?.vehicleDescription ?? "");
  const [vehiclePrice, setVehiclePrice] = useState("");
  const [downpayment, setDownpayment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const invalid = Boolean(message);

  async function save() {
    const input: CreateDebtAccountInput = {
      type, name, lenderName: lender, originalBalanceCentavos: pesos(original), currentBalanceCentavos: pesos(balance), annualInterestRateBps: Math.round(Number(rate) * 100), minimumPaymentCentavos: pesos(payment), paymentFrequency: frequency, startDate, nextDueDate, interestPeriod: period, interestMethod: method,
      typeSpecific: {
        startDate, feesCentavos: 0, penaltyInfo: null, termMonths: null,
        personalLoan: type === "personal_loan" ? { purpose: purpose || null } : undefined,
        salaryLoan: type === "salary_loan" ? { linkedIncomeSourceId: incomeSource || null, repaymentMethod, deductionAmountCentavos: deduction ? pesos(deduction) : null, deductionSchedule: frequency } : undefined,
        multipurposeLoan: type === "multipurpose_loan" ? { purposes: purpose ? [purpose] : [] } : undefined,
        businessLoan: type === "business_loan" ? { linkedBusinessOrIncomeSourceId: businessSource || null, purpose: purpose || null } : undefined,
        autoLoan: type === "auto_loan" ? { vehicleDescription: vehicle || null, vehiclePurchasePriceCentavos: vehiclePrice ? pesos(vehiclePrice) : null, downpaymentCentavos: downpayment ? pesos(downpayment) : null, financedPrincipalCentavos: vehiclePrice ? pesos(vehiclePrice) - pesos(downpayment || "0") : null } : undefined,
      },
    };

    if (!name.trim() || !lender.trim() || !Number.isFinite(input.originalBalanceCentavos) || !Number.isFinite(input.currentBalanceCentavos) || !Number.isFinite(input.minimumPaymentCentavos) || !startDate || !nextDueDate) {
      setMessage("Some debt details are not valid. Check the highlighted fields and try again.");
      return;
    }

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
    if (type === "salary_loan") return <View style={{ gap: 12 }}><Field label="Linked income source" placeholder={DEBT_PLACEHOLDERS.salaryLinkedIncomeSource} value={incomeSource} onChangeText={setIncomeSource} /><Field label="Repayment method" placeholder={DEBT_PLACEHOLDERS.salaryRepaymentMethod} value={repaymentMethod} onChangeText={(value) => setRepaymentMethod(value as typeof repaymentMethod)} /><Field label="Payroll deduction" placeholder={DEBT_PLACEHOLDERS.salaryDeductionAmount} value={deduction} onChangeText={setDeduction} numeric prefix="PHP" /></View>;
    if (type === "auto_loan") return <View style={{ gap: 12 }}><Field label="Vehicle" placeholder={DEBT_PLACEHOLDERS.autoVehicleDescription} value={vehicle} onChangeText={setVehicle} /><Field label="Vehicle purchase price" placeholder={DEBT_PLACEHOLDERS.autoPurchasePrice} value={vehiclePrice} onChangeText={setVehiclePrice} numeric prefix="PHP" /><Field label="Downpayment" placeholder={DEBT_PLACEHOLDERS.autoDownpayment} value={downpayment} onChangeText={setDownpayment} numeric prefix="PHP" /></View>;
    if (type === "business_loan") return <View style={{ gap: 12 }}><Field label="Business or income source" placeholder={DEBT_PLACEHOLDERS.businessLoanSource} value={businessSource} onChangeText={setBusinessSource} /><Field label="Loan purpose" placeholder={DEBT_PLACEHOLDERS.businessLoanPurpose} value={purpose} onChangeText={setPurpose} /></View>;
    return <Field label="Loan purpose" placeholder={type === "multipurpose_loan" ? DEBT_PLACEHOLDERS.multipurposeLoanPurpose : DEBT_PLACEHOLDERS.personalLoanPurpose} value={purpose} onChangeText={setPurpose} />;
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
          <Field label="Debt name" placeholder={DEBT_PLACEHOLDERS.debtName} value={name} onChangeText={setName} invalid={invalid && !name.trim()} />
          <Field label="Lender or provider" placeholder={DEBT_PLACEHOLDERS.lenderName} value={lender} onChangeText={setLender} invalid={invalid && !lender.trim()} />
        </Section>

        <Section eyebrow="Balance" title="Set the starting point">
        <Field label="Original amount" placeholder={DEBT_PLACEHOLDERS.originalAmount} value={original} onChangeText={setOriginal} numeric prefix="PHP" invalid={invalid && !Number.isFinite(pesos(original))} />
        <Field label="Current balance" placeholder={DEBT_PLACEHOLDERS.currentBalance} value={balance} onChangeText={setBalance} numeric prefix="PHP" invalid={invalid && !Number.isFinite(pesos(balance))} />
        <Field label="Minimum payment" placeholder={DEBT_PLACEHOLDERS.paymentAmount} value={payment} onChangeText={setPayment} numeric prefix="PHP" invalid={invalid && !Number.isFinite(pesos(payment))} />
        <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, lineHeight: 16 }}>Enter amounts in Philippine pesos. You can update the balance later as payments are made.</Text>
        </Section>

        <Section eyebrow="Terms" title="How does repayment work?">
        <Field label="Interest rate" placeholder={DEBT_PLACEHOLDERS.interestRate} value={rate} onChangeText={setRate} numeric suffix="%" />
        <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Rate period</Text><Options values={INTEREST_PERIOD_OPTIONS} selected={period} onChange={setPeriod} compact /></View>
        <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Interest method</Text><Options values={INTEREST_METHOD_OPTIONS} selected={method} onChange={setMethod} compact /></View>
        <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Payment frequency</Text><Options values={PAYMENT_FREQUENCY_OPTIONS} selected={frequency} onChange={setFrequency} compact /></View>
        </Section>

        <Section eyebrow="Calendar" title="Anchor the payment plan">
        <Field label="Start date" placeholder={DEBT_PLACEHOLDERS.startDate} value={startDate} onChangeText={setStartDate} invalid={invalid && !startDate} />
        <Field label="Next payment date" placeholder={DEBT_PLACEHOLDERS.nextPaymentDate} value={nextDueDate} onChangeText={setNextDueDate} invalid={invalid && !nextDueDate} />
        </Section>

        {type !== "custom_debt" ? <Section eyebrow="Additional details" title="Add the details that matter">{renderTypeFields()}</Section> : null}

        {message ? <Text accessibilityLiveRegion="polite" style={{ color: P.error, fontFamily: "Manrope", fontSize: 12, marginTop: 2 }}>{message}</Text> : null}

        <View style={{ flexDirection: "row", gap: 10, paddingTop: 2 }}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => save().catch(() => {})} style={({ pressed }) => ({ alignItems: "center", backgroundColor: P.brand, borderRadius: 10, flex: 1, height: 46, justifyContent: "center", opacity: saving || pressed ? 0.6 : 1 })}><Text style={{ color: P.white, fontFamily: "Manrope", fontSize: 13, fontWeight: "700" }}>{saving ? "Saving..." : debt ? "Save changes" : "Save debt"}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={({ pressed }) => ({ alignItems: "center", borderColor: P.line, borderRadius: 10, borderWidth: 1, flex: 1, height: 46, justifyContent: "center", opacity: saving || pressed ? 0.6 : 1 })}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "700" }}>Cancel</Text></Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
