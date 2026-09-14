import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SAVINGS_GOAL_PLACEHOLDERS, SAVINGS_GOAL_PRIORITY_LABELS, SAVINGS_GOAL_PRIORITIES, SAVINGS_GOAL_TYPE_LABELS, SAVINGS_GOAL_TYPES, type SavingsGoalPriority, type SavingsGoalType } from "./constants";
import { createSavingsGoal, getEmergencyFundBaseline, updateSavingsGoal, type SavingsGoal } from "../../local-db/repositories/savingsGoals";

const P = { card: "#F1F0EB", ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", error: "#D9001F", white: "#FFFFFF" } as const;

type Props = { userId: string; deviceId: string; goal?: SavingsGoal; onCancel: () => void; onSaved: (goal: SavingsGoal) => void };

function toCentavos(value: string) { const amount = Number(value.replace(/,/g, "")); return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN; }
function fromCentavos(value: number) { return String(value / 100); }

function Field({ label, value, onChangeText, placeholder, numeric, invalid }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; numeric?: boolean; invalid?: boolean }) {
  return <View style={{ gap: 5 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#919A91" keyboardType={numeric ? "decimal-pad" : "default"} style={{ backgroundColor: P.white, borderColor: invalid ? P.error : P.line, borderRadius: 10, borderWidth: 1, color: P.ink, fontFamily: "Manrope", fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} /></View>;
}

export default function SavingsGoalForm({ userId, deviceId, goal, onCancel, onSaved }: Props) {
  const [goalType, setGoalType] = useState<SavingsGoalType>(goal?.goalType ?? "emergency_fund");
  const [name, setName] = useState(goal?.name ?? "Emergency Fund");
  const [target, setTarget] = useState(goal ? fromCentavos(goal.targetAmountCentavos) : "");
  const [starting, setStarting] = useState(goal ? fromCentavos(goal.startingAmountCentavos) : "0");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [priority, setPriority] = useState<SavingsGoalPriority>(goal?.priority ?? "high");
  const [baseline, setBaseline] = useState<number | null>(goal?.emergencyFundBaselineCentavos ?? null);
  const [autoSave, setAutoSave] = useState(goal ? fromCentavos(goal.autoSaveAmountCentavos) : "0");
  const [interestRate, setInterestRate] = useState(goal?.interestRateBps != null ? String(goal.interestRateBps / 100) : "");
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (goal || goalType !== "emergency_fund") return;
    getEmergencyFundBaseline(userId).then((value) => { setBaseline(value); setTarget(fromCentavos(value)); }).catch(() => setMessage("Your savings information could not be loaded. Check your connection and try again."));
  }, [goal, goalType, userId]);

  function selectType(type: SavingsGoalType) {
    setGoalType(type); setMessage(null);
    if (type === "emergency_fund") setName("Emergency Fund");
    else if (name === "Emergency Fund") setName("");
  }

  async function save() {
    const targetAmountCentavos = toCentavos(target); const startingAmountCentavos = toCentavos(starting); const autoSaveAmountCentavos = toCentavos(autoSave); const interestRateBps = interestRate.trim() ? Math.round(Number(interestRate) * 100) : null;
    if (!name.trim() || !targetDate || !Number.isSafeInteger(targetAmountCentavos) || targetAmountCentavos <= 0 || !Number.isSafeInteger(startingAmountCentavos) || startingAmountCentavos < 0 || !Number.isSafeInteger(autoSaveAmountCentavos) || autoSaveAmountCentavos < 0 || (interestRateBps != null && (!Number.isSafeInteger(interestRateBps) || interestRateBps < 0))) {
      setMessage("Check the highlighted fields and try again."); return;
    }
    setSaving(true); setMessage(null);
    try {
      const input = { name, goalType, goalCategory: goalType, targetAmountCentavos, startingAmountCentavos, targetDate, priority, emergencyFundBaselineCentavos: goalType === "emergency_fund" ? baseline : null, autoSaveAmountCentavos, interestRateBps, notes };
      const result = goal ? await updateSavingsGoal(userId, deviceId, goal.id, input) : await createSavingsGoal(userId, deviceId, input);
      onSaved(result.goal);
    } catch {
      setMessage("Your savings information could not be saved. Check your details and try again.");
    } finally { setSaving(false); }
  }

  const invalid = Boolean(message);
  return <View style={{ gap: 14 }}>
    <View><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>{goal ? "Edit savings goal" : "Add savings goal"}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>Set a target and track the amount you have already saved.</Text></View>
    <View style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 14, borderWidth: 1, gap: 14, padding: 14 }}>
      {!goal ? <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Goal type</Text><View style={{ flexDirection: "row", gap: 8 }}>{SAVINGS_GOAL_TYPES.map((type) => <Pressable key={type} accessibilityRole="radio" accessibilityLabel={`Select ${SAVINGS_GOAL_TYPE_LABELS[type]}`} accessibilityState={{ selected: type === goalType }} onPress={() => selectType(type)} style={{ backgroundColor: type === goalType ? P.brand : P.white, borderColor: type === goalType ? P.brand : P.line, borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center" }}><Text style={{ color: type === goalType ? P.white : P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{SAVINGS_GOAL_TYPE_LABELS[type]}</Text></Pressable>)}</View></View> : null}
      {goalType === "emergency_fund" && baseline !== null ? <View style={{ backgroundColor: "#F8EFDC", borderRadius: 10, padding: 11 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Suggested monthly baseline: PHP {fromCentavos(baseline)}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, lineHeight: 16, marginTop: 3 }}>Based on posted expenses from the six completed calendar months before today. Saving keeps this baseline without recalculating it later.</Text></View> : null}
      <Field label="Goal name" value={name} onChangeText={setName} placeholder={SAVINGS_GOAL_PLACEHOLDERS.name} invalid={invalid && !name.trim()} />
      <Field label="Target amount" value={target} onChangeText={setTarget} placeholder={SAVINGS_GOAL_PLACEHOLDERS.targetAmount} numeric invalid={invalid && (!Number.isSafeInteger(toCentavos(target)) || toCentavos(target) <= 0)} />
      <Field label="Starting amount" value={starting} onChangeText={setStarting} placeholder={SAVINGS_GOAL_PLACEHOLDERS.startingAmount} numeric invalid={invalid && (!Number.isSafeInteger(toCentavos(starting)) || toCentavos(starting) < 0)} />
       <Field label="Target date" value={targetDate} onChangeText={setTargetDate} placeholder={SAVINGS_GOAL_PLACEHOLDERS.targetDate} invalid={invalid && !targetDate} />
       <Field label="Auto-save amount" value={autoSave} onChangeText={setAutoSave} placeholder="0.00" numeric invalid={invalid && (!Number.isSafeInteger(toCentavos(autoSave)) || toCentavos(autoSave) < 0)} />
       <Field label="Interest rate (%)" value={interestRate} onChangeText={setInterestRate} placeholder="Optional" numeric invalid={invalid && interestRate.trim() !== "" && (!Number.isFinite(Number(interestRate)) || Number(interestRate) < 0)} />
       <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
      <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Priority</Text><View style={{ flexDirection: "row", gap: 7 }}>{SAVINGS_GOAL_PRIORITIES.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Select ${SAVINGS_GOAL_PRIORITY_LABELS[value]} priority`} accessibilityState={{ selected: value === priority }} onPress={() => setPriority(value)} style={{ backgroundColor: value === priority ? P.brand : P.white, borderColor: value === priority ? P.brand : P.line, borderRadius: 9, borderWidth: 1, flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center" }}><Text style={{ color: value === priority ? P.white : P.ink, fontFamily: "Manrope", fontSize: 11, fontWeight: "700" }}>{SAVINGS_GOAL_PRIORITY_LABELS[value]}</Text></Pressable>)}</View></View>
      {message ? <Text accessibilityLiveRegion="polite" style={{ color: P.error, fontFamily: "Manrope", fontSize: 12 }}>{message}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10 }}><Pressable accessibilityRole="button" accessibilityLabel={goal ? "Save savings goal changes" : "Save savings goal"} disabled={saving} onPress={() => { save().catch(() => {}); }} style={{ backgroundColor: P.brand, borderRadius: 10, flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>{saving ? <ActivityIndicator color={P.white} /> : <Text style={{ color: P.white, fontFamily: "Manrope", fontWeight: "700" }}>{goal ? "Save changes" : "Save goal"}</Text>}</Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={{ borderColor: P.line, borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center" }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontWeight: "700" }}>Cancel</Text></Pressable></View>
    </View>
  </View>;
}
