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
import {
  Bank,
  CreditCard,
  DeviceMobile,
  Money,
  PiggyBank,
  Plus,
  Question,
  TrashSimple,
  PencilSimple,
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
  "cash", "bank", "e_wallet", "savings", "credit_card", "loan", "other",
];

const KIND_LABELS: Record<FinancialAccountKind, string> = {
  cash: "Cash", bank: "Bank", e_wallet: "E-Wallet",
  savings: "Savings", credit_card: "Credit Card", loan: "Loan", other: "Other",
};

function kindIcon(kind: FinancialAccountKind, size: number, color: string) {
  const props = { size, color, weight: "fill" as const };
  switch (kind) {
    case "cash": return <Money {...props} />;
    case "bank": return <Bank {...props} />;
    case "e_wallet": return <DeviceMobile {...props} />;
    case "savings": return <PiggyBank {...props} />;
    case "credit_card": return <CreditCard {...props} />;
    case "loan": return <Wallet {...props} />;
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
  return (
    (account.kind === "credit_card" || account.kind === "loan") &&
    account.currentBalanceCentavos < 0
  );
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
    } as UpdateFinancialAccountInput);
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>Financial Accounts</Text>
        <TouchableOpacity onPress={() => { setEditingAccount(null); setSheetVisible(true); }} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: P.brand, alignItems: "center", justifyContent: "center" }}>
          <Plus size={18} color={P.white} weight="bold" />
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: P.brand, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontFamily: "Manrope", fontWeight: "600", color: "#41EDA4", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Total Cash Position</Text>
        <Text style={{ fontSize: 28, fontFamily: "Manrope", fontWeight: "700", color: P.white }}>{formatPeso(totalCash)}</Text>
      </View>
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
            <View key={a.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: P.white, borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: negative ? P.error : P.line }}>
              <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: tileBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                {kindIcon(a.kind, 22, iconColor)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Manrope", fontWeight: "600", color: P.ink }}>{a.name}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Manrope", color: P.muted, marginTop: 2 }}>
                  {KIND_LABELS[a.kind] ?? a.kind}{negative ? " · Negative balance" : ""}
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontFamily: "Manrope", fontWeight: "600", color: amountColor, marginRight: 8 }}>{formatPeso(a.currentBalanceCentavos)}</Text>
              <TouchableOpacity onPress={() => { setEditingAccount(a); setSheetVisible(true); }} hitSlop={8} style={{ padding: 6 }}>
                <PencilSimple size={16} color={P.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(a)} hitSlop={8} style={{ padding: 6, marginLeft: 4 }}>
                <TrashSimple size={16} color={P.error} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
      <AccountFormSheet visible={sheetVisible} editing={editingAccount} onClose={() => { setSheetVisible(false); setEditingAccount(null); }} onSubmit={editingAccount ? handleUpdate : handleCreate} />
    </>
  );
}

function AccountFormSheet({ visible, editing, onClose, onSubmit }: { visible: boolean; editing: FinancialAccount | null; onClose: () => void; onSubmit: (input: CreateFinancialAccountInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FinancialAccountKind>("bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = editing !== null;

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setOpeningBalance(String(editing.openingBalanceCentavos / 100));
      setCreditLimit(editing.creditLimitCentavos != null ? String(editing.creditLimitCentavos / 100) : "");
      setInstitutionName(editing.institutionName ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setName(""); setKind("bank"); setOpeningBalance(""); setCreditLimit(""); setInstitutionName(""); setNotes("");
    }
    setFormError(null);
  }, [editing]);

  const showCreditLimit = kind === "credit_card" || kind === "loan";
  const openingInvalid = openingBalance.trim() !== "" && parseSafeCents(openingBalance) === null;
  const limitInvalid = creditLimit.trim() !== "" && parseSafeCents(creditLimit) === null;

  const handleSubmit = async () => {
    setFormError(null);
    const errors: string[] = [];

    if (!name.trim()) errors.push("Account name is required.");

    const openingCents = parseSafeCents(openingBalance);
    if (openingBalance.trim() && openingCents === null) errors.push("Opening balance must be a valid amount.");

    const limitCents = parseSafeCents(creditLimit);
    if (showCreditLimit && creditLimit.trim() && limitCents === null) errors.push("Credit limit must be a valid amount.");
    else if (limitCents !== null && limitCents < 0) errors.push("Credit limit must be >= 0.");

    if (errors.length > 0) { setFormError(errors.join("\n")); return; }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        kind,
        openingBalanceCentavos: openingCents ?? 0,
        creditLimitCentavos: showCreditLimit ? limitCents : null,
        institutionName: institutionName.trim() || null,
        notes: notes.trim() || null,
      });
    } catch (err) { setFormError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }}>
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

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      ACCOUNT NAME <Text style={{ color: P.error }}>*</Text>
                    </Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. BPI Savings"
                      placeholderTextColor={P.muted}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      ACCOUNT TYPE <Text style={{ color: P.error }}>*</Text>
                    </Text>
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
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      OPENING BALANCE (₱)
                    </Text>
                    <TextInput
                      value={openingBalance}
                      onChangeText={setOpeningBalance}
                      placeholder="0.00"
                      placeholderTextColor={P.muted}
                      keyboardType="decimal-pad"
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: openingInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  {showCreditLimit && (
                    <View>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                        CREDIT LIMIT (₱)
                      </Text>
                      <TextInput
                        value={creditLimit}
                        onChangeText={setCreditLimit}
                        placeholder="0.00"
                        placeholderTextColor={P.muted}
                        keyboardType="decimal-pad"
                        style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: limitInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                      />
                    </View>
                  )}

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      INSTITUTION (OPTIONAL)
                    </Text>
                    <TextInput
                      value={institutionName}
                      onChangeText={setInstitutionName}
                      placeholder="e.g. BPI"
                      placeholderTextColor={P.muted}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      NOTES (OPTIONAL)
                    </Text>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add any details..."
                      placeholderTextColor={P.muted}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  {formError && (
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.error }}>{formError}</Text>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
                    <Pressable onPress={onClose} disabled={saving} style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: P.line, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink2 }}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleSubmit} disabled={saving} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
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
