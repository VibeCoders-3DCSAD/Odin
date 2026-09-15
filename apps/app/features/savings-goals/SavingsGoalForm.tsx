import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SAVINGS_GOAL_PLACEHOLDERS, SAVINGS_GOAL_PRIORITY_LABELS, SAVINGS_GOAL_PRIORITIES, SAVINGS_GOAL_TYPE_LABELS, SAVINGS_GOAL_TYPES, type SavingsGoalPriority, type SavingsGoalType } from "./constants";
import { createSavingsGoal, getEmergencyFundBaseline, updateSavingsGoal, type SavingsGoal } from "../../local-db/repositories/savingsGoals";
import RecurringScheduleFields, { type RecurringScheduleFrequency, type RecurringScheduleValue } from "../recurring-transactions/components/RecurringScheduleFields";
import { GOAL_CONTRIBUTION_FREQUENCIES, type GoalContributionFrequency } from "./contributionSchedule";

const P = { card: "#F1F0EB", ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", error: "#D9001F", white: "#FFFFFF" } as const;

type Props = { userId: string; deviceId: string; goal?: SavingsGoal; onCancel: () => void; onSaved: (goal: SavingsGoal) => void };

function toCentavos(value: string) { const amount = Number(value.replace(/,/g, "")); return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN; }
function fromCentavos(value: number) { return String(value / 100); }
function formatDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }

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
  const [plannedContribution, setPlannedContribution] = useState(goal ? fromCentavos(goal.plannedContributionAmountCentavos) : "0");
  const [contributionFrequency, setContributionFrequency] = useState<GoalContributionFrequency>(goal?.contributionFrequency ?? "monthly");
  const [nextContributionDate, setNextContributionDate] = useState(goal?.nextContributionDate ?? "");
  const [contributionDay, setContributionDay] = useState(goal?.contributionDayOfMonth != null ? String(goal.contributionDayOfMonth) : "");
  const [contributionSecondDay, setContributionSecondDay] = useState(goal?.contributionSecondDayOfMonth != null ? String(goal.contributionSecondDayOfMonth) : "");
  const [contributionDayOfWeek, setContributionDayOfWeek] = useState<number | null>(goal?.contributionDayOfWeek ?? null);
  const [customIntervalDays, setCustomIntervalDays] = useState(goal?.customIntervalDays != null ? String(goal.customIntervalDays) : "");
  const [showContributionDatePicker, setShowContributionDatePicker] = useState(false);
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
    const targetAmountCentavos = toCentavos(target); const startingAmountCentavos = toCentavos(starting); const plannedContributionAmountCentavos = toCentavos(plannedContribution); const interestRateBps = interestRate.trim() ? Math.round(Number(interestRate) * 100) : null;
    const contributionDayOfMonth = contributionDay.trim() ? Number(contributionDay) : null; const contributionSecondDayOfMonth = contributionSecondDay.trim() ? Number(contributionSecondDay) : null; const parsedCustomIntervalDays = customIntervalDays.trim() ? Number(customIntervalDays) : null;
    if (!name.trim() || !targetDate || !nextContributionDate || !Number.isSafeInteger(targetAmountCentavos) || targetAmountCentavos <= 0 || !Number.isSafeInteger(startingAmountCentavos) || startingAmountCentavos < 0 || !Number.isSafeInteger(plannedContributionAmountCentavos) || plannedContributionAmountCentavos < 0 || (interestRateBps != null && (!Number.isSafeInteger(interestRateBps) || interestRateBps < 0))) {
      setMessage("Check the highlighted fields and try again."); return;
    }
    setSaving(true); setMessage(null);
    try {
      const input = { name, goalType, goalCategory: goalType, targetAmountCentavos, startingAmountCentavos, targetDate, priority, emergencyFundBaselineCentavos: goalType === "emergency_fund" ? baseline : null, autoSaveAmountCentavos: plannedContributionAmountCentavos, plannedContributionAmountCentavos, contributionFrequency, contributionIntervalCount: 1, contributionDayOfMonth, contributionSecondDayOfMonth, contributionDayOfWeek, customIntervalDays: parsedCustomIntervalDays, nextContributionDate, interestRateBps, notes };
      const result = goal ? await updateSavingsGoal(userId, deviceId, goal.id, input) : await createSavingsGoal(userId, deviceId, input);
      onSaved(result.goal);
    } catch {
      setMessage("Your savings information could not be saved. Check your details and try again.");
    } finally { setSaving(false); }
  }

  const invalid = Boolean(message);
  const scheduleValue: RecurringScheduleValue = { frequency: contributionFrequency, intervalCount: "1", dayOfMonth: contributionDay, secondDayOfMonth: contributionSecondDay, dayOfWeek: contributionDayOfWeek, secondDayOfWeek: null, monthOfYear: null, estimatedIntervalDays: "" };
  return <View style={{ gap: 14 }}>
    <View><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>{goal ? "Edit savings goal" : "Add savings goal"}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>Set a target and track the amount you have already saved.</Text></View>
    <View style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 14, borderWidth: 1, gap: 14, padding: 14 }}>
      <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Goal category</Text><View style={{ flexDirection: "row", gap: 8 }}>{SAVINGS_GOAL_TYPES.map((type) => <Pressable key={type} accessibilityRole="radio" accessibilityLabel={`Select ${SAVINGS_GOAL_TYPE_LABELS[type]}`} accessibilityState={{ selected: type === goalType }} onPress={() => selectType(type)} style={{ backgroundColor: type === goalType ? P.brand : P.white, borderColor: type === goalType ? P.brand : P.line, borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center" }}><Text style={{ color: type === goalType ? P.white : P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>{SAVINGS_GOAL_TYPE_LABELS[type]}</Text></Pressable>)}</View></View>
      {goalType === "emergency_fund" && baseline !== null ? <View style={{ backgroundColor: "#F8EFDC", borderRadius: 10, padding: 11 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Suggested monthly baseline: PHP {fromCentavos(baseline)}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, lineHeight: 16, marginTop: 3 }}>Based on posted expenses from the six completed calendar months before today. Saving keeps this baseline without recalculating it later.</Text></View> : null}
      <Field label="Goal name" value={name} onChangeText={setName} placeholder={SAVINGS_GOAL_PLACEHOLDERS.name} invalid={invalid && !name.trim()} />
      <Field label="Target amount" value={target} onChangeText={setTarget} placeholder={SAVINGS_GOAL_PLACEHOLDERS.targetAmount} numeric invalid={invalid && (!Number.isSafeInteger(toCentavos(target)) || toCentavos(target) <= 0)} />
      <Field label="Starting amount" value={starting} onChangeText={setStarting} placeholder={SAVINGS_GOAL_PLACEHOLDERS.startingAmount} numeric invalid={invalid && (!Number.isSafeInteger(toCentavos(starting)) || toCentavos(starting) < 0)} />
       <Field label="Target date" value={targetDate} onChangeText={setTargetDate} placeholder={SAVINGS_GOAL_PLACEHOLDERS.targetDate} invalid={invalid && !targetDate} />
        <Field label="Planned contribution amount" value={plannedContribution} onChangeText={setPlannedContribution} placeholder="0.00" numeric invalid={invalid && (!Number.isSafeInteger(toCentavos(plannedContribution)) || toCentavos(plannedContribution) < 0)} />
        <View style={{ gap: 5 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Next Contribution Date</Text><Pressable accessibilityRole="button" accessibilityLabel="Select next contribution date" onPress={() => setShowContributionDatePicker(true)} style={{ backgroundColor: P.white, borderColor: invalid && !nextContributionDate ? P.error : P.line, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 12 }}><Text style={{ color: nextContributionDate ? P.ink : "#919A91", fontFamily: "Manrope", fontSize: 14 }}>{nextContributionDate || "Select contribution date"}</Text></Pressable></View>
        <RecurringScheduleFields frequencies={GOAL_CONTRIBUTION_FREQUENCIES as readonly RecurringScheduleFrequency[]} value={scheduleValue} onChange={(next) => { setContributionFrequency(next.frequency as GoalContributionFrequency); setContributionDay(next.dayOfMonth); setContributionSecondDay(next.secondDayOfMonth); setContributionDayOfWeek(next.dayOfWeek); }} frequencyLabel="CONTRIBUTION FREQUENCY" dayOfMonthError={invalid && contributionFrequency === "semi_monthly" && !contributionDay} secondDayOfMonthError={invalid && contributionFrequency === "semi_monthly" && !contributionSecondDay} />
        {contributionFrequency === "custom" ? <Field label="Custom interval days" value={customIntervalDays} onChangeText={setCustomIntervalDays} placeholder="e.g. 45" numeric invalid={invalid && (!Number.isSafeInteger(Number(customIntervalDays)) || Number(customIntervalDays) <= 0)} /> : null}
       <Field label="Interest rate (%)" value={interestRate} onChangeText={setInterestRate} placeholder="Optional" numeric invalid={invalid && interestRate.trim() !== "" && (!Number.isFinite(Number(interestRate)) || Number(interestRate) < 0)} />
       <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
      <View style={{ gap: 7 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Priority</Text><View style={{ flexDirection: "row", gap: 7 }}>{SAVINGS_GOAL_PRIORITIES.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Select ${SAVINGS_GOAL_PRIORITY_LABELS[value]} priority`} accessibilityState={{ selected: value === priority }} onPress={() => setPriority(value)} style={{ backgroundColor: value === priority ? P.brand : P.white, borderColor: value === priority ? P.brand : P.line, borderRadius: 9, borderWidth: 1, flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center" }}><Text style={{ color: value === priority ? P.white : P.ink, fontFamily: "Manrope", fontSize: 11, fontWeight: "700" }}>{SAVINGS_GOAL_PRIORITY_LABELS[value]}</Text></Pressable>)}</View></View>
       {message ? <Text accessibilityLiveRegion="polite" style={{ color: P.error, fontFamily: "Manrope", fontSize: 12 }}>{message}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10 }}><Pressable accessibilityRole="button" accessibilityLabel={goal ? "Save savings goal changes" : "Save savings goal"} disabled={saving} onPress={() => { save().catch(() => {}); }} style={{ backgroundColor: P.brand, borderRadius: 10, flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>{saving ? <ActivityIndicator color={P.white} /> : <Text style={{ color: P.white, fontFamily: "Manrope", fontWeight: "700" }}>{goal ? "Save changes" : "Save goal"}</Text>}</Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={{ borderColor: P.line, borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center" }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontWeight: "700" }}>Cancel</Text></Pressable></View>
     </View>
     {showContributionDatePicker ? <DateTimePicker value={nextContributionDate ? new Date(`${nextContributionDate}T00:00:00`) : new Date()} mode="date" onChange={(_, date) => { setShowContributionDatePicker(false); if (date) setNextContributionDate(formatDate(date)); }} /> : null}
   </View>;
}
