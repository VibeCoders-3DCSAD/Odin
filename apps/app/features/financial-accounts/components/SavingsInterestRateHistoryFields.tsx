import { Pressable, Text, View } from "react-native";
import { interestToday } from "../helpers/savingsInterestConfiguration";
import type { SavingsInterestConfiguration } from "@odin/savings-interest";
import { InterestDateInput, InterestNumberInput, interestText } from "./InterestFormControls";

type Props = { configuration: SavingsInterestConfiguration; onChange: (changes: Partial<SavingsInterestConfiguration>) => void; savedCount: number };
export default function SavingsInterestRateHistoryFields({ configuration: c, onChange, savedCount }: Props) {
  return <View style={{ gap: 12 }}>
    <Text style={{ ...interestText, fontWeight: "700" }}>EFFECTIVE-DATED RATES</Text>
    <Text style={interestText}>The interest rate applies from the start date. Add later rate changes in date order; a new rate must not replace an earlier rate retroactively.</Text>
    {c.rateHistory.map((entry, index) => index < savedCount ? <Text key={index} style={interestText}>{entry.effectiveOn}: {entry.rateBps / 100}% p.a.</Text> : <View key={index} style={{ gap: 8 }}>
      <InterestDateInput label={`Rate ${index + 1} effective date`} value={entry.effectiveOn} onChange={(effectiveOn) => onChange({ rateHistory: c.rateHistory.map((row, i) => i === index ? { ...row, effectiveOn } : row) })} />
      <InterestNumberInput label={`Rate ${index + 1} (% p.a.)`} value={entry.rateBps} scale={100} onChange={(rateBps) => onChange({ rateHistory: c.rateHistory.map((row, i) => i === index ? { ...row, rateBps: rateBps ?? NaN } : row) })} />
    </View>)}
    {c.rateHistory.length > savedCount ? <Pressable accessibilityRole="button" accessibilityLabel="Remove unsaved rate change" onPress={() => onChange({ rateHistory: c.rateHistory.slice(0, -1) })} style={{ paddingVertical: 10 }}><Text style={interestText}>Remove unsaved rate change</Text></Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Add rate change" disabled={c.rateHistory.length >= 100} onPress={() => {
      const last = c.rateHistory[c.rateHistory.length - 1];
      const candidate = last ? new Date(`${last.effectiveOn}T00:00:00Z`) : null;
      const hasLastDate = candidate && Number.isFinite(candidate.getTime()) && last!.effectiveOn >= interestToday();
      const start = new Date(`${c.startsOn}T00:00:00Z`);
      const date = hasLastDate ? candidate : Number.isFinite(start.getTime()) && c.startsOn > interestToday() ? start : new Date(`${interestToday()}T00:00:00Z`);
      if (hasLastDate) date.setUTCDate(date.getUTCDate() + 1);
      onChange({ rateHistory: [...c.rateHistory, { effectiveOn: date.toISOString().slice(0, 10), rateBps: last?.rateBps ?? 0 }] });
    }} style={{ paddingVertical: 10 }}><Text style={interestText}>Add rate change</Text></Pressable>
  </View>;
}
