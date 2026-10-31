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
  CaretRight,
  CreditCard,
  DeviceMobile,
  Money,
  PiggyBank,
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
} from "../../local-db/repositories/foundations/financialFoundations";
import { AmountHero, Switch } from "../../components/BudgieForm";
import { getSavingsAccountDetails, type SavingsAccountDetailsInput, upsertSavingsAccountDetails, validateSavingsAccountDetails } from "../../local-db/repositories/savings/savingsAccountDetails";
import SavingsGoalForm from "../savings-goals/components/SavingsGoalForm";
import SavingsGoalInvitation from "./SavingsGoalInvitation";
import { buildSavingsInterestDetails } from "./helpers/savingsAccountInterest";
import SavingsInterestFields from "./SavingsInterestFields";
import type { SavingsInterestReference } from "@odin/savings-interest";
import { BottomSheetSurface } from "../../components/BottomSheetSurface";
import { ActionSheet } from "../../components/ActionSheet";
import { formatMoney } from "../../lib/format/money";

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
  "cash", "bank", "e_wallet", "credit_card", "other",
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
  return formatMoney(centavos, { prefix: "₱", signBeforePrefix: true, truncateAfter: 23 });
}

function formatAccountAmount(centavos: number): string {
  return formatPeso(centavos).replace("-₱", "-PHP ").replace("₱", "PHP ");
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
  const [newSavingsAccountId, setNewSavingsAccountId] = useState<string | null>(null);
  const [goalAccountId, setGoalAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountActionsTarget, setAccountActionsTarget] = useState<FinancialAccount | null>(null);

  const loadAccounts = useCallback(async () => {
    const result = await listFinancialAccounts(userId);
    setAccounts(result);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const totalCash = accounts
    .filter((a) => a.status === "active" && a.includeInDashboardBalance)
    .reduce((sum, a) => sum + a.currentBalanceCentavos, 0);

  const handleCreate = async (input: CreateFinancialAccountInput, savingsDetails: SavingsAccountDetailsInput | null) => {
    if (savingsDetails) validateSavingsAccountDetails(savingsDetails);
    const { account } = await createFinancialAccount(userId, deviceId, input);
    if (savingsDetails) await upsertSavingsAccountDetails(userId, deviceId, account.id, savingsDetails);
    setSheetVisible(false); await loadAccounts();
    onSyncRequested?.();
    if (input.kind === "savings") setNewSavingsAccountId(account.id);
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

  const renderAccount = (account: FinancialAccount, index: number) => {
    const negative = isNegativeAccount(account);
    return (
      <AccountTile
        key={account.id}
        account={account}
        negative={negative}
        amountColor={negative ? P.error : P.ink}
        isLast={index === accounts.length - 1}
        onPress={() => setAccountActionsTarget(account)}
      />
    );
  };

  if (goalAccountId) return <SavingsGoalForm userId={userId} deviceId={deviceId} initialLinkedAccountId={goalAccountId} onCancel={() => setGoalAccountId(null)} onSaved={() => { setGoalAccountId(null); onSyncRequested?.(); }} />;

  return (
    <>
      <View style={{ marginBottom: 14 }}>
        <AmountHero
          label="TOTAL CASH POSITION"
          amountCentavos={totalCash}
          detail={`Across ${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}
        />
      </View>
      {loading ? null : accounts.length === 0 ? (
        <View style={{ alignItems: "center", paddingHorizontal: 18, paddingTop: 22 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#959592", alignItems: "center", justifyContent: "center" }}>
            <Wallet size={30} color={P.ink2} />
          </View>
          <Text style={{ marginTop: 14, fontSize: 15, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>No accounts yet</Text>
          <Text style={{ marginTop: 4, fontSize: 12, fontFamily: "Manrope", lineHeight: 18, color: P.ink2, textAlign: "center" }}>Add an account to see your cash position.</Text>
          <TouchableOpacity
            onPress={() => { setEditingAccount(null); setSheetVisible(true); }}
            testID="add-account"
            accessibilityLabel="Add account"
            style={{ width: "100%", minHeight: 50, marginTop: 14, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: P.brand }}
          >
            <Text style={{ fontSize: 14, fontFamily: "Manrope", fontWeight: "800", color: P.white }}>Add an account</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 15, fontFamily: "Manrope", fontWeight: "800", color: P.ink }}>Accounts</Text>
            <TouchableOpacity
              onPress={() => { setEditingAccount(null); setSheetVisible(true); }}
              testID="add-account"
              accessibilityLabel="Add account"
              hitSlop={8}
              style={{ paddingVertical: 4, paddingLeft: 12 }}
            >
              <Text style={{ fontSize: 11.5, fontFamily: "Manrope", fontWeight: "700", color: P.brand }}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={{ borderWidth: 1, borderColor: "#959592", borderRadius: 16, overflow: "hidden", backgroundColor: P.white }}>
            {accounts.map(renderAccount)}
          </View>
        </>
      )}
      <AccountActionsSheet
        account={accountActionsTarget}
        onClose={() => setAccountActionsTarget(null)}
        onEdit={() => {
          if (!accountActionsTarget) return;
          setEditingAccount(accountActionsTarget);
          setAccountActionsTarget(null);
          setSheetVisible(true);
        }}
        onDelete={() => {
          if (!accountActionsTarget) return;
          const account = accountActionsTarget;
          setAccountActionsTarget(null);
          handleDelete(account);
        }}
      />
      {newSavingsAccountId ? <SavingsGoalInvitation onAddGoal={() => { setGoalAccountId(newSavingsAccountId); setNewSavingsAccountId(null); }} onDismiss={() => setNewSavingsAccountId(null)} /> : null}
      <AccountFormSheet userId={userId} visible={sheetVisible} editing={editingAccount} onClose={() => { setSheetVisible(false); setEditingAccount(null); }} onSubmit={editingAccount ? handleUpdate : handleCreate} />
    </>
  );
}

function accountIconPalette(account: FinancialAccount, negative: boolean) {
  if (negative) return { backgroundColor: "#FBE5E8", color: P.error };
  if (account.kind === "savings") return { backgroundColor: "#E3F2EA", color: "#068751" };
  if (account.kind === "e_wallet") return { backgroundColor: "#E2F0EA", color: "#0B8753" };
  if (account.kind === "bank") return { backgroundColor: "#EAEAE7", color: P.ink2 };
  return { backgroundColor: "#E4EDE8", color: P.brand };
}

function AccountTile({ account, negative, amountColor, isLast, onPress }: { account: FinancialAccount; negative: boolean; amountColor: string; isLast: boolean; onPress: () => void }) {
  const creditCardDetails = account.kind === "credit_card" ? account.creditCardDetails : null;
  const amount = accountDisplayAmount(account);
  const iconPalette = accountIconPalette(account, negative);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${account.name} account actions`} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: "#E0DED6", backgroundColor: P.white }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: iconPalette.backgroundColor, alignItems: "center", justifyContent: "center", marginRight: 11 }}>
        {kindIcon(account.kind, 17, iconPalette.color)}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: P.ink }}>{account.name}</Text>
        <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: "Manrope", color: P.muted, marginTop: 1 }}>
          {negative ? "Negative balance" : creditCardDetails?.availableCreditCentavos != null ? "Available credit" : KIND_LABELS[account.kind] ?? account.kind}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
        <Text style={{ fontSize: 12.5, fontFamily: "Manrope", fontWeight: "700", fontVariant: ["tabular-nums"], color: amountColor }}>{formatAccountAmount(amount)}</Text>
      </View>
      <CaretRight size={15} color={P.muted} style={{ marginLeft: 10 }} />
    </Pressable>
  );
}

