import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { getBudgetDraftTracking, listBudgetDrafts, type Budget, type BudgetTracking } from "../../local-db/repositories/budgets";
import { calculateProvisionalPercentage, PROVISIONAL_TRACKING_LABEL } from "./constant";

type Props = {
  userId: string;
};

export default function BudgetingScreen({ userId }: Props) {
  const [drafts, setDrafts] = useState<Budget[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<BudgetTracking | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setDrafts(await listBudgetDrafts(userId).catch(() => []));
    setLoading(false);
  }, [userId]);

  const openDraft = async (id: string) => {
    setSelectedDraft(await getBudgetDraftTracking(userId, id).catch(() => null));
  };

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>{selectedDraft ? "Budget tracking" : "Budgeting"}</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>
        {selectedDraft ? `${selectedDraft.periodStart} to ${selectedDraft.periodEnd}` : "Plan your money with offline budget drafts."}
      </Text>

      {selectedDraft ? (
        <View>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#D46B08", marginTop: 16 }}>{PROVISIONAL_TRACKING_LABEL}</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A", marginTop: 16 }}>{selectedDraft.totalAmountMinor.toLocaleString()} total</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>{selectedDraft.allocatedAmountMinor.toLocaleString()} allocated, {selectedDraft.unallocatedAmountMinor.toLocaleString()} unallocated</Text>
          {selectedDraft.allocations.map((allocation) => {
            const percentage = calculateProvisionalPercentage(allocation.actualAmountMinor, allocation.amountMinor);
            return (
              <View key={allocation.id} style={{ marginTop: 12, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{allocation.categoryId ?? allocation.subcategoryId}</Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 4 }}>{allocation.actualAmountMinor.toLocaleString()} spent of {allocation.amountMinor.toLocaleString()}</Text>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: percentage > 100 ? "#D9001F" : "#0E6D46", marginTop: 4 }}>{percentage.toFixed(1)}% provisionally tracked</Text>
              </View>
            );
          })}
          <Pressable onPress={() => setSelectedDraft(null)} style={{ marginTop: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#0E6D46" }}>Back to drafts</Text></Pressable>
        </View>
      ) : loading ? <ActivityIndicator color="#0E6D46" /> : drafts.length === 0 ? (
        <View style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A", marginBottom: 6 }}>
            No budget drafts yet
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>
            Create a manual draft to start allocating money across your categories.
          </Text>
        </View>
      ) : drafts.map((draft) => (
        <Pressable key={draft.id} onPress={() => void openDraft(draft.id)} style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>{draft.periodKind} draft</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 10, color: "#0E6D46" }}>DRAFT</Text>
          </View>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>{draft.periodStart} to {draft.periodEnd}</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#1B1C1A", marginTop: 12 }}>{draft.allocatedAmountMinor.toLocaleString()} allocated</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F" }}>{draft.unallocatedAmountMinor.toLocaleString()} unallocated</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
