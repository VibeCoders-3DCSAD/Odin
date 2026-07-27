import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { CalendarBlank, CaretRight, PencilSimple, Plus, Repeat, TrashSimple, Wallet } from "phosphor-react-native";
import { CategorySelectorTree, type CategorySelection } from "../../components/CategorySelector";
import { useToast } from "../../components/Toast";
import type { FinancialAccount } from "../../local-db/repositories/financialAccounts";
import { listFinancialAccounts } from "../../local-db/repositories/financialAccounts";
import { linkObligationToRecurringTemplate, listFinancialObligations, type FinancialObligation } from "../../local-db/repositories/financialFoundations";
import { type RecurringTemplate, listRecurringTemplates, createRecurringTemplate, updateRecurringTemplate, deleteRecurringTemplate } from "../../local-db/repositories/recurringTransactions";
import { type Category, type CategoryGroup, type Subcategory, listCategories, listCategoryGroups, listSubcategories } from "../../local-db/repositories/taxonomy";
import RecurringScheduleFields, { type RecurringScheduleValue } from "./components/RecurringScheduleFields";

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
  white: "#FFFFFF",
} as const;

const TX_TYPES = ["expense", "income", "transfer"] as const;

type TransactionType = (typeof TX_TYPES)[number];

type Props = {
  userId: string;
  deviceId: string;
  onBack: () => void;
  onSyncRequested?: () => void;
  onCreateRequested?: () => void;
};

type FormState = {
  id: string | null;
  txType: TransactionType;
  amount: string;
  description: string;
  notes: string;
  startsOn: Date;
  endsOn: Date | null;
  sourceAccountId: string;
  destinationAccountId: string;
  categorySelection: CategorySelection;
  schedule: RecurringScheduleValue;
};

const EMPTY_SCHEDULE: RecurringScheduleValue = {
  frequency: "monthly",
  intervalCount: "1",
  dayOfMonth: "",
  secondDayOfMonth: "",
  dayOfWeek: null,
  secondDayOfWeek: null,
  monthOfYear: null,
  estimatedIntervalDays: "",
};

function formatPeso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return 0;
  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

function formatDateValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseDayOfMonth(raw: string): number | null {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 1 || value > 31) return null;
  return value;
}

function makeDefaultFormState(): FormState {
  return {
    id: null,
    txType: "expense",
    amount: "",
    description: "",
    notes: "",
    startsOn: new Date(),
    endsOn: null,
    sourceAccountId: "",
    destinationAccountId: "",
    categorySelection: { tier: null, groupId: null, categoryId: null, subcategoryId: null },
    schedule: EMPTY_SCHEDULE,
  };
}

function buildEditFormState(template: RecurringTemplate): FormState {
  return {
    id: template.id,
    txType: template.transaction_type as TransactionType,
    amount: String(template.amount_centavos / 100),
    description: template.name,
    notes: template.notes ?? "",
    startsOn: new Date(`${template.starts_on}T00:00:00`),
    endsOn: template.ends_on ? new Date(`${template.ends_on}T00:00:00`) : null,
    sourceAccountId: template.source_account_id ?? "",
    destinationAccountId: template.destination_account_id ?? "",
    categorySelection: {
      tier: template.subcategory_id ? "subcategory" : null,
      groupId: null,
      categoryId: null,
      subcategoryId: template.subcategory_id,
    },
    schedule: {
      frequency: template.frequency as RecurringScheduleValue["frequency"],
      intervalCount: String(template.interval_count || 1),
      dayOfMonth: template.day_of_month != null ? String(template.day_of_month) : "",
      secondDayOfMonth: template.second_day_of_month != null ? String(template.second_day_of_month) : "",
      dayOfWeek: template.day_of_week,
      secondDayOfWeek: null,
      monthOfYear: null,
      estimatedIntervalDays: "",
    },
  };
}

