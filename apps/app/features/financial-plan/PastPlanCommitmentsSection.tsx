import { Text, View } from "react-native";
import { commitmentStatusLabel, formatPeso } from "./financialPlanPresentation";
import type { PlanCommitmentStatus } from "./pastPlanTypes";

export type PastPlanCommitmentItem = {
  key: string;
  label: string;
  reservedCentavos: number;
  actualCentavos: number;
  additionalCentavos: number;
  status: PlanCommitmentStatus;
};

type Props = { title: string; kind: "savings" | "debt"; items: PastPlanCommitmentItem[]; emptyText: string };

const STATUS_COLORS: Record<PlanCommitmentStatus, { background: string; text: string }> = {
  met: { background: "#E3F2EA", text: "#0E6D46" },
  partial: { background: "#FFF8E7", text: "#6F4A00" },
  not_recorded: { background: "#ECEDEA", text: "#414942" },
  unplanned: { background: "#E6EEF8", text: "#1F4E8C" },
};

export function PastPlanCommitmentsSection({ title, kind, items, emptyText }: Props) {
  const actualLabel = kind === "savings" ? "Contributed" : "Paid";
  return (
    <View style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
      <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#1B1C1A" }}>{title}</Text>
      {items.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 6 }}>{emptyText}</Text> : null}
      {items.map((item) => {
        const statusLabel = commitmentStatusLabel(item.status, kind);
        return (
          <View key={item.key} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 12.5, color: "#1B1C1A" }}>{item.label}</Text>
              <View accessibilityLabel={`${item.label}: ${statusLabel}`} style={{ backgroundColor: STATUS_COLORS[item.status].background, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 10.5, color: STATUS_COLORS[item.status].text }}>{statusLabel}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F", marginTop: 3 }}>Reserved {formatPeso(item.reservedCentavos)} · {actualLabel} {formatPeso(item.actualCentavos)}</Text>
            {item.additionalCentavos > 0 ? <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: "#414942", marginTop: 2 }}>Additional {formatPeso(item.additionalCentavos)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
