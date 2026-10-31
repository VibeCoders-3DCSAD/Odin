import React from "react";
import { View } from "react-native";
import { Chip, FieldError, FormCard, MonthEndNote, Note, SectionLabel, styles } from "../../../components/BudgieForm";
import RecurringScheduleFields from "../../../components/RecurringScheduleFields";
import { SavingsDate, SavingsInput, SavingsToggle } from "./SavingsFormControls";
import { CONTRIBUTION_CHOICES, CREDIT_CHOICES, WEEKDAY_NAMES, type SavingsFormDraft, type SavingsFormErrors, type SavingsFormType } from "../helpers/savingsAccountFormDraft";

type Props = { type: SavingsFormType; draft: SavingsFormDraft; errors: SavingsFormErrors; update: (patch: Partial<SavingsFormDraft>) => void };

export function SavingsInterestFields({ type, draft, errors, update }: Props) {
  return <FormCard title={type === "time_deposit" ? "Deposit terms" : "Interest"}>
    <SavingsInput label={type === "hysa" ? "Base annual interest rate" : "Annual interest rate"} value={draft.annualRate} onChange={(annualRate) => update({ annualRate })} numeric suffix="% p.a." placeholder="0.00" error={errors.annualRate} />
    <Note>Use the annual rate shown by your bank. Enter 0 if this account earns no interest.</Note>
    {type === "time_deposit" ? <>
      <SavingsDate label="Start date" value={draft.startDate} onChange={(startDate) => update({ startDate })} error={errors.startDate} />
      <SavingsDate label="Maturity date" value={draft.maturityDate} onChange={(maturityDate) => update({ maturityDate })} error={errors.maturityDate} />
      {draft.startDate && draft.maturityDate > draft.startDate ? <Note>{`Term: ${Math.round((Date.parse(draft.maturityDate) - Date.parse(draft.startDate)) / 86_400_000)} days. Calculated from your dates.`}</Note> : null}
      <SavingsInput label="Early-withdrawal terms (optional)" value={draft.withdrawalTerms} onChange={(withdrawalTerms) => update({ withdrawalTerms })} multiline placeholder="Any restrictions or penalties from your bank" />
    </> : <>
      <SectionLabel>Interest credited</SectionLabel>
      <View style={styles.chips}>{CREDIT_CHOICES.map((frequency) => <Chip key={frequency} label={frequency} accessibilityLabel={`Interest credited ${frequency.toLowerCase()}`} selected={draft.creditFrequency === frequency} onPress={() => update({ creditFrequency: frequency })} />)}</View>
    </>}
    {type === "hysa" ? <>
      <SavingsToggle label="Higher rate currently active?" description="Enter the rate already unlocked in your bank app." value={draft.boosted} onToggle={() => update({ boosted: !draft.boosted })} />
      {draft.boosted ? <>
        <SavingsInput label="Total annual rate while boosted" value={draft.boostedRate} onChange={(boostedRate) => update({ boostedRate })} numeric suffix="% p.a." placeholder="e.g. 15" error={errors.boostedRate} />
        <Note>This is your total rate, including the base rate.</Note>
        <SavingsInput label="Balance eligible for higher rate" value={draft.eligibleBalance} onChange={(eligibleBalance) => update({ eligibleBalance })} numeric suffix="₱" placeholder="e.g. 100,000" error={errors.eligibleBalance} />
        <SavingsDate label="Higher rate starts" value={draft.boostStart} onChange={(boostStart) => update({ boostStart })} error={errors.boostStart} />
        <SavingsDate label="Higher rate ends" value={draft.boostEnd} onChange={(boostEnd) => update({ boostEnd })} error={errors.boostEnd} />
        <Note>The base rate applies above the eligible balance and after the higher rate ends.</Note>
      </> : null}
    </> : null}
  </FormCard>;
}

export function SavingsContributionFields({ draft, errors, update }: Omit<Props, "type">) {
  const frequency = CONTRIBUTION_CHOICES.find((choice) => choice.key === draft.frequency)?.frequency;
  return <FormCard title="Contributions">
    <SectionLabel>Contribution frequency</SectionLabel>
    <View style={styles.chips}>{CONTRIBUTION_CHOICES.map((choice) => <Chip key={choice.key} label={choice.label} selected={draft.frequency === choice.key} onPress={() => update({ frequency: choice.key })} />)}</View>
    {frequency ? <>
      <SavingsInput label="Planned contribution amount" value={draft.contribution} onChange={(contribution) => update({ contribution })} numeric suffix="₱" placeholder="0.00" error={errors.contribution} />
      <RecurringScheduleFields showFrequencySelector={false} frequencies={[]} weekdayLabels={WEEKDAY_NAMES} value={{ frequency, intervalCount: "1", dayOfMonth: draft.firstDay, secondDayOfMonth: draft.secondDay, dayOfWeek: draft.weekday, monthOfYear: null }} onChange={(next) => update({ firstDay: next.dayOfMonth, secondDay: next.secondDayOfMonth, weekday: next.dayOfWeek })} />
      {errors.schedule ? <FieldError>{errors.schedule}</FieldError> : null}
      {draft.frequency === "monthly" || draft.frequency === "semi_monthly" ? <MonthEndNote days={[draft.firstDay, draft.frequency === "semi_monthly" ? draft.secondDay : null]} /> : null}
      <Note>Scheduled amounts help plan your savings. Record each contribution when it happens.</Note>
    </> : <Note>Contribute manually whenever you choose.</Note>}
  </FormCard>;
}

export function SavingsTargetFields({ draft, errors, update }: Omit<Props, "type">) {
  return <FormCard>
    <SavingsToggle label="Set a savings goal" description="Optional. Add a target amount and date to work toward." value={draft.hasGoal} onToggle={() => update({ hasGoal: !draft.hasGoal })} />
    {draft.hasGoal ? <>
      <SavingsInput label="Target amount" value={draft.target} onChange={(target) => update({ target })} numeric suffix="₱" placeholder="0.00" error={errors.target} />
      <SavingsDate label="Target date" value={draft.targetDate} onChange={(targetDate) => update({ targetDate })} error={errors.targetDate} />
    </> : null}
  </FormCard>;
}
