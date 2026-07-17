import { useCallback, useEffect, useState } from "react";
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
import {
  CalendarBlank,
  CaretLeft,
  Plus,
  PencilSimple,
  TrashSimple,
  ShieldCheck,
  Gear,
  LinkSimple,
} from "phosphor-react-native";
import {
  listFinancialObligations,
  createFinancialObligation,
  updateFinancialObligation,
  deleteFinancialObligation,
  type FinancialObligation,
  type CreateFinancialObligationInput,
  type ObligationFrequency,
  listIncomeSources,
} from "../../local-db/repositories/financialFoundations";
import { listCategoryGroups, listCategories, listSubcategories, type Category, type CategoryGroup, type Subcategory } from "../../local-db/repositories/taxonomy";
import { CategorySelectorTree, type CategorySelection } from "../../components/CategorySelector";
import { listRecurringTemplates, deleteRecurringTemplate, type RecurringTemplate } from "../../local-db/repositories/recurringTransactions";
import { linkObligationToRecurringTemplate } from "../../local-db/repositories/financialFoundations";
import AutomateObligationSheet from "./components/AutomateObligationSheet";

const P = {
  shell: "#fcf8f0", brand: "#013220", brandMedium: "#0E6D46",
  ink: "#1B1C1A", ink2: "#414942", muted: "#6B7A6F",
  line: "#EAEAE6", error: "#D9001F", card: "#F1F0EB", white: "#FFFFFF",
};

