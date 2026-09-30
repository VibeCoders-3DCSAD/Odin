import { Text, View } from "react-native";
import { formatPeso, reservationLabel } from "./financialPlanPresentation";
import type { FinancialPlanReservation } from "./types";

type Props = { title: string; reservations: FinancialPlanReservation[]; surplusCentavos?: number };

export function PlanReservations({ title, reservations, surplusCentavos = 0 }: Props) {
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
       {surplusCentavos > 0 ? <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 10 }}><Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#414942" }}>Surplus</Text><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#1B1C1A" }}>{formatPeso(surplusCentavos)}</Text></View> : null}
    </View>
  );
}
