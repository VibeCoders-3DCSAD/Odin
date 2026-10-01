import { Text, TextInput, View } from "react-native";
import { formatPeso, reservationLabel } from "./financialPlanPresentation";
import type { FinancialPlanReservation } from "./types";

type Props = { title: string; reservations: FinancialPlanReservation[]; surplusCentavos?: number; onSurplusAmountChange?: (amount: string) => void };

export function PlanReservations({ title, reservations, surplusCentavos = 0, onSurplusAmountChange }: Props) {
  const total = reservations.reduce((sum, reservation) => sum + reservation.amountCentavos, 0) + surplusCentavos;
  return (
    <View style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#1B1C1A" }}>{title}</Text>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>{formatPeso(total)}</Text>
      </View>
      {reservations.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 6 }}>No required reservations for this month.</Text> : null}
       {reservations.map((reservation, index) => (
        <View key={`${reservationLabel(reservation)}-${index}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#414942" }}>{reservationLabel(reservation)}</Text>
            {reservation.dueDate ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F", marginTop: 2 }}>Due {reservation.dueDate}</Text> : null}
          </View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#1B1C1A" }}>{formatPeso(reservation.amountCentavos)}</Text>
        </View>
       ))}
       <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 10 }}><Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#414942" }}>Surplus</Text>{onSurplusAmountChange ? <TextInput value={(surplusCentavos / 100).toFixed(2)} onChangeText={onSurplusAmountChange} accessibilityLabel={`${title} surplus amount in pesos`} keyboardType="decimal-pad" style={{ width: 94, height: 40, borderWidth: 1, borderColor: "#D6D8D4", borderRadius: 9, paddingHorizontal: 9, fontFamily: "Manrope", fontWeight: "700", color: "#1B1C1A", textAlign: "right", backgroundColor: "#FFFFFF" }} /> : <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#1B1C1A" }}>{formatPeso(surplusCentavos)}</Text>}</View>
    </View>
  );
}