const FREQUENCIES: readonly ObligationFrequency[] = ["weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const sign = pesos < 0 ? "-" : "";
  const formatted = `${sign}₱${Math.abs(pesos).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return formatted.length > 23 ? formatted.slice(0, 20) + "..." : formatted;
}

function parseSafeCents(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.length > 15) return null;
  const p = parseFloat(t);
  if (!Number.isFinite(p)) return null;
  const cents = Math.round(p * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

function parseDayOfMonth(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  return n;
}

type Props = { userId: string; deviceId: string; onBack: () => void; onSyncRequested?: () => void };

export default function FinancialObligationsScreen({ userId, deviceId, onBack, onSyncRequested }: Props) {
  const [obligations, setObligations] = useState<FinancialObligation[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<FinancialObligation | null>(null);
  const [automateTarget, setAutomateTarget] = useState<FinancialObligation | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, "automating" | "deleting">>({});
  const [defaultFrequency, setDefaultFrequency] = useState<ObligationFrequency>("monthly");

  const load = useCallback(async () => {
    const [obs, subs, incomes, tmpls] = await Promise.all([
      listFinancialObligations(userId),
      listSubcategories(userId, undefined, "expense"),
      listIncomeSources(userId),
      listRecurringTemplates(userId),
    ]);
    setObligations(obs);
    setSubcategories(subs);
    setTemplates(tmpls);
    if (incomes.length > 0 && incomes[0]) {
      const freq = incomes[0].frequency as ObligationFrequency;
      if (FREQUENCIES.includes(freq)) setDefaultFrequency(freq);
    }
    setLoading(false);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (input: CreateFinancialObligationInput) => {
    await createFinancialObligation(userId, deviceId, input);
    setSheetVisible(false); await load();
    onSyncRequested?.();
  };
  const handleUpdate = async (input: CreateFinancialObligationInput) => {
    if (!editing) return;
    await updateFinancialObligation(userId, deviceId, editing.id, input);
    setSheetVisible(false); setEditing(null); await load();
    onSyncRequested?.();
  };
  const handleDelete = (o: FinancialObligation) => {
    Alert.alert(`Delete ${o.name}?`, "This obligation will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteFinancialObligation(userId, deviceId, o.id); await load(); onSyncRequested?.(); } },
    ]);
  };

  const handleAutomate = (o: FinancialObligation) => {
    setAutomateTarget(o);
  };

  const handleUnlink = (o: FinancialObligation) => {
    const templateId = o.recurringTemplateId;
    if (!templateId) return;

    Alert.alert(`Delete "${o.name}" Recurring?`, "The automated transaction and its link to this obligation will be deleted. This does not delete past transactions.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          setPendingActions((prev) => ({ ...prev, [o.id]: "deleting" }));
          try {
            await linkObligationToRecurringTemplate(userId, deviceId, o.id, null);
            await deleteRecurringTemplate(userId, deviceId, templateId);
            await load();
            onSyncRequested?.();
          } finally {
            setPendingActions((prev) => { const n = { ...prev }; delete n[o.id]; return n; });
          }
        },
      },
    ]);
  };

  const getSubcategoryName = (id: string) => subcategories.find((s) => s.id === id)?.label ?? id;

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>Obligations</Text>
        <TouchableOpacity onPress={() => { setEditing(null); setSheetVisible(true); }} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: P.brand, alignItems: "center", justifyContent: "center" }}>
          <Plus size={18} color={P.white} weight="bold" />
        </TouchableOpacity>
      </View>
      {loading ? null : obligations.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <ShieldCheck size={40} color={P.muted} />
          <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Manrope", color: P.muted }}>No obligations yet</Text>
          <Text style={{ marginTop: 4, fontSize: 13, fontFamily: "Manrope", color: P.muted }}>Tap + to add your first obligation</Text>
        </View>
      ) : (
        obligations.map((o) => {
          const linkedTemplate = o.recurringTemplateId
            ? templates.find((t) => t.id === o.recurringTemplateId) ?? null
            : null;
          const action = pendingActions[o.id];
          return (
          <View key={o.id} style={{ backgroundColor: P.white, borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: P.line }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: P.card, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <CalendarBlank size={22} color={P.brandMedium} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Manrope", fontWeight: "600", color: P.ink }}>{o.name}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Manrope", color: P.muted, marginTop: 2 }}>
                  {getSubcategoryName(o.subcategoryId)} · {o.frequency} · {formatPeso(o.amountCentavos)}
                  {o.dueDayOfMonth != null ? ` · due ${o.dueDayOfMonth}` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setEditing(o); setSheetVisible(true); }} hitSlop={8} style={{ padding: 6 }}>
                <PencilSimple size={16} color={P.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(o)} hitSlop={8} style={{ padding: 6, marginLeft: 4 }}>
                <TrashSimple size={16} color={P.error} />
              </TouchableOpacity>
            </View>
            {linkedTemplate ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: P.line }}>
                <LinkSimple size={14} color={P.brandMedium} style={{ marginRight: 6 }} />
                <Text style={{ flex: 1, fontSize: 12, fontFamily: "Manrope", color: P.ink2 }}>
                  Automated: {linkedTemplate.name}{linkedTemplate.next_occurrence_date ? ` · next ${linkedTemplate.next_occurrence_date}` : ""}
                </Text>
                <TouchableOpacity
                  onPress={() => handleUnlink(o)}
                  disabled={action === "deleting"}
                  hitSlop={8}
                  style={{ padding: 4, opacity: action === "deleting" ? 0.5 : 1 }}
                >
                  <TrashSimple size={14} color={P.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleAutomate(o)}
                disabled={action === "automating"}
                style={{ flexDirection: "row", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: P.line, opacity: action === "automating" ? 0.5 : 1 }}
              >
                <Gear size={14} color={P.brandMedium} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, fontFamily: "Manrope", fontWeight: "600", color: P.brandMedium }}>
                  {action === "automating" ? "Automating…" : "Automate this obligation"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          );
        })
      )}
      <ObligationFormSheet visible={sheetVisible} editing={editing} subcategories={subcategories} defaultFrequency={defaultFrequency} userId={userId} onClose={() => { setSheetVisible(false); setEditing(null); }} onSubmit={editing ? handleUpdate : handleCreate} />
      <AutomateObligationSheet
        visible={automateTarget !== null}
        obligation={automateTarget}
        subcategories={subcategories}
        userId={userId}
        deviceId={deviceId}
        onClose={() => setAutomateTarget(null)}
        onComplete={() => {
          setAutomateTarget(null);
          load();
          onSyncRequested?.();
        }}
      />
    </>
  );
}

function ObligationFormSheet({ visible, editing, subcategories, defaultFrequency, userId, onClose, onSubmit }: { visible: boolean; editing: FinancialObligation | null; subcategories: Subcategory[]; defaultFrequency: ObligationFrequency; userId: string; onClose: () => void; onSubmit: (input: CreateFinancialObligationInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [subcategoryId, setSubcategoryId] = useState(subcategories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ObligationFrequency>(defaultFrequency);
  const [dueDay, setDueDay] = useState("");
  const [dueSecondDay, setDueSecondDay] = useState("");
  const [dueDayOfWeek, setDueDayOfWeek] = useState<number | null>(null);
  const [dueSecondDayOfWeek, setDueSecondDayOfWeek] = useState<number | null>(null);
  const [dueMonth, setDueMonth] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [pickerGroups, setPickerGroups] = useState<CategoryGroup[]>([]);
  const [pickerCategories, setPickerCategories] = useState<Category[]>([]);
  const [pickerSubcategories, setPickerSubcategories] = useState<Subcategory[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [categorySelection, setCategorySelection] = useState<CategorySelection>({ tier: null, groupId: null, categoryId: null, subcategoryId: null });
  const isEdit = editing !== null;

  useEffect(() => {
    if (editing) {
      setName(editing.name); setSubcategoryId(editing.subcategoryId); setFrequency(editing.frequency);
      setAmount(String(editing.amountCentavos / 100));
      setDueDay(editing.dueDayOfMonth != null ? String(editing.dueDayOfMonth) : "");
      setDueSecondDay(editing.dueSecondDayOfMonth != null ? String(editing.dueSecondDayOfMonth) : "");
      setDueDayOfWeek(editing.dueDayOfWeek);
      setDueSecondDayOfWeek(editing.dueSecondDayOfWeek);
      setDueMonth(editing.dueMonth);
      setNotes(editing.notes ?? "");
    } else {
      setName(""); setSubcategoryId(subcategories[0]?.id ?? ""); setFrequency("monthly"); setAmount("");
      setDueDay(""); setDueSecondDay("");
      setDueDayOfWeek(null); setDueSecondDayOfWeek(null); setDueMonth(null); setNotes("");
      setFrequency(defaultFrequency);
    }
    setFormError(null);
  }, [editing]);

  useEffect(() => {
    if (!showCategoryPicker) return;

    let cancelled = false;
    async function load() {
      setPickerLoading(true);
      const [gs, cs, subs] = await Promise.all([
        listCategoryGroups(userId),
        listCategories(userId),
        listSubcategories(userId, undefined, "expense"),
      ]);
      if (cancelled) return;
      setPickerGroups(gs);
      setPickerCategories(cs);
      setPickerSubcategories(subs);
      setPickerLoading(false);
    }
    load().catch(() => { if (cancelled) return; setPickerLoading(false); });
    return () => { cancelled = true; };
  }, [showCategoryPicker, userId]);

  const amountInvalid = amount.trim() !== "" && parseSafeCents(amount) === null;
  const dueDayInvalid = dueDay.trim() !== "" && parseDayOfMonth(dueDay) === null;
  const dueSecondDayInvalid = dueSecondDay.trim() !== "" && (
    parseDayOfMonth(dueSecondDay) === null || (frequency === "semi_monthly" && dueDay.trim() !== "" && dueSecondDay.trim() === dueDay.trim())
  );

  const showDayOfMonth = frequency === "monthly" || frequency === "semi_monthly";
  const showDayOfWeek = frequency === "weekly" || frequency === "biweekly";

  const handleSubmit = async () => {
    setFormError(null);
    const errors: string[] = [];

    if (!name.trim()) errors.push("Name is required.");
    if (!subcategoryId) errors.push("Please select a subcategory.");

    const cents = parseSafeCents(amount);
    if (!amount.trim()) errors.push("Amount is required.");
    else if (cents === null) errors.push("Amount must be a valid number.");
    else if (cents < 0) errors.push("Amount must be >= 0.");

    if (dueDay.trim() && parseDayOfMonth(dueDay) === null) errors.push("Due day must be 1-31.");

    if (frequency === "semi_monthly" && dueDay.trim() && dueSecondDay.trim() && dueSecondDay.trim() === dueDay.trim()) {
      errors.push("Second due day must differ from the first.");
    }
    if (frequency === "biweekly" && dueDayOfWeek === dueSecondDayOfWeek && dueDayOfWeek !== null) {
      errors.push("Second due day of week must differ from the first.");
    }

    if (errors.length > 0) { setFormError(errors.join("\n")); return; }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(), subcategoryId, amountCentavos: cents!, frequency,
        dueDayOfMonth: showDayOfMonth ? parseDayOfMonth(dueDay) : null,
        dueSecondDayOfMonth: frequency === "semi_monthly" ? parseDayOfMonth(dueSecondDay) : null,
        dueDayOfWeek: showDayOfWeek ? dueDayOfWeek : null,
        dueSecondDayOfWeek: frequency === "biweekly" ? dueSecondDayOfWeek : null,
        dueMonth: frequency === "yearly" ? dueMonth : null,
        notes: notes.trim() || null,
      });
    } catch (err) { setFormError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSaving(false); }
  };

  function renderCategoryPickerPage() {
    const selectedSub = categorySelection.subcategoryId
      ? pickerSubcategories.find((s) => s.id === categorySelection.subcategoryId) ?? null
      : null;
    const selectedCat = selectedSub?.category_id
      ? pickerCategories.find((c) => c.id === selectedSub.category_id) ?? null
      : null;
    const selectedGrp = selectedCat
      ? pickerGroups.find((g) => g.id === selectedCat.category_group_id) ?? null
      : null;
    const hasSelection = selectedGrp || selectedCat || selectedSub;
    const summaryLabel = [selectedGrp?.label, selectedCat?.label, selectedSub?.label].filter(Boolean).join(" · ");

    return (
      <View style={{ flex: 1 }}>
        {hasSelection ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: "#20c277", backgroundColor: "#effff6", padding: 14, marginBottom: 18 }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: "600", color: "#20c277", letterSpacing: 0.4, marginBottom: 4 }}>
              CURRENT SELECTION
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: P.ink }}>
              {summaryLabel}
            </Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          <CategorySelectorTree
            groups={pickerGroups}
            categories={pickerCategories}
            subcategories={pickerSubcategories}
            selection={categorySelection}
            onSelect={(nextSelection) => {
              setCategorySelection(nextSelection);
              if (nextSelection.subcategoryId) {
                setSubcategoryId(nextSelection.subcategoryId);
                setShowCategoryPicker(false);
              }
            }}
            emptyMessage="No categories found for this transaction type."
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: P.shell, maxHeight: "100%", overflow: "hidden" }}>
                {showCategoryPicker ? (
                  <View style={{ padding: 22, gap: 8, minHeight: Dimensions.get("window").height * 0.75 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <Pressable onPress={() => setShowCategoryPicker(false)} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <CaretLeft color={P.ink} size={22} weight="bold" />
                        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: P.ink }}>
                          Select Category
                        </Text>
                      </Pressable>
                    </View>
                    {pickerLoading ? (
                      <View style={{ alignItems: "center", paddingVertical: 30 }}>
                        <ActivityIndicator color={P.ink2} />
                      </View>
                    ) : (
                      renderCategoryPickerPage()
                    )}
                  </View>
                ) : (
                  <>
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.line, alignSelf: "center", marginTop: 10 }} />
                    <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled" bounces={false}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
                        {isEdit ? "Edit Obligation" : "Add Obligation"}
                      </Text>

                      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>
                        Fields marked with (*) are required
                      </Text>

                      <Pressable onPress={() => setShowCategoryPicker(true)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: P.card, borderWidth: 1, borderColor: P.line }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 4 }}>
                            CATEGORY <Text style={{ color: P.error }}>*</Text>
                          </Text>
                          <Text style={{ fontFamily: "Manrope", fontSize: 14, color: subcategoryId ? P.ink : P.muted }}>
                            {subcategoryId ? subcategories.find((s) => s.id === subcategoryId)?.label ?? "Unknown" : "Select Category"}
                          </Text>
                        </View>
                        <View style={{ marginLeft: 8 }}>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.muted }}>{">"}</Text>
                        </View>
                      </Pressable>

                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                          NAME <Text style={{ color: P.error }}>*</Text>
                        </Text>
                        <TextInput
                          value={name}
                          onChangeText={setName}
                          placeholder="e.g. Rent"
                          placeholderTextColor={P.muted}
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </View>

                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                          AMOUNT (₱) <Text style={{ color: P.error }}>*</Text>
                        </Text>
                        <TextInput
                          value={amount}
                          onChangeText={setAmount}
                          placeholder="0.00"
                          placeholderTextColor={P.muted}
                          keyboardType="decimal-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: amountInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </View>

                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                          FREQUENCY <Text style={{ color: P.error }}>*</Text>
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {FREQUENCIES.map((f) => (
                            <Pressable
                              key={f}
                              onPress={() => setFrequency(f)}
                              accessibilityRole="radio"
                              accessibilityLabel={f}
                              accessibilityState={{ checked: frequency === f }}
                              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: frequency === f ? P.brand : P.card }}
                            >
                              <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: frequency === f ? P.white : P.ink2 }}>{f}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {frequency === "monthly" && (
                        <View>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                            DUE DAY OF MONTH
                          </Text>
                          <TextInput
                            value={dueDay}
                            onChangeText={setDueDay}
                            placeholder="1"
                            placeholderTextColor={P.muted}
                            keyboardType="number-pad"
                            style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dueDayInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                          />
                        </View>
                      )}

                      {frequency === "semi_monthly" && (
                        <>
                          <View>
                            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                              1ST DUE DAY OF MONTH
                            </Text>
                            <TextInput
                              value={dueDay}
                              onChangeText={setDueDay}
                              placeholder="1"
                              placeholderTextColor={P.muted}
                              keyboardType="number-pad"
                              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dueDayInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                            />
                          </View>
                          <View>
                            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                              2ND DUE DAY OF MONTH
                            </Text>
                            <TextInput
                              value={dueSecondDay}
                              onChangeText={setDueSecondDay}
                              placeholder="15"
                              placeholderTextColor={P.muted}
                              keyboardType="number-pad"
                              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dueSecondDayInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                            />
                          </View>
                        </>
                      )}

                      {showDayOfWeek && (
                        <>
                          <View>
                            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                              {frequency === "biweekly" ? "1ST DUE DAY OF WEEK" : "DUE DAY OF WEEK"}
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              {WEEKDAYS.map((day, idx) => (
                                <Pressable
                                  key={day}
                                  onPress={() => setDueDayOfWeek(idx)}
                                  accessibilityRole="radio"
                                  accessibilityLabel={day}
                                  accessibilityState={{ checked: dueDayOfWeek === idx }}
                                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: dueDayOfWeek === idx ? P.brand : P.card }}
                                >
                                  <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: dueDayOfWeek === idx ? P.white : P.ink2 }}>{day}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                           {frequency === "biweekly" && (
                             <View>
                               <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                                 2ND DUE DAY OF WEEK
                               </Text>
                               <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                 {WEEKDAYS.map((day, idx) => {
                                   const isFirst = idx === dueDayOfWeek;
                                   return (
                                   <Pressable
                                     key={day}
                                     onPress={() => { if (!isFirst) setDueSecondDayOfWeek(idx); }}
                                     accessibilityRole="radio"
                                     accessibilityLabel={day}
                                     accessibilityState={{ checked: dueSecondDayOfWeek === idx, disabled: isFirst }}
                                     style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: dueSecondDayOfWeek === idx ? P.brand : P.card, opacity: isFirst ? 0.35 : 1 }}
                                   >
                                     <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: dueSecondDayOfWeek === idx ? P.white : P.ink2 }}>{day}</Text>
                                   </Pressable>
                                   );
                                 })}
                               </View>
                             </View>
                           )}
                        </>
                      )}

                      {frequency === "quarterly" && (
                        <View>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                            DUE DAY OF THE MONTH (EVERY QUARTER)
                          </Text>
                          <TextInput
                            value={dueDay}
                            onChangeText={setDueDay}
                            placeholder="15"
                            placeholderTextColor={P.muted}
                            keyboardType="number-pad"
                            style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dueDayInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                          />
                        </View>
                      )}

                      {frequency === "yearly" && (
                        <>
                          <View>
                            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                              DUE MONTH
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              {MONTHS.map((m, idx) => (
                                <Pressable
                                  key={m}
                                  onPress={() => setDueMonth(idx + 1)}
                                  accessibilityRole="radio"
                                  accessibilityLabel={m}
                                  accessibilityState={{ checked: dueMonth === idx + 1 }}
                                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: dueMonth === idx + 1 ? P.brand : P.card }}
                                >
                                  <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: dueMonth === idx + 1 ? P.white : P.ink2 }}>{m}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                          <View>
                            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                              DUE DAY OF MONTH
                            </Text>
                            <TextInput
                              value={dueDay}
                              onChangeText={setDueDay}
                              placeholder="15"
                              placeholderTextColor={P.muted}
                              keyboardType="number-pad"
                              style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: dueDayInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                            />
                          </View>
                        </>
                      )}

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
                          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.white }}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Add Obligation"}</Text>
                        </Pressable>
                      </View>
                    </ScrollView>
                  </>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Pressable>
    </Modal>
  );
}
