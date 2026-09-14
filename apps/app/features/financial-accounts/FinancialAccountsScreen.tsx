import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Bank,
  CreditCard,
  DeviceMobile,
  Money,
  PiggyBank,
  Plus,
  Question,
  Wallet,
} from "phosphor-react-native";
import {
  listFinancialAccounts,
  createFinancialAccount,
  updateFinancialAccount,
  deleteFinancialAccount,
  type FinancialAccount,
  type FinancialAccountKind,
  type CreateFinancialAccountInput,
  type UpdateFinancialAccountInput,
} from "../../local-db/repositories/financialFoundations";
import KebabTooltip from "../../components/KebabTooltip";
import AvailableBalanceCard from "../../components/AvailableBalanceCard";
import { getSavingsAccountDetails, SAVINGS_ACCOUNT_TYPES, type SavingsAccountDetailsInput, type SavingsAccountType, upsertSavingsAccountDetails, validateSavingsAccountDetails } from "../../local-db/repositories/savingsAccountDetails";

const P = {
  shell: "#fcf8f0",
  brand: "#013220",
  brandMedium: "#0E6D46",
  ink: "#1B1C1A",
  ink2: "#414942",
  muted: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  errorSoft: "#FFF0F2",
  card: "#F1F0EB",
  white: "#FFFFFF",
};

const ACCOUNT_KINDS: readonly FinancialAccountKind[] = [
  "cash", "bank", "e_wallet", "savings", "credit_card", "other",
];

const KIND_LABELS: Record<FinancialAccountKind, string> = {
  cash: "Cash", bank: "Bank", e_wallet: "E-Wallet",
  savings: "Savings", credit_card: "Credit Card", other: "Other",
};

function kindIcon(kind: FinancialAccountKind, size: number, color: string) {
  const props = { size, color, weight: "fill" as const };
  switch (kind) {
    case "cash": return <Money {...props} />;
    case "bank": return <Bank {...props} />;
    case "e_wallet": return <DeviceMobile {...props} />;
    case "savings": return <PiggyBank {...props} />;
    case "credit_card": return <CreditCard {...props} />;
    default: return <Question {...props} />;
  }
}

