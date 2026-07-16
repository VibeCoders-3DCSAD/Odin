import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ArrowLeft,
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

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

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
  success: "#08B16A",
  card: "#F1F0EB",
  white: "#FFFFFF",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCOUNT_KINDS: readonly FinancialAccountKind[] = [
  "cash",
  "bank",
  "e_wallet",
  "savings",
  "credit_card",
  "loan",
  "other",
] as const;

const KIND_LABELS: Record<FinancialAccountKind, string> = {
  cash: "Cash",
  bank: "Bank",
  e_wallet: "E-Wallet",
  savings: "Savings",
  credit_card: "Credit Card",
  loan: "Loan",
  other: "Other",
};

function kindIcon(kind: FinancialAccountKind, size: number, color: string) {
  const props = { size, color, weight: "fill" as const };
  switch (kind) {
    case "cash":
      return <Money {...props} />;
    case "bank":
      return <Bank {...props} />;
    case "e_wallet":
      return <DeviceMobile {...props} />;
    case "savings":
      return <PiggyBank {...props} />;
    case "credit_card":
      return <CreditCard {...props} />;
    case "loan":
      return <Wallet {...props} />;
    default:
      return <Question {...props} />;
  }
}

function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const sign = pesos < 0 ? "-" : "";
  return `${sign}₱${Math.abs(pesos).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  userId: string;
  deviceId: string;
  onBack: () => void;
  onSyncRequested?: () => void;
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function FinancialAccountsScreen({ userId, deviceId, onBack, onSyncRequested }: Props) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const result = await listFinancialAccounts(userId);
      setAccounts(result);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const totalCash = accounts
    .filter((a) => a.status === "active" && a.includeInDashboardBalance)
    .reduce((sum, a) => sum + a.currentBalanceCentavos, 0);

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const handleCreate = async (input: CreateFinancialAccountInput) => {
    await createFinancialAccount(userId, deviceId, input);
    setSheetVisible(false);
    await loadAccounts();
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
    setSheetVisible(false);
    setEditingAccount(null);
    await loadAccounts();
    onSyncRequested?.();
  };

  const handleDelete = (account: FinancialAccount) => {
    Alert.alert(
      `Delete ${account.name}?`,
      "This account and its transactions will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteFinancialAccount(userId, deviceId, account.id);
            await loadAccounts();
            onSyncRequested?.();
          },
        },
      ],
    );
  };

  const openCreateSheet = () => {
    setEditingAccount(null);
    setSheetVisible(true);
  };

  const openEditSheet = (account: FinancialAccount) => {
    setEditingAccount(account);
    setSheetVisible(true);
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderAccount = ({ item: a }: { item: FinancialAccount }) => {
    const negative = isNegativeAccount(a);
    const tileBg = negative ? P.errorSoft : P.card;
    const amountColor = negative ? P.error : a.currentBalanceCentavos < 0 ? P.error : P.ink;
    const iconColor = negative ? P.error : P.brandMedium;

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: P.white,
          borderRadius: 12,
          marginBottom: 8,
          padding: 12,
          borderWidth: 1,
          borderColor: negative ? P.error : P.line,
        }}
      >
        {/* Icon tile */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: tileBg,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {kindIcon(a.kind, 22, iconColor)}
        </View>

        {/* Name + kind */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontFamily: "Manrope", fontWeight: "600", color: P.ink }}>
            {a.name}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "Manrope", color: P.muted, marginTop: 2 }}>
            {KIND_LABELS[a.kind] ?? a.kind}
            {negative ? " · Negative balance" : ""}
          </Text>
        </View>

        {/* Balance */}
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Manrope",
            fontWeight: "600",
            color: amountColor,
            marginRight: 8,
          }}
        >
          {formatPeso(a.currentBalanceCentavos)}
        </Text>

        {/* Actions */}
        <TouchableOpacity
          onPress={() => openEditSheet(a)}
          hitSlop={8}
          style={{ padding: 6 }}
        >
          <PencilSimple size={16} color={P.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(a)}
          hitSlop={8}
          style={{ padding: 6, marginLeft: 4 }}
        >
          <TrashSimple size={16} color={P.error} />
        </TouchableOpacity>
      </View>
    );
  };

  // -----------------------------------------------------------------------

  return (
    <View style={{ flex: 1, backgroundColor: P.shell }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 48,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity onPress={onBack} hitSlop={8} style={{ marginRight: 12 }}>
          <ArrowLeft size={22} color={P.ink} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>
          Financial Accounts
        </Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        renderItem={renderAccount}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        ListHeaderComponent={
          <View
            style={{
              backgroundColor: P.brand,
              borderRadius: 14,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Manrope",
                fontWeight: "600",
                color: "#41EDA4",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Total Cash Position
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontFamily: "Manrope",
                fontWeight: "700",
                color: P.white,
              }}
            >
              {formatPeso(totalCash)}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <Wallet size={40} color={P.muted} />
              <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Manrope", color: P.muted }}>
                No accounts yet
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, fontFamily: "Manrope", color: P.muted }}>
                Tap + to add your first account
              </Text>
            </View>
          )
        }
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={openCreateSheet}
        activeOpacity={0.85}
        style={{
          position: "absolute",
          bottom: 24,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: P.brand,
          alignItems: "center",
          justifyContent: "center",
          elevation: 6,
          shadowColor: P.brand,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
        }}
      >
        <Plus size={24} color={P.white} weight="bold" />
      </TouchableOpacity>

      {/* Bottom sheet modal */}
      <AccountFormSheet
        visible={sheetVisible}
        editing={editingAccount}
        onClose={() => {
          setSheetVisible(false);
          setEditingAccount(null);
        }}
        onSubmit={editingAccount ? handleUpdate : handleCreate}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bottom Sheet Form
// ---------------------------------------------------------------------------

function AccountFormSheet({
  visible,
  editing,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  editing: FinancialAccount | null;
  onClose: () => void;
  onSubmit: (input: CreateFinancialAccountInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FinancialAccountKind>("bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = editing !== null;

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setOpeningBalance(String(editing.openingBalanceCentavos / 100));
      setCreditLimit(
        editing.creditLimitCentavos != null
          ? String(editing.creditLimitCentavos / 100)
          : "",
      );
      setInstitutionName(editing.institutionName ?? "");
    } else {
      setName("");
      setKind("bank");
      setOpeningBalance("");
      setCreditLimit("");
      setInstitutionName("");
    }
  }, [editing]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Account name is required.");
      return;
    }
    if (!kind) {
      Alert.alert("Error", "Please select an account type.");
      return;
    }

    const openingCents = parseSafeCents(openingBalance);
    if (openingCents === null && openingBalance.trim() !== "") {
      Alert.alert("Error", "Opening balance must be a valid amount.");
      return;
    }
    const limitCents = parseSafeCents(creditLimit);
    if (limitCents === null && creditLimit.trim() !== "") {
      Alert.alert("Error", "Credit limit must be a valid amount.");
      return;
    }

    setSaving(true);
    try {
      const input: CreateFinancialAccountInput = {
        name: name.trim(),
        kind,
        openingBalanceCentavos: openingCents ?? 0,
        creditLimitCentavos:
          kind === "credit_card" || kind === "loan" ? limitCents : null,
        institutionName: institutionName.trim() || null,
      };
      await onSubmit(input);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Dimmed backdrop */}
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose}>
        <View style={{ flex: 1 }} />
      </Pressable>

      {/* Sheet */}
      <View
        style={{
          backgroundColor: P.white,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          paddingBottom: 36,
          maxHeight: "85%",
        }}
      >
        {/* Drag handle */}
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: P.line,
            alignSelf: "center",
            marginBottom: 16,
          }}
        />

        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Manrope",
              fontWeight: "700",
              color: P.ink,
              marginBottom: 16,
            }}
          >
            {isEdit ? "Edit Account" : "Add Account"}
          </Text>

          {/* Account type selector */}
          <Text style={labelStyle}>Account Type</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {ACCOUNT_KINDS.map((k) => {
              const selected = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: selected ? P.brand : P.card,
                    gap: 6,
                  }}
                >
                  {kindIcon(k, 16, selected ? P.white : P.ink2)}
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: "Manrope",
                      fontWeight: "600",
                      color: selected ? P.white : P.ink2,
                    }}
                  >
                    {KIND_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Name */}
          <Text style={labelStyle}>Account Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. BPI Savings"
            placeholderTextColor={P.muted}
            style={inputStyle}
          />

          {/* Opening balance */}
          <Text style={labelStyle}>Opening Balance (₱)</Text>
          <TextInput
            value={openingBalance}
            onChangeText={setOpeningBalance}
            placeholder="0.00"
            placeholderTextColor={P.muted}
            keyboardType="decimal-pad"
            style={inputStyle}
          />

          {/* Credit limit (only for credit_card / loan) */}
          {(kind === "credit_card" || kind === "loan") && (
            <>
              <Text style={labelStyle}>Credit Limit (₱)</Text>
              <TextInput
                value={creditLimit}
                onChangeText={setCreditLimit}
                placeholder="0.00"
                placeholderTextColor={P.muted}
                keyboardType="decimal-pad"
                style={inputStyle}
              />
            </>
          )}

          {/* Institution name */}
          <Text style={labelStyle}>Institution (optional)</Text>
          <TextInput
            value={institutionName}
            onChangeText={setInstitutionName}
            placeholder="e.g. BPI"
            placeholderTextColor={P.muted}
            style={inputStyle}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
            style={{
              backgroundColor: P.brand,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              marginTop: 12,
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: "Manrope",
                fontWeight: "700",
                color: P.white,
              }}
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Account"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared form styles
// ---------------------------------------------------------------------------

const labelStyle = {
  fontSize: 12,
  fontFamily: "Manrope",
  fontWeight: "600",
  color: P.ink2,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.5,
} as const;

const inputStyle = {
  backgroundColor: P.card,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  fontFamily: "Manrope",
  color: P.ink,
  marginBottom: 14,
} as const;
