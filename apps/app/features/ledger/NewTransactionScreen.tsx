import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { CalendarBlank, CaretLeft, CaretRight, Repeat, Wallet, X } from "phosphor-react-native";
import { CategorySelectorTree, type CategorySelection } from "../../components/CategorySelector";
import TransactionTypeSelector, { TransactionType } from "./components/TransactionTypeSelector";
import { useTransactionData } from "./hooks/useTransactionData";
import { createExpense, createIncome, createTransfer, updateTransaction, type Transaction, type UpdateTransactionInput } from "../../local-db/repositories/ledger";
import { createRecurringTemplate } from "../../local-db/repositories/recurringTransactions";
import { runSync } from "../../local-db/sync/runSync";
import { useToast } from "../../components/Toast";
import { useConnectivityStore } from "../../services/connectivity";
import type { Subcategory } from "../../local-db/repositories/taxonomy";

const palette = {
  shell: "#fcf8f0",
  brand: "#013220",
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  card: "#F1F0EB",
  softCard: "#f7eed9",
  successTint: "#20c277",
  successCard: "#effff6",
} as const;

const QUICK_AMOUNTS = [100, 250, 500, 1000];

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onClose: () => void;
  transaction?: Transaction;
};

export default function NewTransactionScreen({ userId, deviceId, accessToken, onClose, transaction }: Props) {
  const { showToast } = useToast();
  const online = useConnectivityStore((s) => s.online);
  const isEdit = !!transaction;

  const [txType, setTxType] = useState<TransactionType>((transaction?.transaction_type as TransactionType) ?? "expense");

  useEffect(() => {
    if (!isEdit) setCategorySelection({ tier: null, groupId: null, categoryId: null, subcategoryId: null });
  }, [txType]);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount_centavos / 100) : "");
  const [date, setDate] = useState(transaction ? new Date(transaction.transaction_date + "T00:00:00") : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState(transaction?.source_account_id ?? "");
  const [destAccountId, setDestAccountId] = useState(transaction?.destination_account_id ?? "");
  const [categorySelection, setCategorySelection] = useState<CategorySelection>({
    tier: transaction?.subcategory_id ? "subcategory" : null,
    groupId: null,
    categoryId: null,
    subcategoryId: transaction?.subcategory_id ?? null,
  });
  const [description, setDescription] = useState(transaction?.merchant_name ?? transaction?.counterparty_name ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [accountPickerMode, setAccountPickerMode] = useState<"source" | "dest" | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState("monthly");
  const [recurringInterval, setRecurringInterval] = useState("");
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState("");
  const [recurringDayOfWeek, setRecurringDayOfWeek] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const { accounts, groups, categories, subcategories, loading, error: dataError } = useTransactionData(userId, txType);

  useEffect(() => {
    if (!isEdit) {
      setCategorySelection({ tier: null, groupId: null, categoryId: null, subcategoryId: null });
    }
  }, [txType, isEdit]);

  useEffect(() => {
    if (txType === "transfer") return;

    const currentSubcategory = categorySelection.subcategoryId
      ? subcategories.find((item) => item.id === categorySelection.subcategoryId) ?? null
      : null;
    const currentCategory = categorySelection.categoryId
      ? categories.find((item) => item.id === categorySelection.categoryId) ?? null
      : currentSubcategory?.category_id ? categories.find((item) => item.id === currentSubcategory.category_id) ?? null : null;
    const currentGroup = categorySelection.groupId
      ? groups.find((item) => item.id === categorySelection.groupId) ?? null
      : currentCategory ? groups.find((item) => item.id === currentCategory.category_group_id) ?? null : null;

    if (currentCategory || currentGroup || currentSubcategory) {
      if (currentGroup?.id !== categorySelection.groupId || currentCategory?.id !== categorySelection.categoryId) {
        setCategorySelection((current) => ({
          ...current,
          groupId: currentGroup?.id ?? current.groupId,
          categoryId: currentCategory?.id ?? current.categoryId,
        }));
      }
      return;
    }

    if (!isEdit && subcategories.length > 0) {
      const fallback = subcategories[0]!;
      const fallbackCategory = fallback.category_id ? categories.find((item) => item.id === fallback.category_id) ?? null : null;
      const fallbackGroup = fallbackCategory ? groups.find((item) => item.id === fallbackCategory.category_group_id) ?? null : null;
      setCategorySelection({
        tier: "subcategory",
        groupId: fallbackGroup?.id ?? null,
        categoryId: fallbackCategory?.id ?? null,
        subcategoryId: fallback.id,
      });
    }
  }, [
    subcategories,
    categories,
    groups,
    txType,
    categorySelection.groupId,
    categorySelection.categoryId,
    categorySelection.subcategoryId,
    isEdit,
  ]);

  useEffect(() => {
    if (txType === "transfer") {
      setShowCategoryPicker(false);
    }
  }, [txType]);

  function resetForm(keepType = false) {
    setAmount("");
    setDescription("");
    setNotes("");
    setCategorySelection({ tier: null, groupId: null, categoryId: null, subcategoryId: null });
    setSourceAccountId("");
    setDestAccountId("");
    setFormError(null);
    if (!keepType) setTxType("expense");
  }

  function parseAmount(): number {
    const cleaned = amount.replace(/,/g, "").trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return 0;
    const parsed = parseFloat(cleaned);
    if (Number.isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }

  function formatDate(value: Date): string {
    const today = new Date();
    if (value.toDateString() === today.toDateString()) return "Today";
    return value.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }

  function getSelectedSubcategory(): Subcategory | null {
    return categorySelection.subcategoryId
      ? subcategories.find((item) => item.id === categorySelection.subcategoryId) ?? null
      : null;
  }

  function getSelectedCategory() {
    if (categorySelection.categoryId) {
      return categories.find((item) => item.id === categorySelection.categoryId) ?? null;
    }
    const selectedSubcategory = getSelectedSubcategory();
    if (!selectedSubcategory?.category_id) return null;
    return categories.find((item) => item.id === selectedSubcategory.category_id) ?? null;
  }

  function getSelectedGroup() {
    if (categorySelection.groupId) {
      return groups.find((item) => item.id === categorySelection.groupId) ?? null;
    }
    const selectedCategory = getSelectedCategory();
    if (!selectedCategory) return null;
    return groups.find((item) => item.id === selectedCategory.category_group_id) ?? null;
  }

  function resolveEffectiveSubcategoryId(): string {
    if (categorySelection.subcategoryId) return categorySelection.subcategoryId;
    if (categorySelection.categoryId) {
      return subcategories.find((item) => item.category_id === categorySelection.categoryId)?.id ?? "";
    }
    if (categorySelection.groupId) {
      const categoryIds = categories
        .filter((item) => item.category_group_id === categorySelection.groupId)
        .map((item) => item.id);
      return subcategories.find((item) => item.category_id && categoryIds.includes(item.category_id))?.id ?? "";
    }
    return "";
  }

  function getCategorySummaryLabel(): string {
    if (categorySelection.tier === "subcategory") return getSelectedSubcategory()?.label ?? "Select category";
    if (categorySelection.tier === "category") return getSelectedCategory()?.label ?? "Select category";
    if (categorySelection.tier === "group") return getSelectedGroup()?.label ?? "Select category";
    return "Select category";
  }

  function getAccountName(id: string): string {
    return accounts.find((a) => a.id === id)?.name ?? "Select account";
  }

  function getPrimaryAccountLabel(): string {
    if (txType === "income") return destAccountId ? getAccountName(destAccountId) : "Select account";
    return sourceAccountId ? getAccountName(sourceAccountId) : "Select account";
  }

  function getScreenTitle(): string {
    return isEdit ? "Edit Transaction" : "New Transaction";
  }

  function renderFieldLabel(label: string) {
    return (
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
        {label}
      </Text>
    );
  }

  async function handleSave() {
    setFormError(null);
    const centavos = parseAmount();
    const effectiveSubcategoryId = resolveEffectiveSubcategoryId();
    if (centavos <= 0) {
      setFormError("Enter a valid amount");
      return;
    }

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    if (txType === "expense" && !sourceAccountId) {
      setFormError("Select a source account");
      return;
    }
    if (txType === "income" && !destAccountId) {
      setFormError("Select a destination account");
      return;
    }
    if (txType === "transfer") {
      if (!sourceAccountId) {
        setFormError("Select a source account");
        return;
      }
      if (!destAccountId) {
        setFormError("Select a destination account");
        return;
      }
    }
    if (txType !== "transfer" && !effectiveSubcategoryId) {
      setFormError("Select a category");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const updateInput: Record<string, unknown> = {
          amount_centavos: centavos,
          transaction_date: dateStr,
          notes: notes.trim() || "",
        };

        if (txType === "expense") {
          updateInput.source_account_id = sourceAccountId;
          updateInput.subcategory_id = effectiveSubcategoryId;
          updateInput.merchant_name = description.trim() || "";
        } else if (txType === "income") {
          updateInput.destination_account_id = destAccountId;
          updateInput.subcategory_id = effectiveSubcategoryId;
          updateInput.counterparty_name = description.trim() || "";
        } else {
          updateInput.source_account_id = sourceAccountId;
          updateInput.destination_account_id = destAccountId;
          const desc = description.trim();
          const note = notes.trim();
          updateInput.notes = desc && note ? `${desc} — ${note}` : (desc || note || "");
        }

        await updateTransaction(userId, deviceId, transaction!.id, updateInput as UpdateTransactionInput);
      } else if (txType === "expense") {
        await createExpense(userId, deviceId, {
          amount_centavos: centavos,
          source_account_id: sourceAccountId,
          subcategory_id: effectiveSubcategoryId,
          transaction_date: dateStr,
          merchant_name: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else if (txType === "income") {
        await createIncome(userId, deviceId, {
          amount_centavos: centavos,
          destination_account_id: destAccountId,
          subcategory_id: effectiveSubcategoryId,
          transaction_date: dateStr,
          counterparty_name: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        const desc = description.trim();
        const note = notes.trim();
        const mergedNotes = desc && note ? `${desc} — ${note}` : (desc || note || undefined);
        await createTransfer(userId, deviceId, {
          amount_centavos: centavos,
          source_account_id: sourceAccountId,
          destination_account_id: destAccountId,
          transaction_date: dateStr,
          notes: mergedNotes,
        });
      }

      if (!isEdit && isRecurring) {
        const freqInterval = parseInt(recurringInterval, 10);
        const dom = parseInt(recurringDayOfMonth, 10);
        const dow = parseInt(recurringDayOfWeek, 10);
        await createRecurringTemplate(userId, deviceId, {
          transaction_type: txType,
          name: description.trim() || `${txType} recurring`,
          amount_centavos: centavos,
          frequency: recurringFreq,
          interval_count: Number.isInteger(freqInterval) && freqInterval > 0 ? freqInterval : undefined,
          day_of_month: Number.isInteger(dom) && dom >= 1 && dom <= 31 ? dom : undefined,
          day_of_week: Number.isInteger(dow) && dow >= 0 && dow <= 6 ? dow : undefined,
          starts_on: dateStr,
          subcategory_id: effectiveSubcategoryId || undefined,
          source_account_id: sourceAccountId || undefined,
          destination_account_id: destAccountId || undefined,
          notes: notes.trim() || undefined,
        });
      }

      showToast(isEdit ? "Transaction updated" : "Transaction saved", "success");
      runSync(userId, deviceId, accessToken, { maxAttempts: 3 }).catch(() => {});

      resetForm(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }

  function renderAccountPicker() {
    if (!accountPickerMode) return null;
    const isSource = accountPickerMode === "source";

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setAccountPickerMode(null)}>
        <Pressable onPress={() => setAccountPickerMode(null)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
              <Pressable onPress={() => {}}>
                <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.85 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
                  <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled" bounces={false}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: palette.ink }}>
                      {isSource ? "From account" : "To account"}
                    </Text>
                    {accounts.length === 0 ? (
                      <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, textAlign: "center", paddingVertical: 20 }}>
                        No financial accounts available
                      </Text>
                    ) : (
                      accounts.map((a) => {
                        const selected = isSource ? sourceAccountId === a.id : destAccountId === a.id;
                        return (
                          <Pressable
                            key={a.id}
                            onPress={() => {
                              if (isSource) setSourceAccountId(a.id);
                              else setDestAccountId(a.id);
                              setAccountPickerMode(null);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={a.name}
                            accessibilityState={{ selected }}
                            style={{
                              padding: 14,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: selected ? palette.brand : palette.line,
                              backgroundColor: selected ? palette.successCard : palette.card,
                            }}
                          >
                            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }}>
                              {a.name}
                            </Text>
                            <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 2 }}>
                              {a.kind.replace("_", " ")} · P{(a.current_balance_centavos / 100).toLocaleString()}
                            </Text>
                          </Pressable>
                        );
                      }))}
                  </ScrollView>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Modal>
    );
  }

  function renderDatePicker() {
    if (!showDatePicker) return null;

    if (Platform.OS === "android") {
      return (
        <DateTimePicker
          value={date}
          mode="date"
          maximumDate={new Date()}
          onChange={(_event, nextDate) => {
            setShowDatePicker(false);
            if (nextDate) setDate(nextDate);
          }}
        />
      );
    }

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable onPress={() => setShowDatePicker(false)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, paddingTop: 14 }}>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.mut }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: palette.ink }}>
                    Select date
                  </Text>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.brand }}>
                      Done
                    </Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  maximumDate={new Date()}
                  display="spinner"
                  onChange={(_event, nextDate) => {
                    if (nextDate) setDate(nextDate);
                  }}
                />
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    );
  }

  function renderCategoryPickerPage() {
    const selectedGroup = getSelectedGroup();
    const selectedCategory = getSelectedCategory();
    const selectedSubcategory = getSelectedSubcategory();

    return (
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, marginBottom: 16 }}>
          Pick from your full {txType} category list.
        </Text>

        {(selectedGroup || selectedCategory || selectedSubcategory) ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: palette.successTint, backgroundColor: palette.successCard, padding: 14, marginBottom: 18 }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: "600", color: palette.successTint, letterSpacing: 0.4, marginBottom: 4 }}>
              CURRENT SELECTION
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: palette.ink }}>
              {getCategorySummaryLabel()}
            </Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {txType === "income" ? (
            subcategories.length === 0 ? (
              <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, textAlign: "center", paddingVertical: 20 }}>
                No income categories found.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {subcategories.map((sub) => {
                  const selected = categorySelection.subcategoryId === sub.id;
                  return (
                    <Pressable
                      key={sub.id}
                      onPress={() => {
                        setCategorySelection({ tier: "subcategory", groupId: null, categoryId: null, subcategoryId: sub.id });
                        setShowCategoryPicker(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={sub.label}
                      accessibilityState={{ selected }}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected ? palette.brand : palette.line,
                        backgroundColor: selected ? palette.successCard : palette.card,
                      }}
                    >
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }}>
                        {sub.label}
                      </Text>
                      {sub.description ? (
                        <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 2 }}>
                          {sub.description}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )
          ) : (
            <CategorySelectorTree
              groups={groups}
              categories={categories}
              subcategories={subcategories}
              selection={categorySelection}
              onSelect={(nextSelection) => {
                setCategorySelection(nextSelection);
                setShowCategoryPicker(false);
              }}
              emptyMessage="No categories found for this transaction type."
            />
          )}
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 60 }}>
        <ActivityIndicator color={palette.brand} />
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, marginTop: 10 }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (dataError) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 60 }}>
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.error, marginBottom: 14 }}>
          {dataError}
        </Text>
        <Pressable onPress={onClose} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.line }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: palette.ink2 }}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const descriptionLabel = txType === "income" ? "PAYER" : "DESCRIPTION";
  const descriptionPlaceholder = txType === "income" ? "Who paid you?" : txType === "transfer" ? "What's this for?" : "Jollibee - Lunch";
  const needsCategory = txType !== "transfer";
  const selectedSubcategory = getSelectedSubcategory();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: palette.shell }}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 14 }}>
          <Pressable
            onPress={showCategoryPicker ? () => setShowCategoryPicker(false) : onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showCategoryPicker ? "Back to transaction form" : "Close transaction form"}
          >
            {showCategoryPicker ? <CaretLeft color={palette.ink} size={22} weight="bold" /> : <X color={palette.ink} size={22} weight="bold" />}
          </Pressable>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: palette.ink }}>
            {showCategoryPicker ? "Select Category" : getScreenTitle()}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {!online && !showCategoryPicker ? (
          <View style={{ backgroundColor: "#fff4d7", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#8D6E00" }}>
              You're offline. Changes will sync when you reconnect.
            </Text>
          </View>
        ) : null}

        {showCategoryPicker ? renderCategoryPickerPage() : (
          <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!isEdit ? <TransactionTypeSelector value={txType} onChange={setTxType} /> : null}

            <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 2 }}>
              <Text style={{ fontFamily: "Manrope", fontSize: 15, color: palette.mut, marginBottom: 2 }}>PHP</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="#b9b39f"
                keyboardType="decimal-pad"
                style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 54, color: palette.ink, textAlign: "center", minWidth: 180, paddingVertical: 0 }}
              />
              <View style={{ width: 138, height: 2, borderRadius: 999, backgroundColor: palette.successTint, marginTop: 6 }} />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              {QUICK_AMOUNTS.map((quickAmount) => {
                const selected = amount === String(quickAmount);
                return (
                  <Pressable
                    key={quickAmount}
                    onPress={() => setAmount(String(quickAmount))}
                    style={{
                      minWidth: 52,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? palette.successTint : "#e6dcc7",
                      backgroundColor: selected ? "#cbffe8" : palette.card,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontFamily: "Manrope", fontWeight: selected ? "700" : "600", fontSize: 13, color: palette.ink2 }}>
                      {quickAmount.toLocaleString()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View>
              {renderFieldLabel(descriptionLabel)}
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={descriptionPlaceholder}
                placeholderTextColor={palette.mut}
                style={{ height: 58, borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", paddingHorizontal: 16, fontFamily: "Manrope", fontSize: 16, color: palette.ink, backgroundColor: palette.softCard }}
              />
            </View>

            {txType === "transfer" ? (
              <View style={{ gap: 14 }}>
                <View>
                  {renderFieldLabel("DATE")}
                  <Pressable onPress={() => setShowDatePicker(true)} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <CalendarBlank color={palette.mut} size={18} weight="regular" />
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: palette.ink }}>{formatDate(date)}</Text>
                    </View>
                  </Pressable>
                </View>
                <View>
                  {renderFieldLabel("FROM ACCOUNT")}
                  <Pressable onPress={() => setAccountPickerMode("source")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Wallet color={palette.mut} size={18} weight="regular" />
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: sourceAccountId ? palette.ink : palette.mut }}>
                        {sourceAccountId ? getAccountName(sourceAccountId) : "Select account"}
                      </Text>
                    </View>
                    <CaretRight color={palette.mut} size={16} weight="bold" />
                  </Pressable>
                </View>
                <View>
                  {renderFieldLabel("TO ACCOUNT")}
                  <Pressable onPress={() => setAccountPickerMode("dest")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Wallet color={palette.mut} size={18} weight="regular" />
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: destAccountId ? palette.ink : palette.mut }}>
                        {destAccountId ? getAccountName(destAccountId) : "Select account"}
                      </Text>
                    </View>
                    <CaretRight color={palette.mut} size={16} weight="bold" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  {renderFieldLabel("DATE")}
                  <Pressable onPress={() => setShowDatePicker(true)} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <CalendarBlank color={palette.mut} size={18} weight="regular" />
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: palette.ink }}>{formatDate(date)}</Text>
                    </View>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  {renderFieldLabel("ACCOUNT")}
                  <Pressable onPress={() => setAccountPickerMode(txType === "income" ? "dest" : "source")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <Wallet color={palette.mut} size={18} weight="regular" />
                      <Text numberOfLines={1} style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: (sourceAccountId || destAccountId) ? palette.ink : palette.mut, flex: 1 }}>
                        {getPrimaryAccountLabel()}
                      </Text>
                    </View>
                    <CaretRight color={palette.mut} size={16} weight="bold" />
                  </Pressable>
                </View>
              </View>
            )}

            {needsCategory ? (
              <View>
                {renderFieldLabel(categorySelection.tier ? `CATEGORY · ${categorySelection.tier.toUpperCase()}` : "CATEGORY")}
                <Pressable onPress={() => setShowCategoryPicker(true)} style={{ borderRadius: 16, borderWidth: 1, borderColor: categorySelection.tier ? palette.successTint : "#e8deca", backgroundColor: categorySelection.tier ? palette.successCard : palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: palette.ink }}>
                      {getCategorySummaryLabel()}
                    </Text>
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut, marginTop: 4 }}>
                      Open full list to view everything
                    </Text>
                  </View>
                  <CaretRight color={palette.mut} size={16} weight="bold" />
                </Pressable>
              </View>
            ) : null}

            <View>
              {renderFieldLabel("NOTES")}
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes"
                placeholderTextColor={palette.mut}
                multiline
                numberOfLines={3}
                style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", paddingHorizontal: 16, paddingTop: 14, fontFamily: "Manrope", fontSize: 15, color: palette.ink, backgroundColor: palette.softCard, minHeight: 92, textAlignVertical: "top" }}
              />
            </View>

            {!isEdit ? (
              <>
                <View style={{ borderRadius: 18, backgroundColor: "#f4ead2", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Repeat color={palette.ink2} size={18} weight="regular" />
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: palette.ink }}>Recurring</Text>
                  </View>
                  <Pressable onPress={() => setIsRecurring(!isRecurring)} accessibilityRole="switch" accessibilityLabel="Recurring transaction" accessibilityState={{ checked: isRecurring }} style={{ width: 50, height: 30, borderRadius: 999, backgroundColor: isRecurring ? palette.successTint : "#e4dfd3", padding: 3, justifyContent: "center" }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignSelf: isRecurring ? "flex-end" : "flex-start" }} />
                  </Pressable>
                </View>

                {isRecurring ? (
                  <View style={{ gap: 14 }}>
                    {renderFieldLabel("FREQUENCY")}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {(["daily", "weekly", "monthly", "quarterly", "yearly"] as const).map((f) => (
                        <Pressable
                          key={f}
                          onPress={() => setRecurringFreq(f)}
                          accessibilityRole="radio"
                          accessibilityLabel={f}
                          accessibilityState={{ checked: recurringFreq === f }}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: recurringFreq === f ? palette.brand : palette.card }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: recurringFreq === f ? "#fff" : palette.ink2 }}>{f}</Text>
                        </Pressable>
                      ))}
                    </View>

                    {recurringFreq === "monthly" ? (
                      <View>
                        {renderFieldLabel("DAY OF MONTH")}
                        <TextInput
                          value={recurringDayOfMonth}
                          onChangeText={setRecurringDayOfMonth}
                          placeholder="e.g. 15"
                          placeholderTextColor={palette.mut}
                          keyboardType="number-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#e8deca", paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.softCard }}
                        />
                      </View>
                    ) : null}

                    {recurringFreq === "weekly" ? (
                      <View>
                        {renderFieldLabel("DAY OF WEEK")}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                            <Pressable
                              key={day}
                              onPress={() => setRecurringDayOfWeek(String(idx))}
                              accessibilityRole="radio"
                              accessibilityLabel={day}
                              accessibilityState={{ checked: recurringDayOfWeek === String(idx) }}
                              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: recurringDayOfWeek === String(idx) ? palette.brand : palette.card }}
                            >
                              <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: recurringDayOfWeek === String(idx) ? "#fff" : palette.ink2 }}>{day}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    <View>
                      {renderFieldLabel("EVERY (INTERVAL)")}
                      <TextInput
                        value={recurringInterval}
                        onChangeText={setRecurringInterval}
                        placeholder="1"
                        placeholderTextColor={palette.mut}
                        keyboardType="number-pad"
                        style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#e8deca", paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: palette.ink, backgroundColor: palette.softCard }}
                      />
                      <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 4 }}>
                        Repeat every N {recurringFreq}(s)
                      </Text>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            {formError ? (
              <View style={{ backgroundColor: "#fff0f2", borderRadius: 14, padding: 12 }}>
                <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.error, fontWeight: "600" }}>{formError}</Text>
              </View>
            ) : null}

            {isEdit ? (
              <Pressable onPress={handleSave} disabled={saving} style={{ height: 54, borderRadius: 16, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel="Save changes">
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#fff" }}>Save Changes</Text>}
              </Pressable>
            ) : (
              <Pressable onPress={handleSave} disabled={saving} style={{ height: 54, borderRadius: 16, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel="Save transaction">
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#fff" }}>Save</Text>}
              </Pressable>
            )}
          </ScrollView>
        )}

        {renderDatePicker()}
        {renderAccountPicker()}
      </View>
    </KeyboardAvoidingView>
  );
}
