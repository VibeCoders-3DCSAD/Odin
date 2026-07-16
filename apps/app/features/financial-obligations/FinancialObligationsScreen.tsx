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
  CalendarBlank,
  Plus,
  PencilSimple,
  TrashSimple,
  ShieldCheck,
} from "phosphor-react-native";
import {
  listFinancialObligations,
  createFinancialObligation,
  updateFinancialObligation,
  deleteFinancialObligation,
  type FinancialObligation,
  type CreateFinancialObligationInput,
  type ObligationFrequency,
} from "../../local-db/repositories/financialFoundations";
import { listSubcategories, type Subcategory } from "../../local-db/repositories/taxonomy";

const P = {
  shell: "#fcf8f0", brand: "#013220", brandMedium: "#0E6D46",
  ink: "#1B1C1A", ink2: "#414942", muted: "#6B7A6F",
  line: "#EAEAE6", error: "#D9001F", card: "#F1F0EB", white: "#FFFFFF",
};

const FREQUENCIES: readonly ObligationFrequency[] = ["weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"];

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

export default function FinancialObligationsScreen({ userId, deviceId, onBack, onSyncRequested }: Props) {
  const [obligations, setObligations] = useState<FinancialObligation[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<FinancialObligation | null>(null);

  const load = useCallback(async () => {
    const [obs, subs] = await Promise.all([listFinancialObligations(userId), listSubcategories(userId, undefined, "expense")]);
    setObligations(obs);
    setSubcategories(subs);
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

  const getSubcategoryName = (id: string) => subcategories.find((s) => s.id === id)?.label ?? id;

  return (
    <View style={{ flex: 1, backgroundColor: P.shell }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 }}>
        <TouchableOpacity onPress={onBack} hitSlop={8} style={{ marginRight: 12 }}><ArrowLeft size={22} color={P.ink} /></TouchableOpacity>
        <Text style={{ fontSize: 20, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>Obligations</Text>
      </View>
      <FlatList
        nestedScrollEnabled
        data={obligations}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        ListEmptyComponent={loading ? null : (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <ShieldCheck size={40} color={P.muted} />
            <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Manrope", color: P.muted }}>No obligations yet</Text>
            <Text style={{ marginTop: 4, fontSize: 13, fontFamily: "Manrope", color: P.muted }}>Tap + to add your first obligation</Text>
          </View>
        )}
        renderItem={({ item: o }) => (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: P.white, borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: P.line }}>
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
        )}
      />
      <TouchableOpacity onPress={() => { setEditing(null); setSheetVisible(true); }} activeOpacity={0.85} style={{ position: "absolute", bottom: 24, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: P.brand, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: P.brand, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 }}>
        <Plus size={24} color={P.white} weight="bold" />
      </TouchableOpacity>
      <ObligationFormSheet visible={sheetVisible} editing={editing} subcategories={subcategories} onClose={() => { setSheetVisible(false); setEditing(null); }} onSubmit={editing ? handleUpdate : handleCreate} />
    </View>
  );
}

function ObligationFormSheet({ visible, editing, subcategories, onClose, onSubmit }: { visible: boolean; editing: FinancialObligation | null; subcategories: Subcategory[]; onClose: () => void; onSubmit: (input: CreateFinancialObligationInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [subcategoryId, setSubcategoryId] = useState(subcategories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ObligationFrequency>("monthly");
  const [dueDay, setDueDay] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = editing !== null;

  useEffect(() => {
    if (editing) {
      setName(editing.name); setSubcategoryId(editing.subcategoryId); setFrequency(editing.frequency);
      setAmount(String(editing.amountCentavos / 100));
      setDueDay(editing.dueDayOfMonth != null ? String(editing.dueDayOfMonth) : "");
    } else { setName(""); setSubcategoryId(subcategories[0]?.id ?? ""); setFrequency("monthly"); setAmount(""); setDueDay(""); }
  }, [editing]);

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert("Error", "Name is required."); return; }
    if (!subcategoryId) { Alert.alert("Error", "Please select a subcategory."); return; }
    const cents = parseSafeCents(amount);
    if (cents === null || cents < 0) { Alert.alert("Error", "Amount must be a valid non-negative number."); return; }
    const day = parseDayOfMonth(dueDay);
    if (dueDay.trim() && day === null) { Alert.alert("Error", "Due day must be 1-31."); return; }
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), subcategoryId, amountCentavos: cents, frequency, dueDayOfMonth: day });
    } catch (err) { Alert.alert("Error", err instanceof Error ? err.message : "Something went wrong"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose}><View style={{ flex: 1 }} /></Pressable>
      <View style={{ backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: "85%" }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.line, alignSelf: "center", marginBottom: 16 }} />
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 18, fontFamily: "Manrope", fontWeight: "700", color: P.ink, marginBottom: 16 }}>{isEdit ? "Edit Obligation" : "Add Obligation"}</Text>
          <Text style={ls}>Subcategory</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {subcategories.map((s) => <Pressable key={s.id} onPress={() => setSubcategoryId(s.id)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: subcategoryId === s.id ? P.brand : P.card }}><Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: subcategoryId === s.id ? P.white : P.ink2 }} numberOfLines={1}>{s.label}</Text></Pressable>)}
            </View>
          </ScrollView>
          <Text style={ls}>Name</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Rent" placeholderTextColor={P.muted} style={is} />
          <Text style={ls}>Amount (₱)</Text><TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={P.muted} keyboardType="decimal-pad" style={is} />
          <Text style={ls}>Frequency</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {FREQUENCIES.map((f) => <Pressable key={f} onPress={() => setFrequency(f)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: frequency === f ? P.brand : P.card }}><Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: frequency === f ? P.white : P.ink2 }}>{f}</Text></Pressable>)}
          </View>
          <Text style={ls}>Due Day of Month</Text><TextInput value={dueDay} onChangeText={setDueDay} placeholder="1" placeholderTextColor={P.muted} keyboardType="number-pad" style={is} />
          <TouchableOpacity onPress={handleSubmit} disabled={saving} activeOpacity={0.85} style={{ backgroundColor: P.brand, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 12, opacity: saving ? 0.6 : 1 }}>
            <Text style={{ fontSize: 16, fontFamily: "Manrope", fontWeight: "700", color: P.white }}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Add Obligation"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
const ls = { fontSize: 12, fontFamily: "Manrope", fontWeight: "600", color: P.ink2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 } as const;
const is = { backgroundColor: P.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Manrope", color: P.ink, marginBottom: 14 } as const;