export default function RecurringTransactionsScreen({ userId, deviceId, onBack, onSyncRequested, onCreateRequested }: Props) {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [obligations, setObligations] = useState<FinancialObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templateRows, obligationRows] = await Promise.all([
        listRecurringTemplates(userId),
        listFinancialObligations(userId),
      ]);
      setTemplates(templateRows);
      setObligations(obligationRows);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const obligationMap = useMemo(() => {
    const map = new Map<string, FinancialObligation>();
    for (const obligation of obligations) {
      if (obligation.recurringTemplateId) map.set(obligation.recurringTemplateId, obligation);
    }
    return map;
  }, [obligations]);

  async function handleDelete(template: RecurringTemplate) {
    const linkedObligation = obligationMap.get(template.id) ?? null;
    Alert.alert(
      `Delete ${template.name}?`,
      "This recurring transaction template will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (linkedObligation) {
              await linkObligationToRecurringTemplate(userId, deviceId, linkedObligation.id, null);
            }
            await deleteRecurringTemplate(userId, deviceId, template.id);
            await load();
            onSyncRequested?.();
            showToast("Recurring transaction deleted", "success");
          },
        },
      ],
    );
  }

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontFamily: "Manrope", fontWeight: "700", color: palette.ink }}>Recurring Transactions</Text>
        <TouchableOpacity onPress={() => onCreateRequested ? onCreateRequested() : setFormState(makeDefaultFormState())} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center" }}>
          <Plus size={18} color={palette.white} weight="bold" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color={palette.brand} />
        </View>
      ) : templates.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <Repeat size={40} color={palette.mut} />
          <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Manrope", color: palette.mut }}>No recurring transactions yet</Text>
          <Text style={{ marginTop: 4, fontSize: 13, fontFamily: "Manrope", color: palette.mut }}>Tap + to add your first recurring template</Text>
        </View>
      ) : (
        templates.map((template) => {
          const linkedObligation = obligationMap.get(template.id) ?? null;
          return (
            <View key={template.id} style={{ backgroundColor: palette.white, borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: palette.line }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: palette.card, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Repeat size={22} color={palette.brand} weight="fill" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: "Manrope", fontWeight: "600", color: palette.ink }}>{template.name}</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Manrope", color: palette.mut, marginTop: 2 }}>
                    {template.transaction_type} · {template.frequency} · {formatPeso(template.amount_centavos)}
                    {template.next_occurrence_date ? ` · next ${template.next_occurrence_date}` : ""}
                  </Text>
                  {linkedObligation ? (
                    <Text style={{ fontSize: 12, fontFamily: "Manrope", color: palette.brand, marginTop: 4 }}>
                      Linked obligation: {linkedObligation.name}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => setFormState(buildEditFormState(template))} hitSlop={8} style={{ padding: 6 }}>
                  <PencilSimple size={16} color={palette.mut} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(template)} hitSlop={8} style={{ padding: 6, marginLeft: 4 }}>
                  <TrashSimple size={16} color={palette.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <RecurringTemplateFormModal
        visible={formState !== null}
        userId={userId}
        deviceId={deviceId}
        formState={formState}
        onClose={() => setFormState(null)}
        onSaved={async () => {
          setFormState(null);
          await load();
          onSyncRequested?.();
        }}
      />
    </>
  );
}

function RecurringTemplateFormModal({
  visible,
  userId,
  deviceId,
  formState,
  onClose,
  onSaved,
  presentation = "modal",
}: {
  visible: boolean;
  userId: string;
  deviceId: string;
  formState: FormState | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  presentation?: "modal" | "screen";
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<FormState>(makeDefaultFormState());
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [accountPickerMode, setAccountPickerMode] = useState<"source" | "dest" | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!formState) return;
    setDraft(formState);
  }, [formState]);

  useEffect(() => {
    if (!visible || !formState) return;
    let cancelled = false;
    async function load() {
      setLoadingData(true);
      try {
        const txKind = draft.txType === "transfer" ? null : draft.txType;
        const [accountRows, groupRows, categoryRows, subcategoryRows] = await Promise.all([
          listFinancialAccounts(userId, "active"),
          txKind ? listCategoryGroups(userId) : Promise.resolve([] as CategoryGroup[]),
          txKind ? listCategories(userId) : Promise.resolve([] as Category[]),
          txKind ? listSubcategories(userId, undefined, txKind) : Promise.resolve([] as Subcategory[]),
        ]);
        if (cancelled) return;
        setAccounts(accountRows);
        setGroups(groupRows);
        setCategories(categoryRows);
        setSubcategories(subcategoryRows);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    load().catch(() => {
      if (!cancelled) setLoadingData(false);
    });
    return () => { cancelled = true; };
  }, [visible, formState, userId, draft.txType]);

  useEffect(() => {
    if (draft.txType === "transfer") return;
    const currentSubcategory = draft.categorySelection.subcategoryId
      ? subcategories.find((item) => item.id === draft.categorySelection.subcategoryId) ?? null
      : null;
    const currentCategory = draft.categorySelection.categoryId
      ? categories.find((item) => item.id === draft.categorySelection.categoryId) ?? null
      : currentSubcategory?.category_id ? categories.find((item) => item.id === currentSubcategory.category_id) ?? null : null;
    const currentGroup = draft.categorySelection.groupId
      ? groups.find((item) => item.id === draft.categorySelection.groupId) ?? null
      : currentCategory ? groups.find((item) => item.id === currentCategory.category_group_id) ?? null : null;

    if (currentCategory || currentGroup || currentSubcategory) {
      if (currentGroup?.id !== draft.categorySelection.groupId || currentCategory?.id !== draft.categorySelection.categoryId) {
        setDraft((current) => ({
          ...current,
          categorySelection: {
            ...current.categorySelection,
            groupId: currentGroup?.id ?? current.categorySelection.groupId,
            categoryId: currentCategory?.id ?? current.categorySelection.categoryId,
          },
        }));
      }
      return;
    }

    if (subcategories.length > 0 && !draft.id) {
      const fallback = subcategories[0]!;
      const fallbackCategory = fallback.category_id ? categories.find((item) => item.id === fallback.category_id) ?? null : null;
      const fallbackGroup = fallbackCategory ? groups.find((item) => item.id === fallbackCategory.category_group_id) ?? null : null;
      setDraft((current) => ({
        ...current,
        categorySelection: {
          tier: "subcategory",
          groupId: fallbackGroup?.id ?? null,
          categoryId: fallbackCategory?.id ?? null,
          subcategoryId: fallback.id,
        },
      }));
    }
  }, [subcategories, categories, groups, draft]);

  if (!visible || !formState) return null;

  const isEdit = !!draft.id;
  const needsCategory = draft.txType !== "transfer";
  const dayOfMonthError = draft.schedule.dayOfMonth.trim() !== "" && parseDayOfMonth(draft.schedule.dayOfMonth) === null;
  const secondDayOfMonthError = draft.schedule.secondDayOfMonth.trim() !== "" && parseDayOfMonth(draft.schedule.secondDayOfMonth) === null;

  function getAccountName(id: string): string {
    return accounts.find((account) => account.id === id)?.name ?? "Select account";
  }

  function getPrimaryAccountLabel(): string {
    if (draft.txType === "income") return draft.destinationAccountId ? getAccountName(draft.destinationAccountId) : "Select account";
    return draft.sourceAccountId ? getAccountName(draft.sourceAccountId) : "Select account";
  }

  function getSelectedSubcategory(): Subcategory | null {
    return draft.categorySelection.subcategoryId
      ? subcategories.find((item) => item.id === draft.categorySelection.subcategoryId) ?? null
      : null;
  }

  function getSelectedCategory(): Category | null {
    if (draft.categorySelection.categoryId) {
      return categories.find((item) => item.id === draft.categorySelection.categoryId) ?? null;
    }
    const selectedSubcategory = getSelectedSubcategory();
    if (!selectedSubcategory?.category_id) return null;
    return categories.find((item) => item.id === selectedSubcategory.category_id) ?? null;
  }

  function getSelectedGroup(): CategoryGroup | null {
    if (draft.categorySelection.groupId) {
      return groups.find((item) => item.id === draft.categorySelection.groupId) ?? null;
    }
    const selectedCategory = getSelectedCategory();
    if (!selectedCategory) return null;
    return groups.find((item) => item.id === selectedCategory.category_group_id) ?? null;
  }

  function resolveEffectiveSubcategoryId(): string {
    if (draft.categorySelection.subcategoryId) return draft.categorySelection.subcategoryId;
    if (draft.categorySelection.categoryId) {
      return subcategories.find((item) => item.category_id === draft.categorySelection.categoryId)?.id ?? "";
    }
    if (draft.categorySelection.groupId) {
      const categoryIds = categories.filter((item) => item.category_group_id === draft.categorySelection.groupId).map((item) => item.id);
      return subcategories.find((item) => item.category_id && categoryIds.includes(item.category_id))?.id ?? "";
    }
    return "";
  }

  function getCategorySummaryLabel(): string {
    if (draft.categorySelection.tier === "subcategory") return getSelectedSubcategory()?.label ?? "Select category";
    if (draft.categorySelection.tier === "category") return getSelectedCategory()?.label ?? "Select category";
    if (draft.categorySelection.tier === "group") return getSelectedGroup()?.label ?? "Select category";
    return "Select category";
  }

  async function handleSave() {
    setFormError(null);
    const centavos = parseAmount(draft.amount);
    if (centavos <= 0) {
      setFormError("Enter a valid amount");
      return;
    }

    const effectiveSubcategoryId = resolveEffectiveSubcategoryId();
    if (draft.txType === "expense" && !draft.sourceAccountId) {
      setFormError("Select a source account");
      return;
    }
    if (draft.txType === "income" && !draft.destinationAccountId) {
      setFormError("Select a destination account");
      return;
    }
    if (draft.txType === "transfer" && (!draft.sourceAccountId || !draft.destinationAccountId)) {
      setFormError("Select both accounts");
      return;
    }
    if (needsCategory && !effectiveSubcategoryId) {
      setFormError("Select a category");
      return;
    }

    const dayOfMonth = parseDayOfMonth(draft.schedule.dayOfMonth);
    const secondDayOfMonth = parseDayOfMonth(draft.schedule.secondDayOfMonth);
    if (draft.schedule.dayOfMonth.trim() !== "" && dayOfMonth === null) {
      setFormError("Day of month must be between 1 and 31");
      return;
    }
    if (draft.schedule.secondDayOfMonth.trim() !== "" && secondDayOfMonth === null) {
      setFormError("Second day of month must be between 1 and 31");
      return;
    }

    const input = {
      transaction_type: draft.txType,
      name: draft.description.trim() || `${draft.txType} recurring`,
      amount_centavos: centavos,
      frequency: draft.schedule.frequency,
      interval_count: Number.parseInt(draft.schedule.intervalCount, 10) > 0 ? Number.parseInt(draft.schedule.intervalCount, 10) : undefined,
      day_of_month: dayOfMonth ?? undefined,
      second_day_of_month: secondDayOfMonth ?? undefined,
      day_of_week: draft.schedule.dayOfWeek ?? undefined,
      starts_on: formatDateValue(draft.startsOn),
      ends_on: draft.endsOn ? formatDateValue(draft.endsOn) : undefined,
      subcategory_id: effectiveSubcategoryId || undefined,
      source_account_id: draft.sourceAccountId || undefined,
      destination_account_id: draft.destinationAccountId || undefined,
      notes: draft.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (draft.id) {
        await updateRecurringTemplate(userId, deviceId, draft.id, input);
        showToast("Recurring transaction updated", "success");
      } else {
        await createRecurringTemplate(userId, deviceId, input);
        showToast("Recurring transaction created", "success");
      }
      await onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save recurring transaction");
    } finally {
      setSaving(false);
    }
  }

  const formBody = (
    <View style={{ backgroundColor: palette.shell, flex: 1, ...(presentation === "modal" ? { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.92 } : {}) }}>
      {presentation === "modal" ? <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} /> : null}
      <ScrollView contentContainerStyle={{ padding: 22, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" bounces={false}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink }}>
                    {isEdit ? "Edit Recurring Transaction" : "Add Recurring Transaction"}
                  </Text>

                  {loadingData ? (
                    <ActivityIndicator color={palette.brand} />
                  ) : (
                    <>
                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.ink2, marginBottom: 6 }}>
                          TYPE
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {TX_TYPES.map((type) => {
                            const selected = draft.txType === type;
                            return (
                              <Pressable
                                key={type}
                                onPress={() => setDraft((current) => ({ ...current, txType: type, categorySelection: { tier: null, groupId: null, categoryId: null, subcategoryId: null } }))}
                                accessibilityRole="radio"
                                accessibilityLabel={type}
                                accessibilityState={{ checked: selected }}
                                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: selected ? palette.brand : palette.card }}
                              >
                                <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: selected ? palette.white : palette.ink2 }}>{type}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 2 }}>
                        <Text style={{ fontFamily: "Manrope", fontSize: 15, color: palette.mut, marginBottom: 2 }}>PHP</Text>
                        <TextInput
                          value={draft.amount}
                          onChangeText={(amount) => setDraft((current) => ({ ...current, amount }))}
                          placeholder="0"
                          placeholderTextColor="#b9b39f"
                          keyboardType="decimal-pad"
                          style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 54, color: palette.ink, textAlign: "center", minWidth: 180, paddingVertical: 0 }}
                        />
                        <View style={{ width: 138, height: 2, borderRadius: 999, backgroundColor: palette.successTint, marginTop: 6 }} />
                      </View>

                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
                          {draft.txType === "income" ? "PAYER" : "DESCRIPTION"}
                        </Text>
                        <TextInput
                          value={draft.description}
                          onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
                          placeholder={draft.txType === "income" ? "Who pays you?" : draft.txType === "transfer" ? "What's this for?" : "Jollibee - Lunch"}
                          placeholderTextColor={palette.mut}
                          style={{ height: 58, borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", paddingHorizontal: 16, fontFamily: "Manrope", fontSize: 16, color: palette.ink, backgroundColor: palette.softCard }}
                        />
                      </View>

                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
                            START DATE
                          </Text>
                          <Pressable onPress={() => setShowDatePicker("start")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <CalendarBlank color={palette.mut} size={18} weight="regular" />
                              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: palette.ink }}>{formatDateValue(draft.startsOn)}</Text>
                            </View>
                          </Pressable>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
                            END DATE
                          </Text>
                          <Pressable onPress={() => setShowDatePicker("end")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                              <CalendarBlank color={palette.mut} size={18} weight="regular" />
                              <Text numberOfLines={1} style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: draft.endsOn ? palette.ink : palette.mut, flex: 1 }}>
                                {draft.endsOn ? formatDateValue(draft.endsOn) : "Optional"}
                              </Text>
                            </View>
                          </Pressable>
                          {draft.endsOn ? (
                            <Pressable onPress={() => setDraft((current) => ({ ...current, endsOn: null }))} style={{ marginTop: 6, alignSelf: "flex-start" }}>
                              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: palette.error }}>Clear end date</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>

                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
                          ACCOUNT
                        </Text>
                        <Pressable onPress={() => setAccountPickerMode(draft.txType === "income" ? "dest" : "source")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                            <Wallet color={palette.mut} size={18} weight="regular" />
                            <Text numberOfLines={1} style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: (draft.sourceAccountId || draft.destinationAccountId) ? palette.ink : palette.mut, flex: 1 }}>
                              {getPrimaryAccountLabel()}
                            </Text>
                          </View>
                          <CaretRight color={palette.mut} size={16} weight="bold" />
                        </Pressable>
                      </View>

                      {draft.txType === "transfer" ? (
                        <View>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
                            TO ACCOUNT
                          </Text>
                          <Pressable onPress={() => setAccountPickerMode("dest")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                              <Wallet color={palette.mut} size={18} weight="regular" />
                              <Text numberOfLines={1} style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: draft.destinationAccountId ? palette.ink : palette.mut, flex: 1 }}>
                                {draft.destinationAccountId ? getAccountName(draft.destinationAccountId) : "Select account"}
                              </Text>
                            </View>
                            <CaretRight color={palette.mut} size={16} weight="bold" />
                          </Pressable>
                        </View>
                      ) : null}

                      {needsCategory ? (
                        <View>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
                            CATEGORY
                          </Text>
                          <Pressable onPress={() => setShowCategoryPicker(true)} style={{ borderRadius: 16, borderWidth: 1, borderColor: draft.categorySelection.tier ? palette.successTint : "#e8deca", backgroundColor: draft.categorySelection.tier ? palette.successCard : palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View>
                              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: palette.ink }}>{getCategorySummaryLabel()}</Text>
                              <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut, marginTop: 4 }}>Open full list to view everything</Text>
                            </View>
                            <CaretRight color={palette.mut} size={16} weight="bold" />
                          </Pressable>
                        </View>
                      ) : null}

                      <RecurringScheduleFields
                        frequencies={["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly"]}
                        value={draft.schedule}
                        onChange={(schedule) => setDraft((current) => ({ ...current, schedule }))}
                        showIntervalCount
                        dayOfMonthError={dayOfMonthError}
                        secondDayOfMonthError={secondDayOfMonthError}
                      />

                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
                          NOTES
                        </Text>
                        <TextInput
                          value={draft.notes}
                          onChangeText={(notes) => setDraft((current) => ({ ...current, notes }))}
                          placeholder="Optional notes"
                          placeholderTextColor={palette.mut}
                          multiline
                          numberOfLines={3}
                          style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", paddingHorizontal: 16, paddingTop: 14, fontFamily: "Manrope", fontSize: 15, color: palette.ink, backgroundColor: palette.softCard, minHeight: 92, textAlignVertical: "top" }}
                        />
                      </View>

                      {formError ? (
                        <View style={{ backgroundColor: "#fff0f2", borderRadius: 14, padding: 12 }}>
                          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.error, fontWeight: "600" }}>{formError}</Text>
                        </View>
                      ) : null}

                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={onClose} disabled={saving} style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>Cancel</Text>
                        </Pressable>
                        <Pressable onPress={handleSave} disabled={saving} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.white }}>
                            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Recurring"}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  )}
      </ScrollView>

      {showDatePicker ? (
        <DateTimePicker
          value={showDatePicker === "start" ? draft.startsOn : draft.endsOn ?? draft.startsOn}
          mode="date"
          onChange={(_event, nextDate) => {
            setShowDatePicker(null);
            if (!nextDate) return;
            if (showDatePicker === "start") setDraft((current) => ({ ...current, startsOn: nextDate }));
            else setDraft((current) => ({ ...current, endsOn: nextDate }));
          }}
        />
      ) : null}

      <Modal visible={accountPickerMode !== null} transparent animationType="slide" onRequestClose={() => setAccountPickerMode(null)}>
        <Pressable onPress={() => setAccountPickerMode(null)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
              <Pressable onPress={() => {}}>
                <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.85 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
                  <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled" bounces={false}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: palette.ink }}>
                      {accountPickerMode === "source" ? "From account" : "To account"}
                    </Text>
                    {accounts.map((account) => {
                      const selected = accountPickerMode === "source" ? draft.sourceAccountId === account.id : draft.destinationAccountId === account.id;
                      return (
                        <Pressable
                          key={account.id}
                          onPress={() => {
                            if (accountPickerMode === "source") setDraft((current) => ({ ...current, sourceAccountId: account.id }));
                            else setDraft((current) => ({ ...current, destinationAccountId: account.id }));
                            setAccountPickerMode(null);
                          }}
                          style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: selected ? palette.brand : palette.line, backgroundColor: selected ? palette.successCard : palette.card }}
                        >
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }}>{account.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <Pressable onPress={() => setShowCategoryPicker(false)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
              <Pressable onPress={() => {}}>
                <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.85 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
                  <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" bounces={false}>
                    <CategorySelectorTree
                      groups={groups}
                      categories={categories}
                      subcategories={subcategories}
                      selection={draft.categorySelection}
                      onSelect={(categorySelection) => {
                        setDraft((current) => ({ ...current, categorySelection }));
                        setShowCategoryPicker(false);
                      }}
                      emptyMessage="No categories found for this transaction type."
                    />
                  </ScrollView>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );

  if (presentation === "screen") {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: palette.shell }}>
        {formBody}
      </KeyboardAvoidingView>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <Pressable onPress={() => {}}>
              {formBody}
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Pressable>
    </Modal>
  );
}

export function AddRecurringTransactionScreen({ userId, deviceId, onBack, onSyncRequested }: { userId: string; deviceId: string; onBack: () => void; onSyncRequested?: () => void }) {
  return (
    <RecurringTemplateFormModal
      visible
      userId={userId}
      deviceId={deviceId}
      formState={makeDefaultFormState()}
      onClose={onBack}
      onSaved={async () => {
        onSyncRequested?.();
        onBack();
      }}
      presentation="screen"
    />
  );
}
