import React, { useEffect, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  getSavingsAccountDetails,
  type HysaBalanceTier,
  type HysaInterestCalculationBasis,
  type HysaInterestCreditFrequency,
  type HysaQualificationPeriod,
  type SavingsAccountDetailsInput,
} from "../../local-db/repositories/savingsAccountDetails";
import type {
  CreateFinancialAccountInput,
  FinancialAccount,
} from "../../local-db/repositories/financialFoundations";
import type { GoalContributionFrequency } from "../savings-goals/contributionSchedule";

const P = {
  brand: "#013220",
  ink: "#1B1C1A",
  ink2: "#414942",
  muted: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  card: "#F1F0EB",
  white: "#FFFFFF",
};
const inputStyle = {
  height: 46,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: P.line,
  paddingHorizontal: 14,
  fontFamily: "Manrope",
  fontSize: 14,
  color: P.ink,
  backgroundColor: P.card,
} as const;
type Answer = "yes" | "no" | "unsure";
type RequirementType =
  | "deposit"
  | "transactions"
  | "spending"
  | "balance"
  | "income"
  | "other";
type Requirement = {
  type: RequirementType;
  amount: string;
  transactions: string;
  frequency: HysaQualificationPeriod;
  description: string;
};

function cents(value: string): number | null {
  const number = Number(value);
  return value.trim() && Number.isFinite(number) && number >= 0
    ? Math.round(number * 100)
    : null;
}
function rate(value: string): number | null {
  const normalized = value.trim().replace(/%$/, "").trim();
  const number = Number(normalized);
  return normalized && Number.isFinite(number) && number >= 0
    ? Math.round(number * 100)
    : null;
}
function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function pickerDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || 2000, (month || 1) - 1, day || 1);
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontFamily: "Manrope",
          fontWeight: "600",
          fontSize: 12,
          color: P.ink2,
        }}
      >
        {label}
        {required ? <Text style={{ color: P.error }}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}
