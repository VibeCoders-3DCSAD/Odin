import { Text, TextInput, View } from "react-native";
import { allocationLabel, formatPeso } from "./financialPlanPresentation";
import type { FinancialPlanAllocation } from "./types";

type Props = {
  allocations: FinancialPlanAllocation[];
  onFlexibleAmountChange: (index: number, amount: string) => void;
  onWeightChange: (index: number, weight: string) => void;
};

export function PlanAllocations({ allocations, onFlexibleAmountChange, onWeightChange }: Props) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: "#1B1C1A" }}>Category recommendation</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 3 }}>Fixed and minimum requirements are protected. Flexible amounts can be adjusted before saving.</Text>
      {allocations.map((allocation, index) => {
        const editable = allocation.allocationRule === "FLEXIBLE";
        return (
          <View key={`${allocation.categoryId ?? allocation.subcategoryId}-${index}`} style={{ marginTop: 10, borderWidth: 1, borderColor: "#EAEAE6", borderRadius: 14, padding: 13, backgroundColor: "#FCF8F0" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{allocationLabel(allocation)}</Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: "#6B7A6F", marginTop: 2 }}>{allocation.allocationRule.toLowerCase()} {allocation.forecastAmountCentavos != null ? `· forecast ${formatPeso(allocation.forecastAmountCentavos)}` : ""}</Text>
              </View>
              {editable ? <TextInput value={(allocation.allocatedAmountCentavos / 100).toFixed(2)} onChangeText={(amount) => onFlexibleAmountChange(index, amount)} accessibilityLabel={`${allocationLabel(allocation)} flexible amount in pesos`} keyboardType="decimal-pad" style={{ width: 94, height: 40, borderWidth: 1, borderColor: "#D6D8D4", borderRadius: 9, paddingHorizontal: 9, fontFamily: "Manrope", fontWeight: "700", color: "#1B1C1A", textAlign: "right", backgroundColor: "#FFFFFF" }} /> : <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "#1B1C1A" }}>{formatPeso(allocation.allocatedAmountCentavos)}</Text>}
            </View>
            {allocation.subcategoryWeightBps != null ? <View style={{ flexDirection: "row", alignItems: "center", marginTop: 9, gap: 8 }}><Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F" }}>Subcategory split weight</Text><TextInput value={(allocation.subcategoryWeightBps / 100).toFixed(2)} onChangeText={(weight) => onWeightChange(index, weight)} accessibilityLabel={`${allocationLabel(allocation)} subcategory weight percent`} keyboardType="decimal-pad" style={{ width: 70, height: 34, borderWidth: 1, borderColor: "#D6D8D4", borderRadius: 8, paddingHorizontal: 8, fontFamily: "Manrope", fontSize: 12, color: "#1B1C1A", textAlign: "right", backgroundColor: "#FFFFFF" }} /><Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F" }}>%</Text></View> : null}
          </View>
        );
      })}
    </View>
  );
}
