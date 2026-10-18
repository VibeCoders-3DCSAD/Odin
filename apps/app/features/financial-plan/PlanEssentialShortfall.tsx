import { Text, View } from "react-native";
import { formatPeso } from "./financialPlanPresentation";
import type { FinancialPlanAllocation } from "./types";
import { groupPlanAllocations } from "./helpers/groupPlanAllocations";
import { essentialShortfallCentavos } from "./helpers/essentialShortfall";

type Props = {
  allocations: FinancialPlanAllocation[];
  restrictions?: Record<string, unknown>;
};

export function PlanEssentialShortfall({ allocations, restrictions }: Props) {
  const groups = groupPlanAllocations(allocations, restrictions);
  const essentials = groups.find((group) => group.title === "Essentials");
  const shortfallCentavos = essentialShortfallCentavos(essentials?.allocations.map(({ allocation }) => allocation) ?? []);
  if (shortfallCentavos === 0) return null;

  return (
    <View accessible accessibilityRole="alert" style={{ marginTop: 12, borderRadius: 14, padding: 14, backgroundColor: "#FFF0F2" }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#D9001F" }}>Essentials shortfall: {formatPeso(shortfallCentavos)}</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>Your plan cannot cover all Essentials. This is the total amount missing from their forecast or required budgets.</Text>
    </View>
  );
}