function AccountActionsSheet({ account, onClose, onEdit, onDelete }: { account: FinancialAccount | null; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <ActionSheet visible={account !== null} onClose={onClose} backdropColor="rgba(27,28,26,0.28)">
        <BottomSheetSurface bottomSpacing={20} style={{ padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: P.white }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18, backgroundColor: P.line }} />
          <Text numberOfLines={1} style={{ marginBottom: 16, fontFamily: "Manrope", fontSize: 17, fontWeight: "800", color: P.ink }}>{account?.name}</Text>
          <AccountAction label="Edit" onPress={onEdit} />
          <AccountAction label="Delete" destructive onPress={onDelete} />
          <AccountAction label="Cancel" onPress={onClose} />
        </BottomSheetSurface>
    </ActionSheet>
  );
}

function AccountAction({ label, destructive = false, onPress }: { label: string; destructive?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minHeight: 50, alignItems: "center", justifyContent: "center", marginBottom: 9, borderRadius: 13, borderWidth: 1, borderColor: destructive ? "#FFB9C2" : P.line, backgroundColor: destructive ? P.errorSoft : P.card }}>
      <Text style={{ fontFamily: "Manrope", fontSize: 14, fontWeight: "800", color: destructive ? P.error : P.ink }}>{label}</Text>
    </Pressable>
  );
}

