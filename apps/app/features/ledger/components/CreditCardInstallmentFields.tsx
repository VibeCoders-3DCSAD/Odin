import { Pressable, Text, TextInput, View } from "react-native";
import type { CreditCardInstallmentInterestType } from "../../../local-db/repositories/creditCardInstallments";

const palette = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#e8deca", card: "#f7eed9", brand: "#013220", selected: "#effff6" } as const;
const fieldLabelStyle = { fontFamily: "Manrope", fontWeight: "600" as const, fontSize: 11, lineHeight: 13, minHeight: 28, color: palette.muted, letterSpacing: 0.4, marginBottom: 8, textAlignVertical: "bottom" as const };

export type InstallmentFormValue = {
  originalPrincipal: string;
  termMonths: string;
  remainingPrincipal: string;
  remainingMonths: string;
  monthlyAmortization: string;
  interestType: CreditCardInstallmentInterestType;
  interestRatePercent: string;
};

export type InstallmentFieldErrors = Partial<Record<keyof InstallmentFormValue, string>>;
type Props = { value: InstallmentFormValue; errors: InstallmentFieldErrors; onChange: (value: InstallmentFormValue) => void; readOnly?: boolean };

function Field({ label, value, onChangeText, placeholder, error, decimal = false, editable = true }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; error?: string; decimal?: boolean; editable?: boolean }) {
  return <View style={{ flex: 1 }}>
    <Text style={fieldLabelStyle}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={palette.muted} keyboardType={decimal ? "decimal-pad" : "number-pad"} accessibilityHint={error} editable={editable} style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: error ? "#b42318" : palette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 15, color: palette.ink, backgroundColor: editable ? palette.card : "#ede4d1" }} />
    {error ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#b42318", marginTop: 4 }}>{error}</Text> : null}
  </View>;
}

function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ selected, disabled }} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: selected ? palette.brand : palette.line, backgroundColor: selected ? palette.selected : palette.card, padding: 12, opacity: disabled ? 0.65 : 1 }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: palette.ink }}>{label}</Text>
  </Pressable>;
}

export default function CreditCardInstallmentFields({ value, errors, onChange, readOnly = false }: Props) {
  const update = (patch: Partial<InstallmentFormValue>) => {
    if (readOnly) return;
    onChange({ ...value, ...patch });
  };
  return <View style={{ gap: 13, borderRadius: 16, borderWidth: 1, borderColor: palette.line, padding: 14, backgroundColor: "#fcf8f0" }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: palette.ink }}>Installment details</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: palette.muted }}>{readOnly ? "Installment transactions cannot be edited after creation because amortizations and available-credit holds may already be linked to billing cycles." : "Odin holds the full purchase principal against available credit. Change remaining principal/months only when recording an older installment with paid months."}</Text>
    <Field label="ORIGINAL PRINCIPAL" value={value.originalPrincipal} onChangeText={() => undefined} placeholder="Transaction amount" error={errors.originalPrincipal} decimal editable={false} />
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Field label="TERM (MONTHS)" value={value.termMonths} onChangeText={(termMonths) => update({ termMonths })} placeholder="Enter installment term" error={errors.termMonths} editable={!readOnly} />
      <Field label="REMAINING MONTHS" value={value.remainingMonths} onChangeText={(remainingMonths) => update({ remainingMonths })} placeholder="Enter remaining months" error={errors.remainingMonths} editable={!readOnly} />
    </View>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Field label="REMAINING PRINCIPAL" value={value.remainingPrincipal} onChangeText={(remainingPrincipal) => update({ remainingPrincipal })} placeholder="Enter remaining principal" error={errors.remainingPrincipal} decimal editable={!readOnly} />
      <Field label="MONTHLY AMORTIZATION" value={value.monthlyAmortization} onChangeText={(monthlyAmortization) => update({ monthlyAmortization })} placeholder="Enter monthly amortization" error={errors.monthlyAmortization} decimal editable={!readOnly} />
    </View>
    <View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.muted, letterSpacing: 0.4, marginBottom: 8 }}>INTEREST TYPE</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Choice label="Zero Interest" selected={value.interestType === "zero_interest"} disabled={readOnly} onPress={() => update({ interestType: "zero_interest", interestRatePercent: "" })} />
        <Choice label="Interest-Bearing" selected={value.interestType === "interest_bearing"} disabled={readOnly} onPress={() => update({ interestType: "interest_bearing" })} />
      </View>
    </View>
    {value.interestType === "interest_bearing" ? <Field label="INTEREST RATE (%)" value={value.interestRatePercent} onChangeText={(interestRatePercent) => update({ interestRatePercent })} placeholder="Enter interest rate" error={errors.interestRatePercent} decimal editable={!readOnly} /> : null}
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: palette.muted }}>New installment purchases are saved as active. Early settlement is handled in its own issuer-recognition flow.</Text>
  </View>;
}