function Section({
  title,
  optional,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        gap: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: P.line,
      }}
    >
      <View>
        <Text
          style={{
            fontFamily: "Manrope",
            fontSize: 14,
            fontWeight: "800",
            color: P.ink,
          }}
        >
          {title}
        </Text>
        {optional ? (
          <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted }}>
            Optional
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
function Choices<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === option.value }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: value === option.value ? P.brand : P.card,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope",
              fontSize: 12,
              fontWeight: "600",
              color: value === option.value ? P.white : P.ink2,
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function HysaAccountFormSheet({
  userId,
  visible,
  editing,
  onClose,
  onSubmit,
}: {
  userId: string;
  visible: boolean;
  editing: FinancialAccount | null;
  onClose: () => void;
  onSubmit: (
    input: CreateFinancialAccountInput,
    details: SavingsAccountDetailsInput,
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [balance, setBalance] = useState("");
  const [openedOn, setOpenedOn] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [basis, setBasis] = useState<HysaInterestCalculationBasis>(
    "daily_ending_balance",
  );
  const [creditFrequency, setCreditFrequency] =
    useState<HysaInterestCreditFrequency>("monthly");
  const [minimumBalance, setMinimumBalance] = useState("");
  const [maximumBalance, setMaximumBalance] = useState("");
  const [higherRate, setHigherRate] = useState<Answer>("no");
  const [higherRateValue, setHigherRateValue] = useState("");
  const [qualificationPeriod, setQualificationPeriod] =
    useState<HysaQualificationPeriod>("monthly");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [addingRequirement, setAddingRequirement] = useState(false);
  const [requirementType, setRequirementType] =
    useState<RequirementType>("deposit");
  const [requirementAmount, setRequirementAmount] = useState("");
  const [requirementTransactions, setRequirementTransactions] = useState("");
  const [requirementFrequency, setRequirementFrequency] =
    useState<HysaQualificationPeriod>("monthly");
  const [requirementDescription, setRequirementDescription] = useState("");
  const [balanceRate, setBalanceRate] = useState<Answer>("no");
  const [tiers, setTiers] = useState<HysaBalanceTier[]>([]);
  const [promotion, setPromotion] = useState<"yes" | "no">("no");
  const [promotionRate, setPromotionRate] = useState("");
  const [promotionStart, setPromotionStart] = useState("");
  const [promotionEnd, setPromotionEnd] = useState("");
  const [regularSavings, setRegularSavings] = useState(false);
  const [contribution, setContribution] = useState("");
  const [contributionFrequency, setContributionFrequency] =
    useState<GoalContributionFrequency>("monthly");
  const [nextContribution, setNextContribution] = useState("");
  const [customDays, setCustomDays] = useState("");
  const [picker, setPicker] = useState<
    "opened" | "promo-start" | "promo-end" | "contribution" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (!editing) return;
    setName(editing.name);
    setInstitution(editing.institutionName ?? "");
    setBalance(String(editing.openingBalanceCentavos / 100));
    setOpenedOn(editing.openedOn ?? "");
    getSavingsAccountDetails(userId, editing.id).then((details) => {
      if (!details) return;
      setBaseRate(
        details.baseInterestRateBps == null
          ? ""
          : String(details.baseInterestRateBps / 100),
      );
      setBasis(details.interestCalculationBasis ?? "daily_ending_balance");
      setCreditFrequency(details.interestCreditFrequency ?? "monthly");
      setMinimumBalance(
        details.minimumBalanceCentavos == null
          ? ""
          : String(details.minimumBalanceCentavos / 100),
      );
      setMaximumBalance(
        details.maximumEligibleBalanceCentavos == null
          ? ""
          : String(details.maximumEligibleBalanceCentavos / 100),
      );
      setHigherRate(details.boostedInterestRateBps == null ? "no" : "yes");
      setHigherRateValue(
        details.boostedInterestRateBps == null
          ? ""
          : String(details.boostedInterestRateBps / 100),
      );
      setQualificationPeriod(details.qualificationPeriod ?? "monthly");
      setBalanceRate(details.balanceTiers?.length ? "yes" : "no");
      setTiers(details.balanceTiers ?? []);
      setPromotion(details.promotionalInterestRateBps == null ? "no" : "yes");
      setPromotionRate(
        details.promotionalInterestRateBps == null
          ? ""
          : String(details.promotionalInterestRateBps / 100),
      );
      setPromotionStart(details.promotionStartDate ?? "");
      setPromotionEnd(details.promotionEndDate ?? "");
      setRegularSavings(details.plannedContributionAmountCentavos != null);
      setContribution(
        details.plannedContributionAmountCentavos == null
          ? ""
          : String(details.plannedContributionAmountCentavos / 100),
      );
      setContributionFrequency(details.contributionFrequency ?? "monthly");
      setNextContribution(details.nextContributionDate ?? "");
      setCustomDays(
        details.customIntervalDays == null
          ? ""
          : String(details.customIntervalDays),
      );
    });
  }, [editing, userId, visible]);

  const addRequirement = () => {
    if (
      (requirementType === "other" && !requirementDescription.trim()) ||
      (requirementType !== "other" &&
        requirementType !== "transactions" &&
        cents(requirementAmount) === null) ||
      (requirementType === "transactions" &&
        (!/^\d+$/.test(requirementTransactions) ||
          Number(requirementTransactions) <= 0))
    ) {
      setError("Complete the requirement before adding it.");
      return;
    }
    setRequirements((current) => [
      ...current,
      {
        type: requirementType,
        amount: requirementAmount,
        transactions: requirementTransactions,
        frequency: requirementFrequency,
        description: requirementDescription.trim(),
      },
    ]);
    setAddingRequirement(false);
    setRequirementAmount("");
    setRequirementTransactions("");
    setRequirementDescription("");
    setError(null);
  };
  const save = async () => {
    const openingBalanceCentavos = cents(balance);
    const baseInterestRateBps = rate(baseRate);
    const boostedInterestRateBps = rate(higherRateValue);
    const promotionalInterestRateBps = rate(promotionRate);
    const missing: string[] = [];
    if (!name.trim()) missing.push("Account name");
    if (openingBalanceCentavos === null) missing.push("Current balance");
    if (baseInterestRateBps === null) missing.push("Regular interest rate");
    if (higherRate === "yes" && boostedInterestRateBps === null)
      missing.push("Higher interest rate");
    if (higherRate === "yes" && !requirements.length)
      missing.push("At least one higher-rate requirement");
    if (promotion === "yes" && promotionalInterestRateBps === null)
      missing.push("Promotional interest rate");
    if (promotion === "yes" && !promotionStart)
      missing.push("Promotion start date");
    if (promotion === "yes" && !promotionEnd)
      missing.push("Promotion end date");
    if (regularSavings && cents(contribution) === null)
      missing.push("Savings-plan amount");
    if (regularSavings && !nextContribution) missing.push("Next deposit date");
    if (
      regularSavings &&
      contributionFrequency === "custom" &&
      (!/^\d+$/.test(customDays) || Number(customDays) <= 0)
    )
      missing.push("Custom frequency days");
    if (missing.length) {
      setError(`Complete: ${missing.join(", ")}.`);
      return;
    }
    const first = (type: RequirementType) =>
      requirements.find((item) => item.type === type);
    const deposit = first("deposit");
    const transactions = first("transactions");
    const income = first("income");
    const balanceRequirement = first("balance");
    const conditionSummary = requirements.length
      ? requirements
          .map((item) =>
            item.type === "other"
              ? item.description
              : `${item.type}: ${item.type === "transactions" ? item.transactions : `PHP ${item.amount}`} every ${item.frequency}`,
          )
          .join("\n")
      : null;
    setSaving(true);
    try {
      await onSubmit(
        {
          name: name.trim(),
          kind: "savings",
          openingBalanceCentavos: openingBalanceCentavos!,
          institutionName: institution.trim() || null,
          openedOn: openedOn || null,
        },
        {
          accountType: "high_yield_savings",
          interestRateBps: null,
          minimumBalanceCentavos:
            cents(minimumBalance) ?? cents(balanceRequirement?.amount ?? ""),
          baseInterestRateBps: baseInterestRateBps!,
          effectiveInterestRateBps:
            higherRate === "yes" ? boostedInterestRateBps : null,
          interestConditions: conditionSummary,
          higherRateEligible:
            higherRate === "yes" ? true : higherRate === "no" ? false : null,
          boostedInterestRateBps:
            higherRate === "yes" ? boostedInterestRateBps : null,
          interestCalculationBasis: basis,
          interestCreditFrequency: creditFrequency,
          maximumEligibleBalanceCentavos: cents(maximumBalance),
          balanceTiers: balanceRate === "yes" ? tiers : null,
          requiredDepositCentavos: cents(deposit?.amount ?? ""),
          requiredDepositFrequency: deposit?.frequency ?? null,
          requiredTransactionCount: transactions
            ? Number(transactions.transactions)
            : null,
          requiredTransactionPeriod: transactions?.frequency ?? null,
          directDepositThresholdCentavos: cents(income?.amount ?? ""),
          qualificationPeriod: requirements.length ? qualificationPeriod : null,
          promotionalInterestRateBps:
            promotion === "yes" ? promotionalInterestRateBps : null,
          promotionStartDate: promotion === "yes" ? promotionStart : null,
          promotionEndDate: promotion === "yes" ? promotionEnd : null,
          principalCentavos: null,
          maturityDate: null,
          termMonths: null,
          earlyWithdrawalRule: null,
          plannedContributionAmountCentavos: regularSavings
            ? cents(contribution)
            : null,
          contributionFrequency: regularSavings ? contributionFrequency : null,
          contributionIntervalCount: regularSavings ? 1 : null,
          contributionDayOfMonth: null,
          contributionSecondDayOfMonth: null,
          contributionDayOfWeek: null,
          customIntervalDays:
            regularSavings && contributionFrequency === "custom"
              ? Number(customDays)
              : null,
          nextContributionDate: regularSavings ? nextContribution : null,
        },
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this account.",
      );
    } finally {
      setSaving(false);
    }
  };
  const dateValue =
    picker === "opened"
      ? openedOn
      : picker === "promo-start"
        ? promotionStart
        : picker === "promo-end"
          ? promotionEnd
          : nextContribution;
  const setDate = (value: string) => {
    if (picker === "opened") setOpenedOn(value);
    if (picker === "promo-start") setPromotionStart(value);
    if (picker === "promo-end") setPromotionEnd(value);
    if (picker === "contribution") setNextContribution(value);
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
          >
            <Pressable onPress={() => {}}>
              <View
                style={{
                  backgroundColor: P.white,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  maxHeight: Dimensions.get("window").height * 0.9,
                }}
              >
                <ScrollView
                  contentContainerStyle={{ padding: 22, gap: 16 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text
                    style={{
                      fontFamily: "Manrope",
                      fontWeight: "800",
                      fontSize: 18,
                      color: P.ink,
                    }}
                  >
                    {editing
                      ? "Edit High-Yield Savings"
                      : "Add High-Yield Savings"}
                  </Text>
                  <Section title="ACCOUNT DETAILS">
                    <Field label="ACCOUNT NAME" required>
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Emergency Fund"
                        placeholderTextColor={P.muted}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="BANK OR PROVIDER">
                      <TextInput
                        value={institution}
                        onChangeText={setInstitution}
                        placeholder="Bank or provider"
                        placeholderTextColor={P.muted}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="CURRENT BALANCE (PHP)" required>
                      <TextInput
                        value={balance}
                        onChangeText={setBalance}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={P.muted}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="DATE OPENED">
                      <Pressable
                        onPress={() => setPicker("opened")}
                        style={inputStyle}
                      >
                        <Text
                          style={{
                            marginTop: 13,
                            fontFamily: "Manrope",
                            color: openedOn ? P.ink : P.muted,
                          }}
                        >
                          {openedOn || "Select date"}
                        </Text>
                      </Pressable>
                    </Field>
                  </Section>
                  <Section title="INTEREST">
                    <Field label="REGULAR INTEREST RATE (% PER YEAR)" required>
                      <TextInput
                        value={baseRate}
                        onChangeText={setBaseRate}
                        keyboardType="decimal-pad"
                        placeholder="3.50"
                        placeholderTextColor={P.muted}
                        style={inputStyle}
                      />
                    </Field>
                    <Field
                      label="HOW DOES YOUR BANK CALCULATE INTEREST?"
                      required
                    >
                      <Choices
                        value={basis}
                        onChange={setBasis}
                        options={[
                          {
                            value: "daily_ending_balance",
                            label: "Based on your balance each day",
                          },
                          {
                            value: "average_daily_balance",
                            label: "Based on your average balance",
                          },
                          {
                            value: "monthly_average_balance",
                            label: "I'm not sure",
                          },
                        ]}
                      />
                    </Field>
                    <Field label="HOW OFTEN IS INTEREST ADDED?" required>
                      <Choices
                        value={creditFrequency}
                        onChange={setCreditFrequency}
                        options={[
                          { value: "monthly", label: "Every month" },
                          { value: "quarterly", label: "Every 3 months" },
                          { value: "at_maturity", label: "At maturity" },
                        ]}
                      />
                    </Field>
                    <Field label="MINIMUM BALANCE NEEDED">
                      <TextInput
                        value={minimumBalance}
                        onChangeText={setMinimumBalance}
                        keyboardType="decimal-pad"
                        placeholder="Optional"
                        placeholderTextColor={P.muted}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="MAXIMUM BALANCE THAT EARNS INTEREST">
                      <TextInput
                        value={maximumBalance}
                        onChangeText={setMaximumBalance}
                        keyboardType="decimal-pad"
                        placeholder="Optional"
                        placeholderTextColor={P.muted}
                        style={inputStyle}
                      />
                    </Field>
                  </Section>
                  <Section title="HIGHER INTEREST">
                    <Text style={{ fontFamily: "Manrope", color: P.ink2 }}>
                      Can you earn a higher interest rate by completing certain
                      activities?
                    </Text>
                    <Choices
                      value={higherRate}
                      onChange={setHigherRate}
                      options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                        { value: "unsure", label: "I'm not sure" },
                      ]}
                    />
                    {higherRate === "yes" ? (
                      <View style={{ gap: 12 }}>
                        <Field
                          label="HIGHER INTEREST RATE (% PER YEAR)"
                          required
                        >
                          <TextInput
                            value={higherRateValue}
                            onChangeText={setHigherRateValue}
                            keyboardType="decimal-pad"
                            placeholder="5.00"
                            placeholderTextColor={P.muted}
                            style={inputStyle}
                          />
                        </Field>
                        <Field
                          label="HOW OFTEN DO YOU NEED TO QUALIFY?"
                          required
                        >
                          <Choices
                            value={qualificationPeriod}
                            onChange={setQualificationPeriod}
                            options={[
                              { value: "monthly", label: "Every month" },
                              { value: "quarterly", label: "Every 3 months" },
                              { value: "custom", label: "Custom" },
                            ]}
                          />
                        </Field>
                        <Text
                          style={{
                            fontFamily: "Manrope",
                            fontWeight: "700",
                            color: P.ink,
                          }}
                        >
                          Requirements *
                        </Text>
                        {requirements.map((item, index) => (
                          <View
                            key={`${item.type}-${index}`}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              padding: 10,
                              borderRadius: 10,
                              backgroundColor: P.card,
                            }}
                          >
                            <Text
                              style={{ fontFamily: "Manrope", color: P.ink }}
                            >
                              {item.type === "other"
                                ? item.description
                                : `${item.type} every ${item.frequency}`}
                            </Text>
                            <Pressable
                              onPress={() =>
                                setRequirements((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                            >
                              <Text
                                style={{
                                  color: P.error,
                                  fontFamily: "Manrope",
                                  fontWeight: "700",
                                }}
                              >
                                Remove
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                        {addingRequirement ? (
                          <View
                            style={{
                              gap: 10,
                              padding: 12,
                              borderWidth: 1,
                              borderColor: P.line,
                              borderRadius: 12,
                            }}
                          >
                            <Choices
                              value={requirementType}
                              onChange={setRequirementType}
                              options={[
                                { value: "deposit", label: "Add money" },
                                {
                                  value: "transactions",
                                  label: "Make transactions",
                                },
                                { value: "spending", label: "Spend money" },
                                {
                                  value: "balance",
                                  label: "Maintain a balance",
                                },
                                { value: "income", label: "Receive income" },
                                { value: "other", label: "Other" },
                              ]}
                            />
                            {requirementType === "other" ? (
                              <TextInput
                                value={requirementDescription}
                                onChangeText={setRequirementDescription}
                                multiline
                                placeholder="Describe what your bank requires"
                                placeholderTextColor={P.muted}
                                style={[
                                  inputStyle,
                                  { height: 80, paddingTop: 12 },
                                ]}
                              />
                            ) : requirementType === "transactions" ? (
                              <TextInput
                                value={requirementTransactions}
                                onChangeText={setRequirementTransactions}
                                keyboardType="number-pad"
                                placeholder="Number of transactions"
                                placeholderTextColor={P.muted}
                                style={inputStyle}
                              />
                            ) : (
                              <TextInput
                                value={requirementAmount}
                                onChangeText={setRequirementAmount}
                                keyboardType="decimal-pad"
                                placeholder="Amount in PHP"
                                placeholderTextColor={P.muted}
                                style={inputStyle}
                              />
                            )}
                            <Choices
                              value={requirementFrequency}
                              onChange={setRequirementFrequency}
                              options={[
                                { value: "monthly", label: "Every month" },
                                { value: "quarterly", label: "Every 3 months" },
                                { value: "custom", label: "Custom" },
                              ]}
                            />
                            <Pressable onPress={addRequirement}>
                              <Text
                                style={{
                                  color: P.brand,
                                  fontFamily: "Manrope",
                                  fontWeight: "800",
                                }}
                              >
                                Add requirement
                              </Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable onPress={() => setAddingRequirement(true)}>
                            <Text
                              style={{
                                color: P.brand,
                                fontFamily: "Manrope",
                                fontWeight: "800",
                              }}
                            >
                              + Add requirement
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ) : null}
                  </Section>
                  <Section title="SPECIAL RATE RULES">
                    <Text style={{ fontFamily: "Manrope", color: P.ink2 }}>
                      Does the rate change based on your balance?
                    </Text>
                    <Choices
                      value={balanceRate}
                      onChange={setBalanceRate}
                      options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                        { value: "unsure", label: "I'm not sure" },
                      ]}
                    />
                    {balanceRate === "yes" ? (
                      <View style={{ gap: 8 }}>
                        <View
                          style={{
                            gap: 4,
                            padding: 12,
                            borderRadius: 10,
                            backgroundColor: P.card,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Manrope",
                              fontWeight: "700",
                              color: P.ink,
                            }}
                          >
                            Add one range for each advertised rate
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Manrope",
                              fontSize: 12,
                              lineHeight: 18,
                              color: P.ink2,
                            }}
                          >
                            Example: from PHP 0 to PHP 99,999 at 3.5%, then from
                            PHP 100,000 to PHP 499,999 at 5%.
                          </Text>
                        </View>
                        {tiers.map((tier, index) => (
                          <View
                            key={index}
                            style={{
                              gap: 6,
                              padding: 10,
                              borderWidth: 1,
                              borderColor: P.line,
                              borderRadius: 10,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: "Manrope",
                                fontWeight: "800",
                                color: P.ink,
                              }}
                            >
                              Balance range {index + 1}
                            </Text>
                            <Field label="FROM (PHP)" required>
                              <TextInput
                                value={String(
                                  tier.minimumBalanceCentavos / 100,
                                )}
                                onChangeText={(value) =>
                                  setTiers((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            minimumBalanceCentavos:
                                              cents(value) ?? 0,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="0"
                                placeholderTextColor={P.muted}
                                keyboardType="decimal-pad"
                                style={inputStyle}
                              />
                            </Field>
                            <Field label="UP TO (PHP)" required>
                              <TextInput
                                value={String(
                                  tier.maximumBalanceCentavos / 100,
                                )}
                                onChangeText={(value) =>
                                  setTiers((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            maximumBalanceCentavos:
                                              cents(value) ?? 0,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="99,999"
                                placeholderTextColor={P.muted}
                                keyboardType="decimal-pad"
                                style={inputStyle}
                              />
                            </Field>
                            <Field label="INTEREST RATE (% PER YEAR)" required>
                              <TextInput
                                value={String(tier.interestRateBps / 100)}
                                onChangeText={(value) =>
                                  setTiers((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            interestRateBps: rate(value) ?? 0,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="3.50"
                                placeholderTextColor={P.muted}
                                keyboardType="decimal-pad"
                                style={inputStyle}
                              />
                            </Field>
                            <Pressable
                              onPress={() =>
                                setTiers((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                            >
                              <Text
                                style={{
                                  color: P.error,
                                  fontFamily: "Manrope",
                                  fontWeight: "700",
                                }}
                              >
                                Remove range
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                        <Pressable
                          onPress={() =>
                            setTiers((current) => [
                              ...current,
                              {
                                minimumBalanceCentavos: 0,
                                maximumBalanceCentavos: 0,
                                interestRateBps: 0,
                              },
                            ])
                          }
                        >
                          <Text
                            style={{
                              color: P.brand,
                              fontFamily: "Manrope",
                              fontWeight: "800",
                            }}
                          >
                            + Add balance range
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                    <Text style={{ fontFamily: "Manrope", color: P.ink2 }}>
                      Does this account have a limited-time interest offer?
                    </Text>
                    <Choices
                      value={promotion}
                      onChange={setPromotion}
                      options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                      ]}
                    />
                    {promotion === "yes" ? (
                      <View style={{ gap: 12 }}>
                        <Field label="PROMOTIONAL INTEREST RATE (%)" required>
                          <TextInput
                            value={promotionRate}
                            onChangeText={setPromotionRate}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={P.muted}
                            style={inputStyle}
                          />
                        </Field>
                        <Field label="START DATE" required>
                          <Pressable
                            onPress={() => setPicker("promo-start")}
                            style={inputStyle}
                          >
                            <Text
                              style={{
                                marginTop: 13,
                                fontFamily: "Manrope",
                                color: promotionStart ? P.ink : P.muted,
                              }}
                            >
                              {promotionStart || "Select date"}
                            </Text>
                          </Pressable>
                        </Field>
                        <Field label="END DATE" required>
                          <Pressable
                            onPress={() => setPicker("promo-end")}
                            style={inputStyle}
                          >
                            <Text
                              style={{
                                marginTop: 13,
                                fontFamily: "Manrope",
                                color: promotionEnd ? P.ink : P.muted,
                              }}
                            >
                              {promotionEnd || "Select date"}
                            </Text>
                          </Pressable>
                        </Field>
                      </View>
                    ) : null}
                  </Section>
                  <Section title="YOUR SAVINGS PLAN" optional>
                    <Text style={{ fontFamily: "Manrope", color: P.ink2 }}>
                      Do you plan to regularly add money?
                    </Text>
                    <Choices
                      value={regularSavings ? "yes" : "no"}
                      onChange={(value) => setRegularSavings(value === "yes")}
                      options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                      ]}
                    />
                    {regularSavings ? (
                      <View style={{ gap: 12 }}>
                        <Field label="AMOUNT YOU PLAN TO SAVE" required>
                          <TextInput
                            value={contribution}
                            onChangeText={setContribution}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={P.muted}
                            style={inputStyle}
                          />
                        </Field>
                        <Field label="HOW OFTEN?" required>
                          <Choices
                            value={contributionFrequency}
                            onChange={setContributionFrequency}
                            options={[
                              { value: "weekly", label: "Every week" },
                              { value: "biweekly", label: "Every 2 weeks" },
                              { value: "monthly", label: "Every month" },
                              { value: "quarterly", label: "Every 3 months" },
                              { value: "custom", label: "Custom" },
                            ]}
                          />
                        </Field>
                        {contributionFrequency === "custom" ? (
                          <Field label="REPEAT EVERY (DAYS)" required>
                            <TextInput
                              value={customDays}
                              onChangeText={setCustomDays}
                              keyboardType="number-pad"
                              placeholder="45"
                              placeholderTextColor={P.muted}
                              style={inputStyle}
                            />
                          </Field>
                        ) : null}
                        <Field label="NEXT DEPOSIT" required>
                          <Pressable
                            onPress={() => setPicker("contribution")}
                            style={inputStyle}
                          >
                            <Text
                              style={{
                                marginTop: 13,
                                fontFamily: "Manrope",
                                color: nextContribution ? P.ink : P.muted,
                              }}
                            >
                              {nextContribution || "Select date"}
                            </Text>
                          </Pressable>
                        </Field>
                      </View>
                    ) : null}
                  </Section>
                  {picker ? (
                    <DateTimePicker
                      value={pickerDate(dateValue)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, date) => {
                        if (event.type === "set" && date)
                          setDate(formatDate(date));
                        if (Platform.OS !== "ios") setPicker(null);
                      }}
                    />
                  ) : null}
                  {error ? (
                    <Text
                      style={{
                        fontFamily: "Manrope",
                        fontSize: 12,
                        color: P.error,
                      }}
                    >
                      {error}
                    </Text>
                  ) : null}
                  <View
                    style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}
                  >
                    <Pressable
                      onPress={onClose}
                      disabled={saving}
                      style={{
                        flex: 1,
                        height: 50,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: P.line,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Manrope",
                          fontWeight: "700",
                          color: P.ink2,
                        }}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={save}
                      disabled={saving}
                      style={{
                        flex: 1,
                        height: 50,
                        borderRadius: 12,
                        backgroundColor: P.brand,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Manrope",
                          fontWeight: "700",
                          color: P.white,
                        }}
                      >
                        {saving
                          ? "Saving..."
                          : editing
                            ? "Save Changes"
                            : "Add Account"}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Pressable>
    </Modal>
  );
}