type FieldErrors = Partial<Record<"name" | "openingBalance" | "creditLimit" | "cutoffDay" | "threshold", string>>;

function InfoButton({ label, text }: { label: string; text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`More information about ${label}`} onPress={() => setVisible(true)} hitSlop={8} style={{ marginLeft: 6 }}>
        <Question size={16} color={P.brand} weight="bold" />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable onPress={() => setVisible(false)} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" }}>
          <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 360, borderRadius: 16, padding: 20, backgroundColor: P.white }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>{label}</Text>
            <Text style={{ marginTop: 10, fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.ink2 }}>{text}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function FormField({ label, required, error, hint, info, children }: { label: string; required?: boolean; error?: string; hint?: string; info?: string; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, flexShrink: 1 }}>
          {label} {required ? <Text style={{ color: P.error }}>*</Text> : null}
        </Text>
        {info ? <InfoButton label={label} text={info} /> : null}
      </View>
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
  const [cutoffDay, setCutoffDay] = useState("");
  const [threshold, setThreshold] = useState("");
  const [allowsExtraPayments, setAllowsExtraPayments] = useState(false);
  const [interestRate, setInterestRate] = useState("");
  const [interestReference, setInterestReference] = useState<SavingsInterestReference | null>(null);
  const [savedSavingsDetails, setSavedSavingsDetails] = useState<SavingsAccountDetailsInput | null>(null);
  const [savingsDetailsReady, setSavingsDetailsReady] = useState(true);
  const [datePicker, setDatePicker] = useState<"opening" | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const isEdit = editing !== null;

  useEffect(() => {
    let cancelled = false;
    setSavedSavingsDetails(null);
    setSavingsDetailsReady(editing?.kind !== "savings");
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setOpeningBalance(String(editing.openingBalanceCentavos / 100));
      setInstitutionName(editing.institutionName ?? "");
      setOpenedOn(editing.openedOn);
      const cc = editing.creditCardDetails;
      setCreditLimit(cc ? String(cc.creditLimitCentavos / 100) : "");
      setCutoffDay(cc ? String(cc.cutoffDay) : "");
      setThreshold(cc && cc.alertThresholdPercent != null ? String(cc.alertThresholdPercent) : "");
      setAllowsExtraPayments(cc?.allowsExtraPayments ?? false);
      if (editing.kind === "savings") {
        getSavingsAccountDetails(userId, editing.id).then((details) => {
          if (cancelled) return;
          setSavedSavingsDetails(details);
          setSavingsDetailsReady(true);
          if (!details) return;
          const rate = details.accountType === "high_yield_savings" ? details.baseInterestRateBps : details.interestRateBps;
          setInterestRate(rate == null ? "" : String(rate / 100));
          setInterestReference(details.interestReference ?? null);
        }).catch(() => { if (!cancelled) setFormError("Savings account details could not be loaded. Close and reopen the form to try again."); });
      }
    } else {
      setName(""); setKind("bank"); setOpeningBalance(""); setInstitutionName("");
      setOpenedOn(null);
      setCreditLimit(""); setCutoffDay(""); setThreshold(""); setAllowsExtraPayments(false);
      setInterestRate(""); setInterestReference(null);
    }
    setDatePicker(null);
    setFieldErrors({});
    setFormError(null);
    return () => { cancelled = true; };
  }, [editing, userId]);

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };


  const closeSheet = () => {
    setDatePicker(null);
    onClose();
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (editing?.kind === "savings" && !savingsDetailsReady) { setFormError("Wait for savings account details to load, or close and reopen the form to try again."); return; }
    const nextErrors: FieldErrors = {};

    const openingCents = parseSafeCents(openingBalance);
    if (!name.trim()) nextErrors.name = "Account name is required.";
    if (openingBalance.trim() && openingCents === null) nextErrors.openingBalance = kind === "credit_card" ? "Outstanding balance must be a valid amount." : "Opening balance must be a valid amount.";

    let limitCents: number | null = null;
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

    let savingsDetails: SavingsAccountDetailsInput | null = null;
    if (kind === "savings") {
      try {
        savingsDetails = buildSavingsInterestDetails(savedSavingsDetails, interestRate, interestReference);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Check the interest details.");
        return;
      }
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
          cutoffDay: cutoffDayValue!,
          alertThresholdPercent: thresholdValue!,
          allowsExtraPayments,
        };
      }
      await onSubmit(input, savingsDetails);
    } catch (err) { setFormError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSaving(false); }
  };

  return (
    <ActionSheet visible={visible} onClose={closeSheet} backdropColor="rgba(0,0,0,0.45)">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <Pressable onPress={() => {}}>
              <BottomSheetSurface style={{ backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.85 }}>
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
                    {editing?.kind === "savings" ? <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.ink2 }}>Savings (existing account)</Text> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                    </View>}
                  </FormField>

                  {kind === "savings" ? (
                    <SavingsInterestFields persistedReference={savedSavingsDetails?.interestReference} rate={interestRate} onRateChange={setInterestRate} reference={interestReference} onReferenceChange={setInterestReference} />
                  ) : null}

                  <FormField label={kind === "credit_card" ? "OUTSTANDING BALANCE (₱) (OPTIONAL)" : "OPENING BALANCE (₱)"} required={kind !== "credit_card"} error={fieldErrors.openingBalance}>
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

                      <FormField
                        label="BILLING CYCLE END DAY"
                        hint="Your bank may call this the cut-off date. Enter the day your billing cycle ends each month (1-31)."
                        required
                        error={fieldErrors.cutoffDay}
                      >
                        <TextInput
                          value={cutoffDay}
                          onChangeText={(t) => { setCutoffDay(t); clearFieldError("cutoffDay"); }}
                          placeholder="Enter billing cycle end day"
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

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2 }}>ALLOW EXTRA PAYMENTS</Text>
                          <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Put spare money toward this card when you have it.</Text>
                        </View>
                        <Switch accessibilityLabel="Allow extra payments" value={allowsExtraPayments} onToggle={() => setAllowsExtraPayments((value) => !value)} />
                      </View>
                    </>
                  ) : null}

                  {datePicker ? (
                    <DateTimePicker
                      value={toPickerDate(openedOn)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, date) => {
                        if (event.type === "set" && date) setOpenedOn(formatDate(date));
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
              </BottomSheetSurface>
            </Pressable>
          </KeyboardAvoidingView>
    </ActionSheet>
  );
}
