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
  CurrencyDollar,
  PencilSimple,
  Plus,
  TrashSimple,
  TrendUp,
} from "phosphor-react-native";
import {
  listIncomeSources,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
  type IncomeSource,
  type CreateIncomeSourceInput,
  type IncomeType,
  type IncomeFrequency,
} from "../../local-db/repositories/financialFoundations";

const P = {
  shell: "#fcf8f0", brand: "#013220", brandMedium: "#0E6D46",
  ink: "#1B1C1A", ink2: "#414942", muted: "#6B7A6F",
  line: "#EAEAE6", error: "#D9001F", card: "#F1F0EB", white: "#FFFFFF",
};

const INCOME_TYPES: readonly IncomeType[] = ["stable", "variable"];
const FREQUENCIES: readonly IncomeFrequency[] = ["weekly", "biweekly", "semi_monthly", "monthly", "irregular", "custom"];

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

export default function IncomeSourcesScreen({ userId, deviceId, onBack, onSyncRequested }: Props) {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<IncomeSource | null>(null);

  const load = useCallback(async () => {
    setSources(await listIncomeSources(userId));
    setLoading(false);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const MONTHLY_MULTIPLIER: Record<string, number> = {
    weekly: 4.33,
    biweekly: 2.17,
    semi_monthly: 2,
    monthly: 1,
    irregular: 1,
    custom: 1,
  };

  const totalMonthly = sources.reduce((sum, s) => {
    const amount = s.expectedAmountCentavos ?? 0;
    const multiplier = MONTHLY_MULTIPLIER[s.frequency] ?? 1;
    return sum + Math.round(amount * multiplier);
  }, 0);

  const handleCreate = async (input: CreateIncomeSourceInput) => {
    await createIncomeSource(userId, deviceId, input);
    setSheetVisible(false); await load();
    onSyncRequested?.();
  };
  const handleUpdate = async (input: CreateIncomeSourceInput) => {
    if (!editing) return;
    await updateIncomeSource(userId, deviceId, editing.id, input);
    setSheetVisible(false); setEditing(null); await load();
    onSyncRequested?.();
  };
  const handleDelete = (s: IncomeSource) => {
    Alert.alert(`Delete ${s.name}?`, "This income source will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteIncomeSource(userId, deviceId, s.id); await load(); onSyncRequested?.(); } },
    ]);
  };

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>Income Sources</Text>
        <TouchableOpacity onPress={() => { setEditing(null); setSheetVisible(true); }} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: P.brand, alignItems: "center", justifyContent: "center" }}>
          <Plus size={18} color={P.white} weight="bold" />
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: P.brand, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontFamily: "Manrope", fontWeight: "600", color: "#41EDA4", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Total Monthly Income</Text>
        <Text style={{ fontSize: 28, fontFamily: "Manrope", fontWeight: "700", color: P.white }}>{formatPeso(totalMonthly)}</Text>
      </View>
      {loading ? null : sources.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <TrendUp size={40} color={P.muted} />
          <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Manrope", color: P.muted }}>No income sources yet</Text>
          <Text style={{ marginTop: 4, fontSize: 13, fontFamily: "Manrope", color: P.muted }}>Tap + to add your first income source</Text>
        </View>
      ) : (
        sources.map((s) => (
          <View key={s.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: P.white, borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: P.line }}>
            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: P.card, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <CurrencyDollar size={22} color={P.brandMedium} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Manrope", fontWeight: "600", color: P.ink }}>{s.name}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Manrope", color: P.muted, marginTop: 2 }}>{s.incomeType} · {s.frequency}{s.expectedAmountCentavos != null ? ` · ${formatPeso(s.expectedAmountCentavos)}` : ""}</Text>
            </View>
            <TouchableOpacity onPress={() => { setEditing(s); setSheetVisible(true); }} hitSlop={8} style={{ padding: 6 }}>
              <PencilSimple size={16} color={P.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(s)} hitSlop={8} style={{ padding: 6, marginLeft: 4 }}>
              <TrashSimple size={16} color={P.error} />
            </TouchableOpacity>
          </View>
        ))
      )}
      <IncomeFormSheet visible={sheetVisible} editing={editing} onClose={() => { setSheetVisible(false); setEditing(null); }} onSubmit={editing ? handleUpdate : handleCreate} />
    </>
  );
}

