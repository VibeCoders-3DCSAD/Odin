import { Text, View } from "react-native";
import { allocationLabel, formatPeso, labelWithRemovedSuffix, type FinancialPlanLabels } from "../../helpers/financialPlanPresentation";
import type { PlanSpendingReview, PlanSpendingReviewRow } from "../pastPlanTypes";

type Props = { review: PlanSpendingReview; labels: FinancialPlanLabels };

function spendingRowLabel(row: PlanSpendingReviewRow, labels: FinancialPlanLabels): string {
  const id = row.subcategoryId ?? row.categoryId;
  const label = (row.subcategoryId ? labels.subcategories[row.subcategoryId] : row.categoryId ? labels.categories[row.categoryId] : undefined)
    ?? allocationLabel({ categoryId: row.categoryId, subcategoryId: row.subcategoryId, allocationRule: row.allocationRule, allocatedAmountCentavos: row.plannedCentavos, floorAmountCentavos: 0 });
  return labelWithRemovedSuffix(label, id, labels.removedIds);
}

function formatVariance(centavos: number): string {
  return centavos < 0 ? `-${formatPeso(-centavos)}` : formatPeso(centavos);
}

const detailText = { fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F", marginTop: 3 } as const;

export function PastPlanSpendingSection({ review, labels }: Props) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: "#1B1C1A" }}>Category Allocations</Text>
      {review.rows.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 6 }}>No category allocations in this plan.</Text> : null}
      {review.rows.map((row) => {
        const label = spendingRowLabel(row, labels);
        return (
          <View key={row.allocationId} style={{ marginTop: 10, borderWidth: 1, borderColor: row.exceeded ? "#F3B8B0" : "#EAEAE6", borderRadius: 14, padding: 13, backgroundColor: "#FCF8F0" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{label}</Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: "#6B7A6F", marginTop: 2 }}>{row.allocationRule.toLowerCase()} allocation</Text>
              </View>
              {row.exceeded ? <View accessibilityLabel={`${label} is over allocation`} style={{ backgroundColor: "#FBE9E7", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 10.5, color: "#D9001F" }}>Over allocation</Text></View> : null}
            </View>
            <Text style={detailText}>Planned {formatPeso(row.plannedCentavos)} · Actual {formatPeso(row.actualCentavos)}</Text>
            <Text style={{ ...detailText, color: row.varianceCentavos < 0 ? "#D9001F" : "#0E6D46", fontWeight: "700" }}>Variance {formatVariance(row.varianceCentavos)}</Text>
          </View>
        );
      })}
      {review.unplannedActualCentavos > 0 ? (
        <View style={{ marginTop: 10, borderWidth: 1, borderColor: "#EAEAE6", borderRadius: 14, padding: 13, backgroundColor: "#FCF8F0", flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>Unplanned spending</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: "#6B7A6F", marginTop: 2 }}>Categories without an allocation</Text>
          </View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "#1B1C1A" }}>{formatPeso(review.unplannedActualCentavos)}</Text>
        </View>
      ) : null}
      <View style={{ marginTop: 12, borderRadius: 16, padding: 16, backgroundColor: "#013220" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#D7EEE2" }}>Planned total</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "#FFFFFF" }}>{formatPeso(review.plannedTotalCentavos)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#D7EEE2" }}>Actual total</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "#FFFFFF" }}>{formatPeso(review.actualTotalCentavos)}</Text>
        </View>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: review.exceeded ? "#FFB4AB" : "#FFFFFF", marginTop: 10 }}>{review.exceeded ? "Over plan" : "Within plan"}</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#D7EEE2", marginTop: 3 }}>Actual total includes unplanned spending.</Text>
      </View>
    </View>
  );
}
