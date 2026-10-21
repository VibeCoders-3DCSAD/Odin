import { Text, View } from "react-native";
import type { SavingsInterestConfiguration } from "@odin/savings-interest";
import { InterestChoices, InterestNumberInput, InterestToggle, interestText } from "./InterestFormControls";

type Props = { configuration: SavingsInterestConfiguration; onChange: (changes: Partial<SavingsInterestConfiguration>) => void };
export default function SavingsInterestRulesFields({ configuration: c, onChange }: Props) {
  return <View style={{ gap: 14 }}>
    <Text style={{ ...interestText, fontWeight: "700" }}>BALANCE LIMITS AND TAX</Text>
    <InterestNumberInput label="Minimum qualifying balance (₱, optional)" value={c.minimumQualifyingBalanceCentavos} scale={100} onChange={(minimumQualifyingBalanceCentavos) => onChange({ minimumQualifyingBalanceCentavos })} />
    <InterestNumberInput label="Maximum interest-bearing balance (₱, optional)" value={c.maximumInterestBearingBalanceCentavos} scale={100} onChange={(maximumInterestBearingBalanceCentavos) => onChange({ maximumInterestBearingBalanceCentavos })} />
    <InterestChoices label="Day-count basis" value={c.dayCountBasis} options={[
      { value: "actual_365", label: "Actual/365" }, { value: "actual_366", label: "Actual/366" }, { value: "actual_actual", label: "Actual/Actual" },
    ]} onChange={(dayCountBasis) => onChange({ dayCountBasis })} />
    <InterestToggle label="Withholding tax" value={c.taxEnabled} onChange={(taxEnabled) => onChange({ taxEnabled })} />
    {c.taxEnabled ? <InterestNumberInput label="Withholding tax (%)" value={c.withholdingTaxBps} scale={100} onChange={(withholdingTaxBps) => onChange({ withholdingTaxBps: withholdingTaxBps ?? NaN })} /> : null}
    <Text style={interestText}>Round to centavos on crediting and carry fractional amounts forward. For simple interest, withdrawals reduce deposited principal first, then credited interest.</Text>
    <Text style={{ ...interestText, fontWeight: "700" }}>INTEREST SUMMARY</Text>
    <Text style={interestText}>Record actual bank interest manually as income. These settings do not add transactions or change your balance.</Text>
    <InterestToggle label="Show interest breakdown" value={c.showBreakdown} onChange={(showBreakdown) => onChange({ showBreakdown })} />
    <Text style={interestText}>Breakdown preference: current balance, gross accrual, estimated tax, net interest, applicable rate and next credit date.</Text>
  </View>;
}