function IncomeFormSheet({ visible, editing, onClose, onSubmit }: { visible: boolean; editing: IncomeSource | null; onClose: () => void; onSubmit: (input: CreateIncomeSourceInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [incomeType, setIncomeType] = useState<IncomeType>("stable");
  const [frequency, setFrequency] = useState<IncomeFrequency>("monthly");
  const [expected, setExpected] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [paydayDayOfMonth, setPaydayDayOfMonth] = useState("");
  const [paydaySecondDayOfMonth, setPaydaySecondDayOfMonth] = useState("");
  const [paydayDayOfWeek, setPaydayDayOfWeek] = useState<number | null>(null);
  const [paydaySecondDayOfWeek, setPaydaySecondDayOfWeek] = useState<number | null>(null);
  const [intervalDays, setIntervalDays] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = editing !== null;

  const paydayMonthInvalid = paydayDayOfMonth.trim() !== "" && parseDayOfMonth(paydayDayOfMonth) === null;
  const paydaySecondMonthInvalid = paydaySecondDayOfMonth.trim() !== "" && parseDayOfMonth(paydaySecondDayOfMonth) === null;
  const intervalInvalid = intervalDays.trim() !== "" && (isNaN(parseInt(intervalDays, 10)) || parseInt(intervalDays, 10) < 1);

  useEffect(() => {
    if (editing) {
      setName(editing.name); setIncomeType(editing.incomeType); setFrequency(editing.frequency);
      setExpected(editing.expectedAmountCentavos != null ? String(editing.expectedAmountCentavos / 100) : "");
      setMin(editing.minAmountCentavos != null ? String(editing.minAmountCentavos / 100) : "");
      setMax(editing.maxAmountCentavos != null ? String(editing.maxAmountCentavos / 100) : "");
      setPaydayDayOfMonth(editing.paydayDayOfMonth != null ? String(editing.paydayDayOfMonth) : "");
      setPaydaySecondDayOfMonth(editing.paydaySecondDayOfMonth != null ? String(editing.paydaySecondDayOfMonth) : "");
      setPaydayDayOfWeek(editing.paydayDayOfWeek);
      setPaydaySecondDayOfWeek(editing.paydaySecondDayOfWeek);
      setIntervalDays(editing.estimatedIntervalDays != null ? String(editing.estimatedIntervalDays) : "");
      setNotes(editing.notes ?? "");
    } else {
      setName(""); setIncomeType("stable"); setFrequency("monthly");
      setExpected(""); setMin(""); setMax("");
      setPaydayDayOfMonth(""); setPaydaySecondDayOfMonth("");
      setPaydayDayOfWeek(null); setPaydaySecondDayOfWeek(null); setIntervalDays(""); setNotes("");
    }
    setFormError(null);
  }, [editing]);

  useEffect(() => {
    if (incomeType === "variable") setFrequency("irregular");
  }, [incomeType]);

  const handleSubmit = async () => {
    setFormError(null);
    const errors: string[] = [];

    if (!name.trim()) errors.push("Name is required.");

    const e = parseSafeCents(expected);
    const mn = parseSafeCents(min);
    const mx = parseSafeCents(max);

    if (expected.trim() && e === null) errors.push("Expected Amount must be a valid number.");
    if (min.trim() && mn === null) errors.push("Min Amount must be a valid number.");
    if (max.trim() && mx === null) errors.push("Max Amount must be a valid number.");
    if (mn !== null && mx !== null && mn > mx) errors.push("Min must be <= max.");

    if ((frequency === "monthly" || frequency === "semi_monthly") && paydayDayOfMonth.trim()) {
      const d1 = parseDayOfMonth(paydayDayOfMonth);
      if (d1 === null) errors.push("Payday must be between 1 and 31.");
    }
    if (frequency === "semi_monthly" && paydaySecondDayOfMonth.trim()) {
      const d2 = parseDayOfMonth(paydaySecondDayOfMonth);
      if (d2 === null) errors.push("Second payday must be between 1 and 31.");
    }

    if (frequency === "irregular") {
      const interval = parseInt(intervalDays, 10);
      if (intervalDays.trim() && (isNaN(interval) || interval < 1)) {
        errors.push("Estimated days must be a positive number.");
      }
    }

    if (errors.length > 0) { setFormError(errors.join("\n")); return; }

    const interval = parseInt(intervalDays, 10);

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        incomeType,
        frequency,
        expectedAmountCentavos: e,
        minAmountCentavos: mn,
        maxAmountCentavos: mx,
        paydayDayOfMonth: frequency === "monthly" || frequency === "semi_monthly" ? parseDayOfMonth(paydayDayOfMonth) : null,
        paydaySecondDayOfMonth: frequency === "semi_monthly" ? parseDayOfMonth(paydaySecondDayOfMonth) : null,
        paydayDayOfWeek: frequency === "weekly" || frequency === "biweekly" ? paydayDayOfWeek : null,
        paydaySecondDayOfWeek: frequency === "biweekly" ? paydaySecondDayOfWeek : null,
        estimatedIntervalDays: frequency === "irregular" && interval >= 1 ? interval : null,
        notes: notes.trim() || null,
      });
    } catch (err) { setFormError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSaving(false); }
  };

  const showDayOfMonth = frequency === "monthly" || frequency === "semi_monthly";
  const showDayOfWeek = frequency === "weekly" || frequency === "biweekly";

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
                    {isEdit ? "Edit Income Source" : "Add Income Source"}
                  </Text>

                  <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>
                    Fields marked with (*) are required
                  </Text>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      NAME <Text style={{ color: P.error }}>*</Text>
                    </Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Salary"
                      placeholderTextColor={P.muted}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      TYPE <Text style={{ color: P.error }}>*</Text>
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {INCOME_TYPES.map((t) => (
                        <Pressable
                          key={t}
                          onPress={() => setIncomeType(t)}
                          accessibilityRole="radio"
                          accessibilityLabel={t}
                          accessibilityState={{ checked: incomeType === t }}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: incomeType === t ? P.brand : P.card }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: incomeType === t ? P.white : P.ink2 }}>{t}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      FREQUENCY <Text style={{ color: P.error }}>*</Text>
                    </Text>
                    {incomeType === "variable" ? (
                      <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.ink, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: P.brand }}>
                        <Text style={{ color: P.white, fontWeight: "600" }}>irregular</Text>
                      </Text>
                    ) : (
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
                    )}
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      EXPECTED AMOUNT (₱)
                    </Text>
                    <TextInput
                      value={expected}
                      onChangeText={setExpected}
                      placeholder="0.00"
                      placeholderTextColor={P.muted}
                      keyboardType="decimal-pad"
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      MIN AMOUNT (₱)
                    </Text>
                    <TextInput
                      value={min}
                      onChangeText={setMin}
                      placeholder="0.00"
                      placeholderTextColor={P.muted}
                      keyboardType="decimal-pad"
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                      MAX AMOUNT (₱)
                    </Text>
                    <TextInput
                      value={max}
                      onChangeText={setMax}
                      placeholder="0.00"
                      placeholderTextColor={P.muted}
                      keyboardType="decimal-pad"
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                    />
                  </View>

                  {frequency === "monthly" && (
                    <View>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                        PAYDAY (DAY OF MONTH)
                      </Text>
                      <TextInput
                        value={paydayDayOfMonth}
                        onChangeText={setPaydayDayOfMonth}
                        placeholder="15"
                        placeholderTextColor={P.muted}
                        keyboardType="number-pad"
                        style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: paydayMonthInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                      />
                    </View>
                  )}

                  {frequency === "semi_monthly" && (
                    <>
                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                          1ST PAYDAY (DAY OF MONTH)
                        </Text>
                        <TextInput
                          value={paydayDayOfMonth}
                          onChangeText={setPaydayDayOfMonth}
                          placeholder="15"
                          placeholderTextColor={P.muted}
                          keyboardType="number-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: paydayMonthInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </View>
                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                          2ND PAYDAY (DAY OF MONTH)
                        </Text>
                        <TextInput
                          value={paydaySecondDayOfMonth}
                          onChangeText={setPaydaySecondDayOfMonth}
                          placeholder="30"
                          placeholderTextColor={P.muted}
                          keyboardType="number-pad"
                          style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: paydaySecondMonthInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                        />
                      </View>
                    </>
                  )}

                  {showDayOfWeek && (
                    <>
                      <View>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                          {frequency === "biweekly" ? "1ST PAYDAY (DAY OF WEEK)" : "PAYDAY (DAY OF WEEK)"}
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {WEEKDAYS.map((day, idx) => (
                            <Pressable
                              key={day}
                              onPress={() => setPaydayDayOfWeek(idx)}
                              accessibilityRole="radio"
                              accessibilityLabel={day}
                              accessibilityState={{ checked: paydayDayOfWeek === idx }}
                              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: paydayDayOfWeek === idx ? P.brand : P.card }}
                            >
                              <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: paydayDayOfWeek === idx ? P.white : P.ink2 }}>{day}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      {frequency === "biweekly" && (
                        <View>
                          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                            2ND PAYDAY (DAY OF WEEK)
                          </Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {WEEKDAYS.map((day, idx) => (
                              <Pressable
                                key={day}
                                onPress={() => setPaydaySecondDayOfWeek(idx)}
                                accessibilityRole="radio"
                                accessibilityLabel={day}
                                accessibilityState={{ checked: paydaySecondDayOfWeek === idx }}
                                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: paydaySecondDayOfWeek === idx ? P.brand : P.card }}
                              >
                                <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: paydaySecondDayOfWeek === idx ? P.white : P.ink2 }}>{day}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      )}
                    </>
                  )}

                  {frequency === "irregular" && (
                    <View>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: P.ink2, marginBottom: 6 }}>
                        ESTIMATED EVERY (DAYS)
                      </Text>
                      <TextInput
                        value={intervalDays}
                        onChangeText={setIntervalDays}
                        placeholder="e.g. 45"
                        placeholderTextColor={P.muted}
                        keyboardType="number-pad"
                        style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: intervalInvalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
                      />
                    </View>
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
                    <Pressable
                      onPress={onClose}
                      disabled={saving}
                      style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: P.line, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink2 }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSubmit}
                      disabled={saving}
                      style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}
                    >
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.white }}>
                        {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Income Source"}
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
