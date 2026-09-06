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
  return account.currentBalanceCentavos < 0;
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

  const handleCreate = async (input: CreateFinancialAccountInput) => {
    await createFinancialAccount(userId, deviceId, input);
    setSheetVisible(false); await loadAccounts();
    onSyncRequested?.();
  };

  const handleUpdate = async (input: CreateFinancialAccountInput) => {
    if (!editingAccount) return;
    const balanceChange = input.openingBalanceCentavos ?? 0;
    await updateFinancialAccount(userId, deviceId, editingAccount.id, {
      ...input,
      currentBalanceCentavos:
        editingAccount.currentBalanceCentavos -
        editingAccount.openingBalanceCentavos +
        balanceChange,
    } satisfies UpdateFinancialAccountInput);
    setSheetVisible(false); setEditingAccount(null);
    await loadAccounts();
    onSyncRequested?.();
  };

  const handleDelete = (account: FinancialAccount) => {
    Alert.alert(`Delete ${account.name}?`, "This account and its transactions will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteFinancialAccount(userId, deviceId, account.id); await loadAccounts(); onSyncRequested?.(); } },
    ]);
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
        accounts.map((a) => {
          const negative = isNegativeAccount(a);
          const tileBg = negative ? P.errorSoft : P.card;
          const amountColor = negative ? P.error : a.currentBalanceCentavos < 0 ? P.error : P.ink;
          const iconColor = negative ? P.error : P.brandMedium;

          return (
            <View key={a.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: negative ? "#FFF1F3" : P.shell, borderRadius: 15, marginBottom: 9, padding: 13, borderWidth: 1, borderColor: negative ? "#FFB9C2" : P.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: negative ? "#FFF9F0" : tileBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                {kindIcon(a.kind, 22, iconColor)}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>{a.name}</Text>
                <Text style={{ fontSize: 10.5, fontFamily: "Manrope", fontWeight: "500", color: negative ? P.error : P.muted, marginTop: 2 }}>
                  {negative
                    ? "Negative balance"
                    : a.kind === "credit_card" && a.creditCardDetails
                      ? `Credit limit ${formatPeso(a.creditCardDetails.creditLimitCentavos)}`
                      : KIND_LABELS[a.kind] ?? a.kind}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", marginRight: 2 }}>
                <Text style={{ fontSize: 14, fontFamily: "Manrope", fontWeight: "800", color: amountColor }}>{formatPeso(a.currentBalanceCentavos)}</Text>
                <Text style={{ fontSize: 9.5, fontFamily: "Manrope", fontWeight: "500", color: negative ? P.error : P.muted, marginTop: 1 }}>PHP</Text>
              </View>
              <KebabTooltip
                kebabDirection="horizontal"
                tooltipLocation="bottomRight"
                onEdit={() => { setEditingAccount(a); setSheetVisible(true); }}
                onDelete={() => handleDelete(a)}
              />
            </View>
          );
        })
      )}
      <AccountFormSheet visible={sheetVisible} editing={editingAccount} onClose={() => { setSheetVisible(false); setEditingAccount(null); }} onSubmit={editingAccount ? handleUpdate : handleCreate} />
    </>
  );
}

type FieldErrors = Partial<Record<"name" | "openingBalance" | "creditLimit" | "billingCycle" | "cutoffDay" | "statementDay" | "threshold", string>>;

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
        {label} {required ? <Text style={{ color: P.error }}>*</Text> : null}
      </Text>
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

function AccountFormSheet({ visible, editing, onClose, onSubmit }: { visible: boolean; editing: FinancialAccount | null; onClose: () => void; onSubmit: (input: CreateFinancialAccountInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FinancialAccountKind>("bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [billingCycle, setBillingCycle] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [threshold, setThreshold] = useState("");
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
      setStatementDay(cc ? String(cc.statementDay) : "");
      setThreshold(cc && cc.alertThresholdPercent != null ? String(cc.alertThresholdPercent) : "");
    } else {
      setName(""); setKind("bank"); setOpeningBalance(""); setInstitutionName("");
      setOpenedOn(null);
      setCreditLimit(""); setBillingCycle(""); setCutoffDay(""); setStatementDay(""); setThreshold("");
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
    let statementDayValue: number | null = null;

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

      statementDayValue = parseDayOfMonth(statementDay);
      if (!statementDay.trim()) nextErrors.statementDay = "Enter a valid statement day.";
      else if (statementDayValue === null) nextErrors.statementDay = "Enter a valid statement day.";

      if (!threshold.trim()) {
        nextErrors.threshold = "Alert threshold is required.";
      } else if (!/^\d+$/.test(threshold.trim())) {
        nextErrors.threshold = "Alert threshold must be between 0 and 100.";
      } else {
        thresholdValue = parseInt(threshold.trim(), 10);
        if (thresholdValue < 0 || thresholdValue > 100) nextErrors.threshold = "Alert threshold must be between 0 and 100.";
      }
    }

    if (Object.keys(nextErrors).length > 0) { setFieldErrors(nextErrors); return; }

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
          statementDay: statementDayValue!,
          alertThresholdPercent: thresholdValue!,
        };
      }
      await onSubmit(input);
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

                      <FormField label="CUT-OFF DAY" required error={fieldErrors.cutoffDay}>
                        <TextInput
                          value={cutoffDay}
                          onChangeText={(t) => { setCutoffDay(t); clearFieldError("cutoffDay"); }}
                          placeholder="Enter cut-off day"
                          placeholderTextColor={P.muted}
                          keyboardType="number-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: fieldErrors.cutoffDay ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </FormField>

                      <FormField label="STATEMENT DAY" required error={fieldErrors.statementDay}>
                        <TextInput
                          value={statementDay}
                          onChangeText={(t) => { setStatementDay(t); clearFieldError("statementDay"); }}
                          placeholder="Enter statement day"
                          placeholderTextColor={P.muted}
                          keyboardType="number-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: fieldErrors.statementDay ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
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