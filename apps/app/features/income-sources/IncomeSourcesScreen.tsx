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
  CurrencyDollar,
  Plus,
  PencilSimple,
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

function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const sign = pesos < 0 ? "-" : "";
  return `${sign}₱${Math.abs(pesos).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseSafeCents(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const p = parseFloat(t);
  return Number.isFinite(p) ? Math.round(p * 100) : null;
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

  const totalMonthly = sources
    .filter((s) => s.frequency === "monthly")
    .reduce((s, i) => s + (i.expectedAmountCentavos ?? 0), 0);

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
    <View style={{ flex: 1, backgroundColor: P.shell }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 }}>
        <TouchableOpacity onPress={onBack} hitSlop={8} style={{ marginRight: 12 }}><ArrowLeft size={22} color={P.ink} /></TouchableOpacity>
        <Text style={{ fontSize: 20, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>Income Sources</Text>
      </View>
      <FlatList
        data={sources}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        ListHeaderComponent={
          <View style={{ backgroundColor: P.brand, borderRadius: 14, padding: 18, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontFamily: "Manrope", fontWeight: "600", color: "#41EDA4", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Total Monthly Income</Text>
            <Text style={{ fontSize: 28, fontFamily: "Manrope", fontWeight: "700", color: P.white }}>{formatPeso(totalMonthly)}</Text>
          </View>
        }
        ListEmptyComponent={loading ? null : (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <TrendUp size={40} color={P.muted} />
            <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Manrope", color: P.muted }}>No income sources yet</Text>
            <Text style={{ marginTop: 4, fontSize: 13, fontFamily: "Manrope", color: P.muted }}>Tap + to add your first income source</Text>
          </View>
        )}
        renderItem={({ item: s }) => (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: P.white, borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: P.line }}>
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
        )}
      />
      <TouchableOpacity onPress={() => { setEditing(null); setSheetVisible(true); }} activeOpacity={0.85} style={{ position: "absolute", bottom: 24, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: P.brand, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 }}>
        <Plus size={24} color={P.white} weight="bold" />
      </TouchableOpacity>
      <IncomeFormSheet visible={sheetVisible} editing={editing} onClose={() => { setSheetVisible(false); setEditing(null); }} onSubmit={editing ? handleUpdate : handleCreate} />
    </View>
  );
}

function IncomeFormSheet({ visible, editing, onClose, onSubmit }: { visible: boolean; editing: IncomeSource | null; onClose: () => void; onSubmit: (input: CreateIncomeSourceInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [incomeType, setIncomeType] = useState<IncomeType>("stable");
  const [frequency, setFrequency] = useState<IncomeFrequency>("monthly");
  const [expected, setExpected] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [payday, setPayday] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = editing !== null;

  useEffect(() => {
    if (editing) {
      setName(editing.name); setIncomeType(editing.incomeType); setFrequency(editing.frequency);
      setExpected(editing.expectedAmountCentavos != null ? String(editing.expectedAmountCentavos / 100) : "");
      setMin(editing.minAmountCentavos != null ? String(editing.minAmountCentavos / 100) : "");
      setMax(editing.maxAmountCentavos != null ? String(editing.maxAmountCentavos / 100) : "");
      setPayday(editing.paydayDayOfMonth != null ? String(editing.paydayDayOfMonth) : "");
    } else { setName(""); setIncomeType("stable"); setFrequency("monthly"); setExpected(""); setMin(""); setMax(""); setPayday(""); }
  }, [editing]);

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert("Error", "Name is required."); return; }
    const e = parseSafeCents(expected);
    const mn = parseSafeCents(min);
    const mx = parseSafeCents(max);
    if ((expected.trim() && e === null) || (min.trim() && mn === null) || (max.trim() && mx === null)) {
      Alert.alert("Error", "Amounts must be valid numbers."); return;
    }
    if (mn !== null && mx !== null && mn > mx) { Alert.alert("Error", "Min must be <= max."); return; }
    const day = parseDayOfMonth(payday);
    if (payday.trim() && day === null) { Alert.alert("Error", "Payday must be 1-31."); return; }
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), incomeType, frequency, expectedAmountCentavos: e, minAmountCentavos: mn, maxAmountCentavos: mx, paydayDayOfMonth: day });
    } catch (err) { Alert.alert("Error", err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose}><View style={{ flex: 1 }} /></Pressable>
      <View style={{ backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: "85%" }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.line, alignSelf: "center", marginBottom: 16 }} />
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 18, fontFamily: "Manrope", fontWeight: "700", color: P.ink, marginBottom: 16 }}>{isEdit ? "Edit Income Source" : "Add Income Source"}</Text>
          <Text style={ls}>Name</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Salary" placeholderTextColor={P.muted} style={is} />
          <Text style={ls}>Type</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {INCOME_TYPES.map((t) => <Pressable key={t} onPress={() => setIncomeType(t)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: incomeType === t ? P.brand : P.card }}><Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: incomeType === t ? P.white : P.ink2 }}>{t}</Text></Pressable>)}
          </View>
          <Text style={ls}>Frequency</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {FREQUENCIES.map((f) => <Pressable key={f} onPress={() => setFrequency(f)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: frequency === f ? P.brand : P.card }}><Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: frequency === f ? P.white : P.ink2 }}>{f}</Text></Pressable>)}
          </View>
          <Text style={ls}>Expected Amount (₱)</Text><TextInput value={expected} onChangeText={setExpected} placeholder="0.00" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={is} />
          <Text style={ls}>Min Amount (₱)</Text><TextInput value={min} onChangeText={setMin} placeholder="0.00" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={is} />
          <Text style={ls}>Max Amount (₱)</Text><TextInput value={max} onChangeText={setMax} placeholder="0.00" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={is} />
          <Text style={ls}>Payday (day of month)</Text><TextInput value={payday} onChangeText={setPayday} placeholder="15" placeholderTextColor={P.muted} keyboardType="number-pad" style={is} />
          <TouchableOpacity onPress={handleSubmit} disabled={saving} activeOpacity={0.85} style={{ backgroundColor: P.brand, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 12, opacity: saving ? 0.6 : 1 }}>
            <Text style={{ fontSize: 16, fontFamily: "Manrope", fontWeight: "700", color: P.white }}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Add Income Source"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
const ls = { fontSize: 12, fontFamily: "Manrope", fontWeight: "600", color: P.ink2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 } as const;
const is = { backgroundColor: P.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Manrope", color: P.ink, marginBottom: 14 } as const;
