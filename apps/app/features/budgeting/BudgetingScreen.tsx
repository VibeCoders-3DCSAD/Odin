import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { listBudgetDrafts, type Budget } from "../../local-db/repositories/budgets";

type Props = {
  userId: string;
};

export default function BudgetingScreen({ userId }: Props) {
  const [drafts, setDrafts] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setDrafts(await listBudgetDrafts(userId).catch(() => []));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>
        Budgeting
      </Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>
        Plan your money with offline budget drafts.
      </Text>

      {loading ? <ActivityIndicator color="#0E6D46" /> : drafts.length === 0 ? (
        <View style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A", marginBottom: 6 }}>
            No budget drafts yet
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>
            Create a manual draft to start allocating money across your categories.
          </Text>
        </View>
      ) : drafts.map((draft) => (
        <View key={draft.id} style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>{draft.periodKind} draft</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 10, color: "#0E6D46" }}>DRAFT</Text>
          </View>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>{draft.periodStart} to {draft.periodEnd}</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#1B1C1A", marginTop: 12 }}>{draft.allocatedAmountMinor.toLocaleString()} allocated</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F" }}>{draft.unallocatedAmountMinor.toLocaleString()} unallocated</Text>
        </View>
      ))}
    </ScrollView>
  );
}
