import { Alert, Pressable, Text, View } from "react-native";
import type { Debt } from "../../../local-db/repositories/debts";
import { getDebtPreset } from "../presets";
import { money } from "../formatters";

type Allocation = { requiredPaymentMinor: number; allocatedPaymentMinor: number; status: "Ahead" | "On Schedule" | "Behind"; extraPaymentMinor: number };
type Props = { debt: Debt; allocation?: Allocation; confirming: boolean; pending: boolean; onEdit: () => void; onRequestDelete: () => void; onCancelDelete: () => void; onConfirmDelete: () => void; onMovePriority: (direction: -1 | 1) => void; onRemovePriority: () => void; onChangeStatus: (status: "active" | "archived" | "paid_off") => void };

export function DebtCard({ debt, allocation, confirming, pending, onEdit, onRequestDelete, onCancelDelete, onConfirmDelete, onMovePriority, onRemovePriority, onChangeStatus }: Props) {
  const archived = debt.status === "archived";
  const creditCard = debt.presetKey === "credit_card";
  const status = allocation?.status ?? "On Schedule";
  const behind = status === "Behind";
  const cardColor = creditCard ? "#013220" : "#F1F0EB";
  const primaryTextColor = creditCard ? "#FFFFFF" : "#1B1C1A";
  const secondaryTextColor = creditCard ? "#B8D0C1" : "#6B7A6F";
  return <View style={{ backgroundColor: cardColor, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: creditCard ? "#0E6D46" : "#E0DED7" }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><View style={{ flex: 1, gap: 2 }}><Text style={{ fontWeight: "800", color: primaryTextColor, fontSize: 16 }}>{debt.name}</Text><Text style={{ color: secondaryTextColor, fontSize: 12 }}>{getDebtPreset(debt.presetKey).label} · {debt.status}</Text></View><Text style={{ fontWeight: "800", color: creditCard ? "#D7F5E1" : "#013220", fontSize: 18 }}>{money(debt.currentBalanceMinor)}</Text></View>
    <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: creditCard ? "#235B41" : "#DEDCD5", gap: 8 }}><Text style={{ color: secondaryTextColor, fontSize: 12 }}>Required {money(allocation?.requiredPaymentMinor ?? 0)} · Allocated {money(allocation?.allocatedPaymentMinor ?? 0)}</Text>
      {!archived ? <View style={{ alignSelf: "flex-start", backgroundColor: behind ? "#FDE8EB" : creditCard ? "#1D6B48" : "#DDF3E5", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}><Text style={{ color: behind ? "#B42318" : creditCard ? "#E6F9ED" : "#0E6D46", fontSize: 12, fontWeight: "800" }}>{status}{allocation?.extraPaymentMinor ? ` · Extra ${money(allocation.extraPaymentMinor)}` : ""}</Text></View> : null}</View>
    {confirming ? <View style={{ marginTop: 10, gap: 8 }}><Text style={{ color: "#D9001F", fontSize: 12 }}>Delete this debt? Payment history remains locally readable.</Text><View style={{ flexDirection: "row", gap: 12 }}><Pressable disabled={pending} onPress={onCancelDelete}><Text style={{ color: primaryTextColor }}>Cancel</Text></Pressable><Pressable disabled={pending} onPress={onConfirmDelete}><Text style={{ color: "#D9001F", fontWeight: "700" }}>{pending ? "Deleting..." : "Confirm delete"}</Text></Pressable></View></View> : <View style={{ flexDirection: "row", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
      <Pressable disabled={pending} onPress={onEdit}><Text style={{ color: primaryTextColor }}>Edit</Text></Pressable>
      <Pressable disabled={pending} onPress={onRequestDelete}><Text style={{ color: "#D9001F" }}>Delete</Text></Pressable>
       {archived ? <Pressable disabled={pending} onPress={() => onChangeStatus("active")}><Text style={{ color: primaryTextColor }}>Restore</Text></Pressable> : <Pressable disabled={pending} onPress={() => Alert.alert(`Archive ${debt.name}?`, "The debt will be hidden from active planning. You can restore it later.", [{ text: "Cancel", style: "cancel" }, { text: "Archive", style: "destructive", onPress: () => onChangeStatus("archived") }])}><Text style={{ color: primaryTextColor }}>Archive</Text></Pressable>}
      {!archived ? <><Pressable disabled={pending} onPress={() => onMovePriority(-1)}><Text style={{ color: primaryTextColor }}>Prioritize</Text></Pressable><Pressable disabled={pending} onPress={() => onMovePriority(1)}><Text style={{ color: primaryTextColor }}>Move down</Text></Pressable><Pressable disabled={pending} onPress={onRemovePriority}><Text style={{ color: primaryTextColor }}>Remove priority</Text></Pressable></> : null}
    </View>}
  </View>;
}