function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const sign = pesos < 0 ? "-" : "";
  const formatted = `${sign}₱${Math.abs(pesos).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return formatted.length > 23 ? formatted.slice(0, 20) + "..." : formatted;
}

function isNegativeAccount(account: FinancialAccount): boolean {
  if (account.kind === "credit_card") {
    return (account.creditCardDetails?.availableCreditCentavos ?? 0) < 0;
  }
  return account.currentBalanceCentavos < 0;
}

function accountDisplayAmount(account: FinancialAccount): number {
  if (account.kind === "credit_card" && account.creditCardDetails) {
    return account.creditCardDetails.availableCreditCentavos ?? account.creditCardDetails.creditLimitCentavos;
  }
  return account.currentBalanceCentavos;
}

function parseSafeCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 15) return null;
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

function parseDayOfMonth(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const day = parseInt(trimmed, 10);
  return day >= 1 && day <= 31 ? day : null;
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function toPickerDate(value: string | null): Date {
  const [year = 0, month = 0, day = 0] = (value ?? "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

type Props = {
  userId: string;
  deviceId: string;
  onBack: () => void;
  onSyncRequested?: () => void;
};

export default function FinancialAccountsScreen({ userId, deviceId, onBack, onSyncRequested }: Props) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);

  const loadAccounts = useCallback(async () => {
    const result = await listFinancialAccounts(userId);
    setAccounts(result);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const totalCash = accounts
    .filter((a) => a.status === "active" && a.includeInDashboardBalance)
    .reduce((sum, a) => sum + a.currentBalanceCentavos, 0);

  const everydayAccounts = accounts.filter((account) => account.kind !== "credit_card" && account.kind !== "savings");
  const savingsAccounts = accounts.filter((account) => account.kind === "savings");
  const creditCardAccounts = accounts.filter((account) => account.kind === "credit_card");

  const handleCreate = async (input: CreateFinancialAccountInput, savingsDetails: SavingsAccountDetailsInput | null) => {
    if (savingsDetails) validateSavingsAccountDetails(savingsDetails);
    const { account } = await createFinancialAccount(userId, deviceId, input);
    if (savingsDetails) await upsertSavingsAccountDetails(userId, deviceId, account.id, savingsDetails);
    setSheetVisible(false); await loadAccounts();
    onSyncRequested?.();
  };

  const handleUpdate = async (input: CreateFinancialAccountInput, savingsDetails: SavingsAccountDetailsInput | null) => {
    if (!editingAccount) return;
    if (savingsDetails) validateSavingsAccountDetails(savingsDetails);
    const balanceChange = input.openingBalanceCentavos ?? 0;
    await updateFinancialAccount(userId, deviceId, editingAccount.id, {
      ...input,
      currentBalanceCentavos:
        editingAccount.currentBalanceCentavos -
        editingAccount.openingBalanceCentavos +
        balanceChange,
    } satisfies UpdateFinancialAccountInput);
    if (savingsDetails) await upsertSavingsAccountDetails(userId, deviceId, editingAccount.id, savingsDetails);
    setSheetVisible(false); setEditingAccount(null);
    await loadAccounts();
    onSyncRequested?.();
  };

  const handleDelete = (account: FinancialAccount) => {
    Alert.alert(`Delete ${account.name}?`, "This account will be removed from active accounts. Its transaction history will be preserved.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteFinancialAccount(userId, deviceId, account.id); await loadAccounts(); onSyncRequested?.(); } },
    ]);
  };

  const renderAccount = (account: FinancialAccount) => {
    const negative = isNegativeAccount(account);
    return (
      <AccountTile
        key={account.id}
        account={account}
        negative={negative}
        tileBg={negative ? P.errorSoft : P.card}
        amountColor={negative ? P.error : P.ink}
        iconColor={negative ? P.error : P.brandMedium}
        onEdit={() => { setEditingAccount(account); setSheetVisible(true); }}
        onDelete={() => handleDelete(account)}
      />
    );
  };

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={{ fontSize: 20, fontFamily: "Manrope", fontWeight: "800", color: P.ink }}>Accounts</Text>
        <TouchableOpacity
          onPress={() => { setEditingAccount(null); setSheetVisible(true); }}
          testID="add-account"
          accessibilityLabel="Add account"
          hitSlop={8}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: P.brand, alignItems: "center", justifyContent: "center" }}
        >
          <Plus size={18} color={P.white} weight="bold" />
        </TouchableOpacity>
      </View>
      <AvailableBalanceCard
        label="Total cash position"
        amount={formatPeso(totalCash).replace("₱", "")}
        detail={`Across ${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}
        marginBottom={14}
      />
      {loading ? null : accounts.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <Wallet size={40} color={P.muted} />
          <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Manrope", color: P.muted }}>No accounts yet</Text>
          <Text style={{ marginTop: 4, fontSize: 13, fontFamily: "Manrope", color: P.muted }}>Tap + to add your first account</Text>
        </View>
      ) : (
        <>
          {everydayAccounts.length > 0 ? (
            <AccountGroup title="Accounts">
              {everydayAccounts.map(renderAccount)}
            </AccountGroup>
          ) : null}
          {savingsAccounts.length > 0 ? (
            <AccountGroup title="Savings Accounts">
              {savingsAccounts.map(renderAccount)}
            </AccountGroup>
          ) : null}
          {creditCardAccounts.length > 0 ? (
            <AccountGroup title="Credit Cards">
              {creditCardAccounts.map(renderAccount)}
            </AccountGroup>
          ) : null}
        </>
      )}
      <AccountFormSheet userId={userId} visible={sheetVisible} editing={editingAccount} onClose={() => { setSheetVisible(false); setEditingAccount(null); }} onSubmit={editingAccount ? handleUpdate : handleCreate} />
    </>
  );
}

function AccountGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "800", color: P.ink, marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function AccountTile({ account, negative, tileBg, amountColor, iconColor, onEdit, onDelete }: { account: FinancialAccount; negative: boolean; tileBg: string; amountColor: string; iconColor: string; onEdit: () => void; onDelete: () => void }) {
  const creditCardDetails = account.kind === "credit_card" ? account.creditCardDetails : null;
  const amount = accountDisplayAmount(account);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: negative ? "#FFF1F3" : P.shell, borderRadius: 15, marginBottom: 9, padding: 13, borderWidth: 1, borderColor: negative ? "#FFB9C2" : P.line }}>
      <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: negative ? "#FFF9F0" : tileBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        {kindIcon(account.kind, 22, iconColor)}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>{account.name}</Text>
        <Text style={{ fontSize: 10.5, fontFamily: "Manrope", fontWeight: "500", color: negative ? P.error : P.muted, marginTop: 2 }}>
          {negative ? "Over available credit" : creditCardDetails?.availableCreditCentavos != null ? "Available credit" : account.savingsAccountType === "personal_savings" ? "Personal Savings" : account.savingsAccountType === "high_yield_savings" ? "HYSA" : account.savingsAccountType === "time_deposit" ? "Time Deposit" : KIND_LABELS[account.kind] ?? account.kind}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", marginRight: 2 }}>
        <Text style={{ fontSize: 14, fontFamily: "Manrope", fontWeight: "800", color: amountColor }}>{formatPeso(amount)}</Text>
        <Text style={{ fontSize: 9.5, fontFamily: "Manrope", fontWeight: "500", color: negative ? P.error : P.muted, marginTop: 1 }}>PHP</Text>
      </View>
      <KebabTooltip
        kebabDirection="horizontal"
        tooltipLocation="bottomRight"
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </View>
  );
}

type FieldErrors = Partial<Record<"name" | "openingBalance" | "creditLimit" | "billingCycle" | "cutoffDay" | "threshold", string>>;

function FormField({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
        {label} {required ? <Text style={{ color: P.error }}>*</Text> : null}
      </Text>
      {hint ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginBottom: 6 }}>{hint}</Text> : null}
      {children}
      {error ? (
        <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.error, marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}

function DateField({ placeholder, value, error, onPress }: { placeholder: string; value: string | null; error?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: error ? P.error : P.line, paddingHorizontal: 14, justifyContent: "center", backgroundColor: P.card }}
    >
      <Text style={{ fontFamily: "Manrope", fontSize: 14, color: value ? P.ink : P.muted }}>{value ?? placeholder}</Text>
    </Pressable>
  );
}

