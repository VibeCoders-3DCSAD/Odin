import { Pressable, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import RecurringScheduleFields, { type RecurringScheduleFrequency, type RecurringScheduleValue } from "../../recurring-transactions/components/RecurringScheduleFields";
import { ALL_DEBT_PRESETS, getDebtPreset, getDebtPresetFields } from "../presets";

const DEBT_FREQUENCIES: readonly RecurringScheduleFrequency[] = ["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"];
const INTEREST_METHODS = [
  ["", "Not specified"],
  ["flat_add_on", "Flat / add-on"],
  ["diminishing_balance", "Diminishing balance"],
  ["provider_calculated", "Provider calculated"],
  ["no_interest", "No interest"],
] as const;
const INTEREST_PERIODS = [
  ["", "Not specified"],
  ["daily", "Per day"],
  ["monthly", "Per month"],
  ["annual", "Per year"],
] as const;
type DateField = "nextDueDate" | "maturityDate" | "targetPayoffDate";

function parseDate(value: string): Date {
  if (!value) return new Date();
  return new Date(`${value}T00:00:00`);
}

function formatDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseTime(value: string): Date {
  const date = new Date();
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isInteger(hours) && Number.isInteger(minutes)) date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}

function formatTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function NumberSelector({ value, onChange, label }: { value: number | undefined; onChange: (value: number | undefined) => void; label: string }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
    <TextInput
      value={value === undefined ? "" : String(value)}
      onChangeText={(raw) => {
        if (!raw.trim()) return onChange(undefined);
        const next = Number(raw);
         if (Number.isInteger(next) && next >= 0) onChange(next);
      }}
      placeholder="12"
      placeholderTextColor="#6B7A6F"
      keyboardType="number-pad"
       accessibilityLabel={label}
      style={{ width: 72, height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#EAEAE6", paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: "#1B1C1A", backgroundColor: "#FCF8F0" }}
    />
    <Text style={{ fontFamily: "Manrope", fontSize: 14, color: "#414942" }}>month(s)</Text>
  </View>;
}

type Props = {
  editingId: string | null;
  name: string;
  lenderName: string;
  originalBalance: string;
  balance: string;
  startDate: string;
  fees: string;
  penalties: string;
  interestRate: string;
  minimum: string;
  paymentFrequency: string;
  paymentSchedule: RecurringScheduleValue;
  nextDueDate: string;
  maturityDate: string;
  targetPayoffDate: string;
  interestPeriod: string;
  interestMethod: string;
  notes: string;
  presetKey: string;
  presetData: Record<string, unknown>;
  formError?: string | null;
  pending?: boolean;
  setName: (value: string) => void;
  setLenderName: (value: string) => void;
  setOriginalBalance: (value: string) => void;
  setBalance: (value: string) => void;
  setStartDate: (value: string) => void;
  setFees: (value: string) => void;
  setPenalties: (value: string) => void;
  setInterestRate: (value: string) => void;
  setMinimum: (value: string) => void;
  setPaymentFrequency: (value: string) => void;
  setPaymentSchedule: (value: RecurringScheduleValue) => void;
  setNextDueDate: (value: string) => void;
  setMaturityDate: (value: string) => void;
  setTargetPayoffDate: (value: string) => void;
  setInterestPeriod: (value: string) => void;
  setInterestMethod: (value: string) => void;
  setNotes: (value: string) => void;
  setPresetKey: (value: string) => void;
  setPresetData: (value: Record<string, unknown>) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function DebtForm({
    editingId, name, lenderName, originalBalance, balance, startDate, fees, penalties, interestRate, minimum, paymentFrequency, paymentSchedule,
  nextDueDate, maturityDate, targetPayoffDate, interestPeriod, interestMethod,
    notes, presetKey, presetData, setName, setLenderName, setOriginalBalance, setBalance, setStartDate, setFees, setPenalties, setInterestRate,
   setMinimum, setPaymentFrequency, setPaymentSchedule, setNextDueDate, setMaturityDate,
  setTargetPayoffDate, setInterestPeriod, setInterestMethod, setNotes,
   setPresetKey, setPresetData, formError, pending = false, onCancel, onSave,
}: Props) {
  const [datePicker, setDatePicker] = useState<DateField | null>(null);
  const [schedulePicker, setSchedulePicker] = useState<"time" | "yearlyDate" | null>(null);
  const palette = { ink: "#1B1C1A", ink2: "#414942", muted: "#6B7A6F", line: "#EAEAE6", card: "#FCF8F0" };
  const input = { height: 46, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, borderRadius: 12, fontFamily: "Manrope", fontSize: 14, color: palette.ink };
  const label = { fontFamily: "Manrope", fontWeight: "600" as const, fontSize: 12, color: palette.ink2, marginTop: 4, marginBottom: 6 };
   const presets = ALL_DEBT_PRESETS;
  const presetFields = getDebtPresetFields(presetKey);
  return (
    <View style={{ backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16, gap: 10 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>{editingId ? "Edit debt" : "New debt"}</Text>
      {formError ? <Text style={{ color: "#D9001F", fontSize: 12 }}>{formError}</Text> : null}
       <Text style={label}>DEBT TYPE</Text>
       {!ALL_DEBT_PRESETS.some((preset) => preset.key === presetKey) ? <Text style={{ color: palette.muted }}>Legacy type: {getDebtPreset(presetKey).label}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {presets.map((preset) => (
          <Pressable
            key={preset.key}
            accessibilityRole="radio"
            accessibilityLabel={preset.label}
            accessibilityState={{ selected: presetKey === preset.key }}
            onPress={() => { setPresetKey(preset.key); setPresetData({}); }}
             style={{ backgroundColor: presetKey === preset.key ? "#0E6D46" : "#FFFFFF", borderRadius: 10, padding: 10 }}
          >
             <Text style={{ fontFamily: "Manrope", color: presetKey === preset.key ? "#FFFFFF" : palette.ink, fontSize: 12 }}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
       <View><Text style={label}>DEBT NAME</Text><TextInput accessibilityLabel="Debt name" value={name} onChangeText={setName} placeholder="Enter debt name" placeholderTextColor={palette.muted} style={input} /></View>
       <View><Text style={label}>LENDER NAME</Text><TextInput accessibilityLabel="Lender name" value={lenderName} onChangeText={setLenderName} placeholder="Enter lender name" placeholderTextColor={palette.muted} style={input} /></View>
        <View><Text style={label}>ORIGINAL AMOUNT (PHP)</Text><TextInput accessibilityLabel="Original amount (PHP)" value={originalBalance} onChangeText={setOriginalBalance} placeholder="Enter original amount" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={input} /></View>
        <View><Text style={label}>CURRENT BALANCE (PHP)</Text><TextInput accessibilityLabel="Current balance (PHP)" value={balance} onChangeText={setBalance} placeholder="Enter current balance" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={input} /></View>
        <View><Text style={label}>START / DISBURSEMENT DATE</Text><TextInput accessibilityLabel="Start date" value={startDate} onChangeText={setStartDate} placeholder="Select start date" placeholderTextColor={palette.muted} style={input} /></View>
         <View style={{ gap: 10 }}>
           <View><Text style={label}>INTEREST RATE (IN %)</Text><TextInput accessibilityLabel="Interest rate in percent" value={interestRate} onChangeText={setInterestRate} placeholder="e.g. 3" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={input} /></View>
           <View>
             <Text style={label}>INTEREST RATE PERIOD</Text>
             <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
               {INTEREST_PERIODS.map(([value, periodLabel]) => (
                 <Pressable key={value || "unspecified"} onPress={() => setInterestPeriod(value)} accessibilityRole="radio" accessibilityLabel={periodLabel} accessibilityState={{ selected: interestPeriod === value }} style={{ backgroundColor: interestPeriod === value ? "#0E6D46" : "#FFFFFF", borderRadius: 10, padding: 10 }}>
                   <Text style={{ fontFamily: "Manrope", color: interestPeriod === value ? "#FFFFFF" : palette.ink, fontSize: 12 }}>{periodLabel}</Text>
                 </Pressable>
               ))}
             </View>
           </View>
           <View>
             <Text style={label}>INTEREST METHOD</Text>
             <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
               {INTEREST_METHODS.map(([value, methodLabel]) => (
                 <Pressable key={value || "unspecified"} onPress={() => setInterestMethod(value)} accessibilityRole="radio" accessibilityLabel={methodLabel} accessibilityState={{ selected: interestMethod === value }} style={{ backgroundColor: interestMethod === value ? "#0E6D46" : "#FFFFFF", borderRadius: 10, padding: 10 }}>
                   <Text style={{ fontFamily: "Manrope", color: interestMethod === value ? "#FFFFFF" : palette.ink, fontSize: 12 }}>{methodLabel}</Text>
                 </Pressable>
               ))}
             </View>
           </View>
         </View>
         <View><Text style={label}>PAYMENT / AMORTIZATION (PHP)</Text><TextInput accessibilityLabel="Payment amount (PHP)" value={minimum} onChangeText={setMinimum} placeholder="Enter payment amount" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={input} /></View>
         <View><Text style={label}>FEES (PHP)</Text><TextInput accessibilityLabel="Fees (PHP)" value={fees} onChangeText={setFees} placeholder="Enter fees" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={input} /></View>
         <View><Text style={label}>PENALTIES (PHP)</Text><TextInput accessibilityLabel="Penalties (PHP)" value={penalties} onChangeText={setPenalties} placeholder="Enter penalties" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={input} /></View>
         <RecurringScheduleFields frequencies={DEBT_FREQUENCIES} value={paymentSchedule} onChange={(schedule) => { setPaymentSchedule(schedule); setPaymentFrequency(schedule.frequency); }} hideYearlyDetails frequencyLabel="PAYMENT FREQUENCY" />
         {paymentSchedule.frequency === "custom" ? <View><Text style={label}>CUSTOM INTERVAL (DAYS)</Text><TextInput accessibilityLabel="Custom payment interval days" value={paymentSchedule.estimatedIntervalDays} onChangeText={(estimatedIntervalDays) => setPaymentSchedule({ ...paymentSchedule, estimatedIntervalDays })} placeholder="Enter interval in days" placeholderTextColor={palette.muted} keyboardType="number-pad" style={input} /></View> : null}
        {paymentSchedule.frequency === "daily" ? <View><Text style={label}>TIME</Text><Pressable onPress={() => setSchedulePicker("time")} accessibilityRole="button" accessibilityLabel="Choose payment time" style={{ ...input, justifyContent: "center" }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: paymentSchedule.timeOfDay ? palette.ink : palette.muted }}>{paymentSchedule.timeOfDay || "Choose a time"}</Text></Pressable></View> : null}
        {paymentSchedule.frequency === "yearly" ? <View><Text style={label}>PAYMENT DATE</Text><Pressable onPress={() => setSchedulePicker("yearlyDate")} accessibilityRole="button" accessibilityLabel="Choose yearly payment date" style={{ ...input, justifyContent: "center" }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: paymentSchedule.monthOfYear && paymentSchedule.dayOfMonth ? palette.ink : palette.muted }}>{paymentSchedule.monthOfYear && paymentSchedule.dayOfMonth ? `${paymentSchedule.monthOfYear}/${paymentSchedule.dayOfMonth}` : "Choose a date"}</Text></Pressable></View> : null}
        {schedulePicker ? <DateTimePicker value={schedulePicker === "time" ? parseTime(paymentSchedule.timeOfDay ?? "") : new Date(new Date().getFullYear(), (paymentSchedule.monthOfYear ?? 1) - 1, Number(paymentSchedule.dayOfMonth) || 1)} mode={schedulePicker === "time" ? "time" : "date"} onChange={(_event, date) => { setSchedulePicker(null); if (!date) return; if (schedulePicker === "time") setPaymentSchedule({ ...paymentSchedule, timeOfDay: formatTime(date) }); else setPaymentSchedule({ ...paymentSchedule, monthOfYear: date.getMonth() + 1, dayOfMonth: String(date.getDate()) }); }} /> : null}
        {(["nextDueDate", "maturityDate", "targetPayoffDate"] as const).map((field) => {
          const values = { nextDueDate, maturityDate, targetPayoffDate };
          const setters = { nextDueDate: setNextDueDate, maturityDate: setMaturityDate, targetPayoffDate: setTargetPayoffDate };
          const labels = { nextDueDate: "NEXT DUE DATE", maturityDate: "MATURITY DATE", targetPayoffDate: "TARGET PAYOFF DATE" };
          const value = values[field];
          return <View key={field}><Text style={label}>{labels[field]}</Text><Pressable onPress={() => setDatePicker(field)} accessibilityRole="button" accessibilityLabel={`Choose ${labels[field].toLowerCase()}`} style={{ ...input, justifyContent: "center" }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: value ? palette.ink : palette.muted }}>{value || "Choose a date"}</Text></Pressable>{value ? <Pressable onPress={() => setters[field]("")} accessibilityRole="button" accessibilityLabel={`Clear ${labels[field].toLowerCase()}`}><Text style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>Clear date</Text></Pressable> : null}</View>;
        })}
        {datePicker ? <DateTimePicker value={parseDate(({ nextDueDate, maturityDate, targetPayoffDate })[datePicker])} mode="date" onChange={(_event, date) => { setDatePicker(null); if (date) ({ nextDueDate: setNextDueDate, maturityDate: setMaturityDate, targetPayoffDate: setTargetPayoffDate })[datePicker](formatDate(date)); }} /> : null}
         {presetFields.map((field) => <View key={field.key}><Text style={label}>{field.label.toUpperCase()}</Text>{field.kind === "number" ? <NumberSelector label={field.label} value={typeof presetData[field.key] === "number" ? presetData[field.key] as number : undefined} onChange={(value) => setPresetData({ ...presetData, [field.key]: value })} /> : field.options ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{field.options.map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{ selected: presetData[field.key] === option }} onPress={() => setPresetData({ ...presetData, [field.key]: option })} style={{ backgroundColor: presetData[field.key] === option ? "#0E6D46" : "#FFFFFF", borderRadius: 10, padding: 10 }}><Text style={{ color: presetData[field.key] === option ? "#FFFFFF" : palette.ink, fontSize: 12 }}>{option.replaceAll("_", " ")}</Text></Pressable>)}</View> : <TextInput accessibilityLabel={field.label} value={String(presetData[field.key] ?? "")} onChangeText={(value) => setPresetData({ ...presetData, [field.key]: value || undefined })} placeholder={field.placeholder} placeholderTextColor={palette.muted} keyboardType="default" style={input} />}</View>)}
       <View><Text style={label}>NOTES</Text><TextInput accessibilityLabel="Debt notes" value={notes} onChangeText={setNotes} placeholder="Add notes" placeholderTextColor={palette.muted} multiline style={{ ...input, height: 80, textAlignVertical: "top", paddingTop: 12 }} /></View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable disabled={pending} onPress={onCancel} style={{ flex: 1, padding: 12, alignItems: "center" }}><Text>Cancel</Text></Pressable>
        <Pressable disabled={pending} onPress={onSave} style={{ flex: 1, padding: 12, alignItems: "center", backgroundColor: "#013220", borderRadius: 10 }}><Text style={{ color: "#fff", fontWeight: "700" }}>{pending ? "Saving..." : "Save debt"}</Text></Pressable>
      </View>
    </View>
  );
}
