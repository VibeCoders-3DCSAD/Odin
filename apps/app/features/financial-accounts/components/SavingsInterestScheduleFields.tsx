import { Text, View } from "react-native";
import type { SavingsInterestConfiguration } from "@odin/savings-interest";
import { InterestChoices, InterestDateInput, InterestNumberInput, interestText } from "./InterestFormControls";
import { interestToday } from "../helpers/savingsInterestConfiguration";

type Props = { configuration: SavingsInterestConfiguration; isAdb: boolean; onChange: (changes: Partial<SavingsInterestConfiguration>) => void };
export default function SavingsInterestScheduleFields({ configuration: c, isAdb, onChange }: Props) {
  return <View style={{ gap: 14 }}>
    <Text style={{ ...interestText, fontWeight: "700" }}>CALCULATION AND CREDIT TIMING</Text>
    <Text style={interestText}>Calculated daily using Asia/Manila end-of-day balances. Compound interest starts earning on net interest when it is credited.</Text>
    <InterestChoices label="Credit frequency" value={c.creditFrequency} options={[
      { value: "daily", label: "Daily" }, { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "yearly", label: "Yearly" }, { value: "custom", label: "Custom" },
    ]} onChange={(creditFrequency) => onChange({ creditFrequency })} />
    {c.creditFrequency === "custom" ? <InterestNumberInput label="Credit interval (days)" value={c.creditIntervalDays} onChange={(creditIntervalDays) => onChange({ creditIntervalDays })} /> : null}
    <InterestChoices label="Posting timing" value={c.postingMode} options={[
      { value: "period_end", label: "After period-end" }, { value: "day_of_month", label: "Day of month" }, { value: "specific_date", label: "Specific date" },
    ]} onChange={(postingMode) => onChange({ postingMode })} />
    {c.postingMode === "day_of_month" ? <><InterestNumberInput label="Posting day (1–31)" value={c.postingDay} onChange={(postingDay) => onChange({ postingDay })} /><Text style={interestText}>Use the last day in months shorter than your selected posting day.</Text></> : null}
    {c.postingMode === "specific_date" ? <InterestDateInput label="Posting date" value={c.postingDate ?? ""} onChange={(postingDate) => onChange({ postingDate: postingDate || null })} /> : null}
    <InterestDateInput label="Interest start date" value={c.startsOn} onChange={(startsOn) => onChange({ startsOn })} />
    {c.startsOn < interestToday() || c.startingBalanceCentavos !== null ? <InterestNumberInput label="Interest starting balance (₱)" value={c.startingBalanceCentavos} scale={100} onChange={(startingBalanceCentavos) => onChange({ startingBalanceCentavos })} /> : null}
    {isAdb ? <>
      <InterestChoices label="ADB averaging period" value={c.averagingPeriod} options={[
        { value: "calendar_month", label: "Calendar month" }, { value: "credit_period", label: "Credit period" }, { value: "custom", label: "Custom" },
      ]} onChange={(averagingPeriod) => onChange({ averagingPeriod })} />
      {c.averagingPeriod === "custom" ? <InterestNumberInput label="Averaging interval (days)" value={c.averagingIntervalDays} onChange={(averagingIntervalDays) => onChange({ averagingIntervalDays })} /> : null}
    </> : null}
  </View>;
}
