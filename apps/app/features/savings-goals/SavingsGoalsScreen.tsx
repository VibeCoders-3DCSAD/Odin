import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { deleteSavingsGoal, getSavingsGoal, listSavingsGoals, type SavingsGoal } from "../../local-db/repositories/savingsGoals";
import { SAVINGS_GOAL_PRIORITY_LABELS, SAVINGS_GOAL_TYPE_LABELS } from "./constants";
import SavingsGoalForm from "./SavingsGoalForm";

const P = { card: "#F1F0EB", ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", error: "#D9001F", white: "#FFFFFF" } as const;
type Props = { userId: string; deviceId: string; syncVersion?: number; onRecordActivity?: (goalId: string, kind: "contribution" | "withdrawal") => void };
type Page = "list" | "create" | "detail" | "edit";
const money = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount / 100);

export default function SavingsGoalsScreen({ userId, deviceId, syncVersion = 0, onRecordActivity }: Props) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [selected, setSelected] = useState<SavingsGoal | null>(null);
  const [page, setPage] = useState<Page>("list");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function load() { setLoading(true); try { setGoals(await listSavingsGoals(userId)); setMessage(null); } catch { setMessage("Your savings goals could not be loaded. Check your connection and try again."); } finally { setLoading(false); } }
  useEffect(() => { load().catch(() => {}); }, [userId, syncVersion]);
  async function openGoal(id: string) { const goal = await getSavingsGoal(userId, id); if (goal) { setSelected(goal); setConfirmingDelete(false); setPage("detail"); } }
  async function remove() { if (!selected) return; setDeleting(true); try { await deleteSavingsGoal(userId, deviceId, selected.id); await load(); setSelected(null); setPage("list"); } catch { setMessage("Your savings goal could not be deleted. Please try again."); } finally { setDeleting(false); } }
  if (page === "create" || page === "edit") return <SavingsGoalForm userId={userId} deviceId={deviceId} goal={page === "edit" ? selected ?? undefined : undefined} onCancel={() => setPage(selected ? "detail" : "list")} onSaved={(goal) => { setSelected(goal); load().catch(() => {}); setPage("detail"); }} />;
  if (loading) return <View style={{ minHeight: 180, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={P.brand} /></View>;
  if (page === "detail" && selected) return <View style={{ gap: 14 }}>
    <View style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 14, borderWidth: 1, gap: 7, padding: 15 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>{selected.name}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{SAVINGS_GOAL_TYPE_LABELS[selected.goalType]} · {SAVINGS_GOAL_PRIORITY_LABELS[selected.priority]} priority</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "700" }}>Current amount: {money(selected.currentAmountCentavos)}</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "700" }}>Target: {money(selected.targetAmountCentavos)}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Remaining: {money(selected.remainingAmountCentavos)} · {selected.progressPercent}% complete</Text>{selected.isAchieved ? <Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Achieved</Text> : null}{selected.targetDate ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Target date: {selected.targetDate}</Text> : null}</View>
    {selected.currentAmountCentavos < selected.targetAmountCentavos ? <Button label="Add contribution" onPress={() => onRecordActivity?.(selected.id, "contribution")} /> : null}
    <Button label="Withdraw" secondary onPress={() => onRecordActivity?.(selected.id, "withdrawal")} />
    <Button label="Edit goal" onPress={() => setPage("edit")} />
    {confirmingDelete ? <View style={{ backgroundColor: "#FFF0F2", borderRadius: 12, gap: 10, padding: 13 }}><Text style={{ color: P.error, fontFamily: "Manrope", fontWeight: "800" }}>Delete this savings goal?</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12 }}>This removes the goal and its history from your active list. This action cannot be undone.</Text><Button label={deleting ? "Deleting..." : "Confirm delete"} danger disabled={deleting} onPress={() => { remove().catch(() => {}); }} /><Button label="Cancel" secondary onPress={() => setConfirmingDelete(false)} /></View> : <Button label="Delete goal" danger onPress={() => setConfirmingDelete(true)} />}
  </View>;
  return <View style={{ gap: 14 }}><View><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>Savings goals</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Set targets for the money you want to save.</Text></View>{message ? <Text style={{ color: P.error }}>{message}</Text> : null}{goals.map((goal) => <Pressable key={goal.id} accessibilityRole="button" accessibilityLabel={`Open ${goal.name}`} onPress={() => { openGoal(goal.id).catch(() => {}); }} style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 13, borderWidth: 1, gap: 5, padding: 14 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 15, fontWeight: "800" }}>{goal.name}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{money(goal.currentAmountCentavos)} of {money(goal.targetAmountCentavos)}</Text></Pressable>)}<Button label="Add savings goal" onPress={() => setPage("create")} /></View>;
}

function Button({ label, onPress, secondary, danger, disabled }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ backgroundColor: secondary ? P.white : danger ? P.error : P.brand, borderColor: P.line, borderRadius: 10, borderWidth: secondary ? 1 : 0, minHeight: 46, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.6 : 1 }}><Text style={{ color: secondary ? P.ink : P.white, fontFamily: "Manrope", fontWeight: "700" }}>{label}</Text></Pressable>; }
