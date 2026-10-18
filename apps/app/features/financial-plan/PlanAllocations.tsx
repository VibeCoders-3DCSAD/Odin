import { Text, TextInput, View } from "react-native";
import { allocationLabel, formatForecastPeso, formatPeso } from "./financialPlanPresentation";
import type { FinancialPlanAllocation } from "./types";
import { groupPlanAllocations } from "./helpers/groupPlanAllocations";

type Props = {
  allocations: FinancialPlanAllocation[];
  restrictions?: Record<string, unknown>;
  showSpendingProgress: boolean;
  readOnly: boolean;
  onFlexibleAmountChange: (index: number, amount: string) => void;
  onWeightChange: (index: number, weight: string) => void;
};

export function PlanAllocations({ allocations, restrictions, showSpendingProgress, readOnly, onFlexibleAmountChange, onWeightChange }: Props) {
  const groups = groupPlanAllocations(allocations, restrictions);
  if (groups.length === 0) return null;

  return (
    <View style={{ marginTop: 16 }}>
      <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: "#1B1C1A" }}>Category Allocations</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 3 }}>Fixed and minimum requirements are protected. Flexible amounts can be adjusted before saving.</Text>
      {groups.map((group) => (
        <View key={group.title} style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#013220" }}>{group.title}</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{formatPeso(group.allocations.reduce((total, { allocation }) => total + allocation.allocatedAmountCentavos, 0))}</Text>
          </View>
          {group.allocations.map(({ allocation, index }) => {
            const editable = allocation.allocationRule === "FLEXIBLE" && !readOnly;
            const spentAmountCentavos = allocation.spentAmountCentavos ?? 0;
            // Overspending shows as a negative remaining amount with a full red bar, not as zero.
            const remainingAmountCentavos = allocation.allocatedAmountCentavos - spentAmountCentavos;
            const overspent = remainingAmountCentavos < 0;
            const remainingPercent = overspent ? 100 : allocation.allocatedAmountCentavos > 0 ? Math.min(100, (remainingAmountCentavos / allocation.allocatedAmountCentavos) * 100) : 0;
            return (
              <View key={`${allocation.categoryId ?? allocation.subcategoryId}-${index}`} style={{ marginTop: 10, borderWidth: 1, borderColor: "#EAEAE6", borderRadius: 14, padding: 13, backgroundColor: "#FCF8F0" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{allocationLabel(allocation)}</Text>
                    {!readOnly ? <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: "#6B7A6F", marginTop: 2 }}>{allocation.allocationRule.toLowerCase()} {allocation.forecastAmountCentavos != null ? `· forecast ${formatForecastPeso(allocation.forecastAmountCentavos)}` : ""}</Text> : null}
                  </View>
                  {editable ? <TextInput value={(allocation.allocatedAmountCentavos / 100).toFixed(2)} onChangeText={(amount) => onFlexibleAmountChange(index, amount)} accessibilityLabel={`${allocationLabel(allocation)} flexible amount in pesos`} keyboardType="decimal-pad" style={{ width: 94, height: 40, borderWidth: 1, borderColor: "#D6D8D4", borderRadius: 9, paddingHorizontal: 9, fontFamily: "Manrope", fontWeight: "700", color: "#1B1C1A", textAlign: "right", backgroundColor: "#FFFFFF" }} /> : <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "#1B1C1A" }}>{formatPeso(allocation.allocatedAmountCentavos)}</Text>}
                </View>
                {showSpendingProgress ? <><View style={{ height: 7, backgroundColor: "#E6E8E3", borderRadius: 999, marginTop: 10, overflow: "hidden" }}><View style={{ width: `${remainingPercent}%`, height: "100%", backgroundColor: overspent ? "#D9001F" : "#0E6D46", borderRadius: 999 }} /></View><Text accessibilityLabel={overspent ? `${allocationLabel(allocation)} is ${formatPeso(-remainingAmountCentavos)} over budget` : undefined} style={{ fontFamily: "Manrope", fontSize: 10.5, color: overspent ? "#D9001F" : "#6B7A6F", fontWeight: overspent ? "700" : "400", marginTop: 5 }}>{formatPeso(remainingAmountCentavos)} remaining of {formatPeso(allocation.allocatedAmountCentavos)}{overspent ? " · over budget" : ""}</Text></> : null}
                {allocation.subcategoryWeightBps != null ? <View style={{ flexDirection: "row", alignItems: "center", marginTop: 9, gap: 8 }}><Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F" }}>Subcategory split weight</Text><TextInput value={(allocation.subcategoryWeightBps / 100).toFixed(2)} onChangeText={(weight) => onWeightChange(index, weight)} accessibilityLabel={`${allocationLabel(allocation)} subcategory weight percent`} keyboardType="decimal-pad" style={{ width: 70, height: 34, borderWidth: 1, borderColor: "#D6D8D4", borderRadius: 8, paddingHorizontal: 8, fontFamily: "Manrope", fontSize: 12, color: "#1B1C1A", textAlign: "right", backgroundColor: "#FFFFFF" }} /><Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F" }}>%</Text></View> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
