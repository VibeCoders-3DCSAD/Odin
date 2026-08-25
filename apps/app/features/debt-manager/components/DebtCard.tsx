import { Pressable, Text, View } from "react-native";
import type { Debt } from "../../../local-db/repositories/debts";
import { getDebtPreset } from "../presets";
import { money } from "../formatters";

type Allocation = { requiredPaymentMinor: number; allocatedPaymentMinor: number; status: "Ahead" | "On Schedule" | "Behind"; extraPaymentMinor: number };
type Props = { debt: Debt; allocation?: Allocation; confirming: boolean; pending: boolean; onRecordPayment: () => void; onEdit: () => void; onRequestDelete: () => void; onCancelDelete: () => void; onConfirmDelete: () => void; onMovePriority: (direction: -1 | 1) => void; onRemovePriority: () => void; onChangeStatus: (status: "active" | "archived" | "paid_off") => void };

export function DebtCard({ debt, allocation, confirming, pending, onRecordPayment, onEdit, onRequestDelete, onCancelDelete, onConfirmDelete, onMovePriority, onRemovePriority, onChangeStatus }: Props) {
  const archived = debt.status === "archived";
  return <View style={{ backgroundColor: "#F1F0EB", borderRadius: 16, padding: 14 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}><View><Text style={{ fontWeight: "800", color: "#1B1C1A" }}>{debt.name}</Text><Text style={{ color: "#6B7A6F", fontSize: 12 }}>{getDebtPreset(debt.presetKey).label} · {debt.status}</Text></View><Text style={{ fontWeight: "800", color: "#013220" }}>{money(debt.currentBalanceMinor)}</Text></View>
    <Text style={{ color: "#6B7A6F", fontSize: 12, marginTop: 6 }}>Required {money(allocation?.requiredPaymentMinor ?? 0)} · Allocated {money(allocation?.allocatedPaymentMinor ?? 0)}</Text>
    {!archived ? <Text style={{ color: allocation?.status === "Behind" ? "#D9001F" : "#0E6D46", fontWeight: "700", marginTop: 4 }}>{allocation?.status ?? "On Schedule"}{allocation?.extraPaymentMinor ? ` · Extra ${money(allocation.extraPaymentMinor)}` : ""}</Text> : null}
    {confirming ? <View style={{ marginTop: 10, gap: 8 }}><Text style={{ color: "#D9001F", fontSize: 12 }}>Delete this debt? Payment history remains locally readable.</Text><View style={{ flexDirection: "row", gap: 12 }}><Pressable disabled={pending} onPress={onCancelDelete}><Text>Cancel</Text></Pressable><Pressable disabled={pending} onPress={onConfirmDelete}><Text style={{ color: "#D9001F", fontWeight: "700" }}>{pending ? "Deleting..." : "Confirm delete"}</Text></Pressable></View></View> : <View style={{ flexDirection: "row", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
      {!archived ? <Pressable disabled={pending} accessibilityLabel={`Record payment for ${debt.name}`} onPress={onRecordPayment}><Text style={{ color: "#0E6D46", fontWeight: "700" }}>Record payment</Text></Pressable> : null}
      <Pressable disabled={pending} onPress={onEdit}><Text>Edit</Text></Pressable>
      <Pressable disabled={pending} onPress={onRequestDelete}><Text style={{ color: "#D9001F" }}>Delete</Text></Pressable>
      {archived ? <Pressable disabled={pending} onPress={() => onChangeStatus("active")}><Text>Restore</Text></Pressable> : <Pressable disabled={pending} onPress={() => onChangeStatus("archived")}><Text>Archive</Text></Pressable>}
      {!archived ? <><Pressable disabled={pending} onPress={() => onMovePriority(-1)}><Text>Prioritize</Text></Pressable><Pressable disabled={pending} onPress={() => onMovePriority(1)}><Text>Move down</Text></Pressable><Pressable disabled={pending} onPress={onRemovePriority}><Text>Remove priority</Text></Pressable></> : null}
    </View>}
  </View>;
}
