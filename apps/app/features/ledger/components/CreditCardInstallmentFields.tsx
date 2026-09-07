import { Pressable, Text, TextInput, View } from "react-native";
import type { CreditCardInstallmentInterestType, CreditCardInstallmentSettlementStatus } from "../../../local-db/repositories/creditCardInstallments";

const palette = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#e8deca", card: "#f7eed9", brand: "#013220", selected: "#effff6" } as const;

export type InstallmentFormValue = {
  originalPrincipal: string;
  termMonths: string;
  remainingPrincipal: string;
  remainingMonths: string;
  monthlyAmortization: string;
  interestType: CreditCardInstallmentInterestType;
  interestRatePercent: string;
  settlementStatus: CreditCardInstallmentSettlementStatus;
};

export type InstallmentFieldErrors = Partial<Record<keyof InstallmentFormValue, string>>;
type Props = { value: InstallmentFormValue; errors: InstallmentFieldErrors; onChange: (value: InstallmentFormValue) => void };

function Field({ label, value, onChangeText, placeholder, error, decimal = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; error?: string; decimal?: boolean }) {
  return <View style={{ flex: 1 }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.muted, letterSpacing: 0.4, marginBottom: 8 }}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={palette.muted} keyboardType={decimal ? "decimal-pad" : "number-pad"} accessibilityHint={error} style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: error ? "#b42318" : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 15, color: palette.ink, backgroundColor: palette.card }} />
    {error ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#b42318", marginTop: 4 }}>{error}</Text> : null}
  </View>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: selected ? palette.brand : palette.line, backgroundColor: selected ? palette.selected : palette.card, padding: 12 }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: palette.ink }}>{label}</Text>
  </Pressable>;
}

export default function CreditCardInstallmentFields({ value, errors, onChange }: Props) {
  const update = (patch: Partial<InstallmentFormValue>) => onChange({ ...value, ...patch });
  return <View style={{ gap: 13, borderRadius: 16, borderWidth: 1, borderColor: palette.line, padding: 14, backgroundColor: "#fcf8f0" }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: palette.ink }}>Installment details</Text>
    <Field label="ORIGINAL PRINCIPAL" value={value.originalPrincipal} onChangeText={(originalPrincipal) => update({ originalPrincipal })} placeholder="Enter original principal" error={errors.originalPrincipal} decimal />
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Field label="TERM (MONTHS)" value={value.termMonths} onChangeText={(termMonths) => update({ termMonths })} placeholder="Enter installment term" error={errors.termMonths} />
      <Field label="REMAINING MONTHS" value={value.remainingMonths} onChangeText={(remainingMonths) => update({ remainingMonths })} placeholder="Enter remaining months" error={errors.remainingMonths} />
    </View>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Field label="REMAINING PRINCIPAL" value={value.remainingPrincipal} onChangeText={(remainingPrincipal) => update({ remainingPrincipal })} placeholder="Enter remaining principal" error={errors.remainingPrincipal} decimal />
      <Field label="MONTHLY AMORTIZATION" value={value.monthlyAmortization} onChangeText={(monthlyAmortization) => update({ monthlyAmortization })} placeholder="Enter monthly amortization" error={errors.monthlyAmortization} decimal />
    </View>
    <View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.muted, letterSpacing: 0.4, marginBottom: 8 }}>INTEREST TYPE</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Choice label="Zero Interest" selected={value.interestType === "zero_interest"} onPress={() => update({ interestType: "zero_interest", interestRatePercent: "" })} />
        <Choice label="Interest-Bearing" selected={value.interestType === "interest_bearing"} onPress={() => update({ interestType: "interest_bearing" })} />
      </View>
    </View>
    {value.interestType === "interest_bearing" ? <Field label="INTEREST RATE (%)" value={value.interestRatePercent} onChangeText={(interestRatePercent) => update({ interestRatePercent })} placeholder="Enter interest rate" error={errors.interestRatePercent} decimal /> : null}
    <View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.muted, letterSpacing: 0.4, marginBottom: 8 }}>SETTLEMENT STATUS</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Choice label="Active" selected={value.settlementStatus === "active"} onPress={() => update({ settlementStatus: "active" })} />
        <Choice label="Early settlement requested" selected={value.settlementStatus === "early_settlement_requested"} onPress={() => update({ settlementStatus: "early_settlement_requested" })} />
      </View>
    </View>
  </View>;
}
