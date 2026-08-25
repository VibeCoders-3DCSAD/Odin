import { Pressable, Text, View } from "react-native";
import type { Debt } from "../../../local-db/repositories/debts";

type Props = {
  priorities: string[];
  debts: Debt[];
  pendingIds: Set<string>;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
};

export function DebtPriorityEditor({ priorities, debts, pendingIds, onMove, onRemove }: Props) {
  const byId = new Map(debts.map((debt) => [debt.id, debt]));
  return (
    <View style={{ backgroundColor: "#F7F0E1", borderRadius: 16, padding: 14, gap: 8 }}>
      <Text style={{ fontWeight: "800", color: "#1B1C1A" }}>Priority overrides</Text>
      <Text style={{ color: "#6B7A6F", fontSize: 12 }}>Surplus follows this order before the global strategy.</Text>
      {priorities.length === 0 ? <Text style={{ color: "#6B7A6F", fontSize: 12 }}>No priority overrides yet. Use Prioritize on an active debt.</Text> : priorities.map((id, index) => {
        const debt = byId.get(id);
        if (!debt) return null;
        const pending = pendingIds.has(id);
        return <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ width: 20, fontWeight: "800", color: "#0E6D46" }}>{index + 1}.</Text>
          <Text style={{ flex: 1, color: "#1B1C1A" }}>{debt.name}</Text>
          <Pressable disabled={pending || index === 0} accessibilityLabel={`Move ${debt.name} priority up`} onPress={() => onMove(id, -1)}><Text>Up</Text></Pressable>
          <Pressable disabled={pending || index === priorities.length - 1} accessibilityLabel={`Move ${debt.name} priority down`} onPress={() => onMove(id, 1)}><Text>Down</Text></Pressable>
          <Pressable disabled={pending} accessibilityLabel={`Remove ${debt.name} priority`} onPress={() => onRemove(id)}><Text style={{ color: "#D9001F" }}>Remove</Text></Pressable>
        </View>;
      })}
    </View>
  );
}