function AccountFormSheet({ userId, visible, editing, onClose, onSubmit }: { userId: string; visible: boolean; editing: FinancialAccount | null; onClose: () => void; onSubmit: (input: CreateFinancialAccountInput, savingsDetails: SavingsAccountDetailsInput | null) => Promise<void> }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FinancialAccountKind>("bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [billingCycle, setBillingCycle] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [threshold, setThreshold] = useState("");
  const [savingsType, setSavingsType] = useState<SavingsAccountType>("personal_savings");
  const [interestRate, setInterestRate] = useState("");
  const [minimumBalance, setMinimumBalance] = useState("");
  const [baseInterestRate, setBaseInterestRate] = useState("");
  const [effectiveInterestRate, setEffectiveInterestRate] = useState("");
  const [interestConditions, setInterestConditions] = useState("");
  const [higherRateEligible, setHigherRateEligible] = useState<boolean | null>(null);
  const [principal, setPrincipal] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [earlyWithdrawalRule, setEarlyWithdrawalRule] = useState("");
  const [datePicker, setDatePicker] = useState<"opening" | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const isEdit = editing !== null;

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setOpeningBalance(String(editing.openingBalanceCentavos / 100));
      setInstitutionName(editing.institutionName ?? "");
      setOpenedOn(editing.openedOn);
      const cc = editing.creditCardDetails;
      setCreditLimit(cc ? String(cc.creditLimitCentavos / 100) : "");
      setBillingCycle(cc && cc.billingCycleDays != null ? String(cc.billingCycleDays) : "");
      setCutoffDay(cc ? String(cc.cutoffDay) : "");
      setThreshold(cc && cc.alertThresholdPercent != null ? String(cc.alertThresholdPercent) : "");
      if (editing.kind === "savings") {
        getSavingsAccountDetails(userId, editing.id).then((details) => {
          if (!details) return;
          setSavingsType(details.accountType); setInterestRate(details.interestRateBps == null ? "" : String(details.interestRateBps / 100));
          setMinimumBalance(details.minimumBalanceCentavos == null ? "" : String(details.minimumBalanceCentavos / 100));
          setBaseInterestRate(details.baseInterestRateBps == null ? "" : String(details.baseInterestRateBps / 100));
          setEffectiveInterestRate(details.effectiveInterestRateBps == null ? "" : String(details.effectiveInterestRateBps / 100));
          setInterestConditions(details.interestConditions ?? ""); setHigherRateEligible(details.higherRateEligible); setPrincipal(details.principalCentavos == null ? "" : String(details.principalCentavos / 100));
          setMaturityDate(details.maturityDate ?? ""); setTermMonths(details.termMonths == null ? "" : String(details.termMonths)); setEarlyWithdrawalRule(details.earlyWithdrawalRule ?? "");
        }).catch(() => setFormError("Savings account details could not be loaded."));
      }
    } else {
      setName(""); setKind("bank"); setOpeningBalance(""); setInstitutionName("");
      setOpenedOn(null);
      setCreditLimit(""); setBillingCycle(""); setCutoffDay(""); setThreshold("");
      setSavingsType("personal_savings"); setInterestRate(""); setMinimumBalance(""); setBaseInterestRate(""); setEffectiveInterestRate(""); setInterestConditions(""); setHigherRateEligible(null); setPrincipal(""); setMaturityDate(""); setTermMonths(""); setEarlyWithdrawalRule("");
    }
    setDatePicker(null);
    setFieldErrors({});
    setFormError(null);
  }, [editing]);

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applyDate = (which: "opening", date: Date) => {
    if (which === "opening") setOpenedOn(formatDate(date));
  };

  const closeSheet = () => {
    setDatePicker(null);
    onClose();
  };

  const handleSubmit = async () => {
    setFormError(null);
    const nextErrors: FieldErrors = {};

    const openingCents = parseSafeCents(openingBalance);
    if (!name.trim()) nextErrors.name = "Account name is required.";
    if (openingBalance.trim() && openingCents === null) nextErrors.openingBalance = kind === "credit_card" ? "Outstanding balance must be a valid amount." : "Opening balance must be a valid amount.";

    let limitCents: number | null = null;
    let cycleDays: number | null = null;
    let thresholdValue: number | null = null;
    let cutoffDayValue: number | null = null;

    if (kind === "credit_card") {
      if (!creditLimit.trim()) {
        nextErrors.creditLimit = "Credit limit is required.";
      } else {
        limitCents = parseSafeCents(creditLimit);
        if (limitCents === null) nextErrors.creditLimit = "Credit limit must be a valid amount.";
        else if (limitCents <= 0) nextErrors.creditLimit = "Credit limit must be greater than 0.";
      }

      if (!billingCycle.trim()) {
        nextErrors.billingCycle = "Billing cycle is required.";
      } else if (!/^\d+$/.test(billingCycle.trim())) {
        nextErrors.billingCycle = "Billing cycle must be between 28 and 31 days.";
      } else {
        cycleDays = parseInt(billingCycle.trim(), 10);
        if (cycleDays < 28 || cycleDays > 31) nextErrors.billingCycle = "Billing cycle must be between 28 and 31 days.";
      }

      cutoffDayValue = parseDayOfMonth(cutoffDay);
      if (!cutoffDay.trim()) nextErrors.cutoffDay = "Enter a valid cut-off day.";
      else if (cutoffDayValue === null) nextErrors.cutoffDay = "Enter a valid cut-off day.";

      if (!threshold.trim()) {
        nextErrors.threshold = "Alert threshold is required.";
      } else if (!/^\d+$/.test(threshold.trim())) {
        nextErrors.threshold = "Alert threshold must be between 0 and 100.";
      } else {
        thresholdValue = parseInt(threshold.trim(), 10);
        if (thresholdValue < 0 || thresholdValue > 100) nextErrors.threshold = "Alert threshold must be between 0 and 100.";
      }
    }

    const asRateBps = (value: string) => value.trim() ? Math.round(Number(value) * 100) : null;
    const asCentavos = (value: string) => value.trim() ? parseSafeCents(value) : null;
    let savingsDetails: SavingsAccountDetailsInput | null = null;
    if (kind === "savings") {
      const interestRateBps = asRateBps(interestRate); const minimumBalanceCentavos = asCentavos(minimumBalance);
      const baseInterestRateBps = asRateBps(baseInterestRate); const effectiveInterestRateBps = asRateBps(effectiveInterestRate);
      const principalCentavos = asCentavos(principal); const parsedTermMonths = termMonths.trim() ? Number(termMonths) : null;
      savingsDetails = { accountType: savingsType, interestRateBps, minimumBalanceCentavos, baseInterestRateBps, effectiveInterestRateBps, interestConditions: interestConditions.trim() || null, higherRateEligible, principalCentavos, maturityDate: maturityDate.trim() || null, termMonths: parsedTermMonths, earlyWithdrawalRule: earlyWithdrawalRule.trim() || null };
      if ([interestRateBps, minimumBalanceCentavos, baseInterestRateBps, effectiveInterestRateBps, principalCentavos].some((value) => value !== null && (!Number.isSafeInteger(value) || value < 0))) setFormError("Savings amounts and rates must be valid non-negative values.");
    }

    if (Object.keys(nextErrors).length > 0 || (kind === "savings" && !savingsDetails)) { setFieldErrors(nextErrors); return; }

    setSaving(true);
    try {
      const input: CreateFinancialAccountInput = {
        name: name.trim(),
        kind,
        openingBalanceCentavos: openingCents ?? 0,
        institutionName: institutionName.trim() || null,
        openedOn: openedOn ?? null,
      };
      if (kind === "credit_card") {
        input.creditCardDetails = {
          creditLimitCentavos: limitCents!,
          billingCycleDays: cycleDays!,
          cutoffDay: cutoffDayValue!,
          alertThresholdPercent: thresholdValue!,
        };
      }
      await onSubmit(input, savingsDetails);
    } catch (err) { setFormError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <Pressable onPress={closeSheet} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.85 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.line, alignSelf: "center", marginTop: 10 }} />
                <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled" bounces={false}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
                    {isEdit ? "Edit Account" : "Add Account"}
                  </Text>

                  <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>
                    Fields marked with (*) are required
                  </Text>

                  <FormField label="ACCOUNT NAME" required error={fieldErrors.name}>
                    <TextInput
                      value={name}
                      onChangeText={(t) => { setName(t); clearFieldError("name"); }}
                      placeholder="Enter account name"
                      placeholderTextColor={P.muted}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: fieldErrors.name ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </FormField>

                  <FormField label="ACCOUNT TYPE" required>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {ACCOUNT_KINDS.map((k) => (
                        <Pressable
                          key={k}
                          onPress={() => setKind(k)}
                          accessibilityRole="radio"
                          accessibilityLabel={KIND_LABELS[k]}
                          accessibilityState={{ checked: kind === k }}
                          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: kind === k ? P.brand : P.card, gap: 6 }}
                        >
                          {kindIcon(k, 16, kind === k ? P.white : P.ink2)}
                          <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: kind === k ? P.white : P.ink2 }}>{KIND_LABELS[k]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </FormField>

                  {kind === "savings" ? (
                    <>
                      <FormField label="SAVINGS ACCOUNT TYPE" required>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {SAVINGS_ACCOUNT_TYPES.map((type) => (
                            <Pressable key={type} onPress={() => setSavingsType(type)} accessibilityRole="radio" accessibilityLabel={`Select ${type.replaceAll("_", " ")}`} accessibilityState={{ checked: savingsType === type }} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: savingsType === type ? P.brand : P.card }}>
                              <Text style={{ fontSize: 12, fontFamily: "Manrope", fontWeight: "600", color: savingsType === type ? P.white : P.ink2 }}>{type === "personal_savings" ? "Personal Savings" : type === "high_yield_savings" ? "HYSA" : "Time Deposit"}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </FormField>

                      {(savingsType === "personal_savings" || savingsType === "time_deposit") ? <FormField label="INTEREST RATE (%)" required><TextInput value={interestRate} onChangeText={setInterestRate} placeholder="Enter interest rate" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField> : null}
                      {savingsType === "personal_savings" ? <FormField label="MINIMUM BALANCE (₱)" required><TextInput value={minimumBalance} onChangeText={setMinimumBalance} placeholder="Enter minimum balance" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField> : null}
                      {savingsType === "high_yield_savings" ? <><FormField label="BASE INTEREST RATE (%)" required><TextInput value={baseInterestRate} onChangeText={setBaseInterestRate} placeholder="Enter base interest rate" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField><FormField label="EFFECTIVE INTEREST RATE (%)" required><TextInput value={effectiveInterestRate} onChangeText={setEffectiveInterestRate} placeholder="Enter effective interest rate" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField><FormField label="REQUIREMENTS TO EARN THIS RATE" hint="These bank rules are saved for reference only." required><TextInput value={interestConditions} onChangeText={setInterestConditions} placeholder="Describe the bank's requirements" placeholderTextColor={P.muted} multiline style={{ minHeight: 70, borderRadius: 12, borderWidth: 1, borderColor: P.line, padding: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField><FormField label="ARE THE REQUIREMENTS CURRENTLY MET?" required><View style={{ flexDirection: "row", gap: 8 }}>{[true, false].map((value) => <Pressable key={String(value)} onPress={() => setHigherRateEligible(value)} accessibilityRole="radio" accessibilityLabel={value ? "Requirements met" : "Requirements not met"} accessibilityState={{ checked: higherRateEligible === value }} style={{ flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: higherRateEligible === value ? P.brand : P.card }}><Text style={{ fontFamily: "Manrope", fontWeight: "600", color: higherRateEligible === value ? P.white : P.ink2 }}>{value ? "Yes" : "No"}</Text></Pressable>)}</View></FormField></> : null}
                      {savingsType === "time_deposit" ? <><FormField label="PRINCIPAL (₱)" required><TextInput value={principal} onChangeText={setPrincipal} placeholder="Enter principal amount" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField><FormField label="MATURITY DATE" required><TextInput value={maturityDate} onChangeText={setMaturityDate} placeholder="YYYY-MM-DD" placeholderTextColor={P.muted} style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField><FormField label="TERM (MONTHS)" required><TextInput value={termMonths} onChangeText={setTermMonths} placeholder="Enter deposit term" placeholderTextColor={P.muted} keyboardType="number-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField><FormField label="EARLY-WITHDRAWAL RULE" required><TextInput value={earlyWithdrawalRule} onChangeText={setEarlyWithdrawalRule} placeholder="Describe early-withdrawal rule" placeholderTextColor={P.muted} multiline style={{ minHeight: 70, borderRadius: 12, borderWidth: 1, borderColor: P.line, padding: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }} /></FormField></> : null}
                    </>
                  ) : null}

                  <FormField label={kind === "credit_card" ? "OUTSTANDING BALANCE (₱) (OPTIONAL)" : "OPENING BALANCE (₱)"} error={fieldErrors.openingBalance}>
                    <TextInput
                      value={openingBalance}
                      onChangeText={(t) => { setOpeningBalance(t); clearFieldError("openingBalance"); }}
                      placeholder={kind === "credit_card" ? "Enter outstanding balance" : "Enter opening balance"}
                      placeholderTextColor={P.muted}
                      keyboardType="decimal-pad"
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: fieldErrors.openingBalance ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </FormField>

                  <FormField label="INSTITUTION (OPTIONAL)">
                    <TextInput
                      value={institutionName}
                      onChangeText={setInstitutionName}
                      placeholder="Enter institution name"
                      placeholderTextColor={P.muted}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </FormField>

                  <FormField label="OPENING DATE (OPTIONAL)">
                    <DateField placeholder="Select opening date" value={openedOn} onPress={() => setDatePicker("opening")} />
                  </FormField>

                  {kind === "credit_card" ? (
                    <>
                      <FormField label="CREDIT LIMIT (₱)" required error={fieldErrors.creditLimit}>
                        <TextInput
                          value={creditLimit}
                          onChangeText={(t) => { setCreditLimit(t); clearFieldError("creditLimit"); }}
                          placeholder="Enter credit limit"
                          placeholderTextColor={P.muted}
                          keyboardType="decimal-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: fieldErrors.creditLimit ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </FormField>

                      <FormField label="BILLING CYCLE (DAYS)" required error={fieldErrors.billingCycle}>
                        <TextInput
                          value={billingCycle}
                          onChangeText={(t) => { setBillingCycle(t); clearFieldError("billingCycle"); }}
                          placeholder="Enter billing cycle in days"
                          placeholderTextColor={P.muted}
                          keyboardType="number-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: fieldErrors.billingCycle ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </FormField>

                      <FormField
                        label="CUT-OFF DAY OF MONTH"
                        hint="When your billing cycle ends each month. Enter 1-31; check your card statement."
                        required
                        error={fieldErrors.cutoffDay}
                      >
                        <TextInput
                          value={cutoffDay}
                          onChangeText={(t) => { setCutoffDay(t); clearFieldError("cutoffDay"); }}
                          placeholder="Enter default cut-off day"
                          placeholderTextColor={P.muted}
                          keyboardType="number-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: fieldErrors.cutoffDay ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </FormField>

                      <FormField label="ALERT THRESHOLD (%)" required error={fieldErrors.threshold}>
                        <TextInput
                          value={threshold}
                          onChangeText={(t) => { setThreshold(t); clearFieldError("threshold"); }}
                          placeholder="Enter alert percentage"
                          placeholderTextColor={P.muted}
                          keyboardType="number-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: fieldErrors.threshold ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </FormField>
                    </>
                  ) : null}

                  {datePicker ? (
                    <DateTimePicker
                      value={toPickerDate(openedOn)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, date) => {
                        if (event.type === "set" && date) applyDate(datePicker, date);
                        if (Platform.OS !== "ios") setDatePicker(null);
                      }}
                    />
                  ) : null}

                  {formError && (
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.error }}>{formError}</Text>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
                    <Pressable onPress={closeSheet} disabled={saving} accessibilityRole="button" style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: P.line, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink2 }}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleSubmit} disabled={saving} accessibilityRole="button" style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.white }}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Add Account"}</Text>
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
