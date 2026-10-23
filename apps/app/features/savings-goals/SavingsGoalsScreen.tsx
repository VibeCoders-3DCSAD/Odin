import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { archiveSavingsGoal, deleteSavingsGoal, getSavingsGoal, listSavingsGoals, restoreSavingsGoal, type SavingsGoal } from "../../local-db/repositories/savingsGoals";
import { SAVINGS_GOAL_PRIORITY_LABELS, SAVINGS_GOAL_TYPE_LABELS } from "./constants";
import SavingsGoalForm from "./SavingsGoalForm";
import { getMinimumContributionPerOccurrence, type ScheduledSavingsGoal } from "./contributionSchedule";
import { listSavingsGoalActivities } from "../../local-db/repositories/savingsGoalActivities";
import type { SavingsActivity } from "./types";
import { SavingsForecastSection } from "../savings-forecast/SavingsForecastSection";
import SavingsAllocationReview from "./SavingsAllocationReview";
import type { SavingsAllocationProposal } from "./savingsEnvelopeAllocation";

const P = { card: "#F1F0EB", ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", error: "#D9001F", white: "#FFFFFF" } as const;
type Props = { userId: string; deviceId: string; syncVersion?: number; initialGoalId?: string; onRecordActivity?: (goalId: string, kind: "contribution" | "withdrawal", amountCentavos?: number) => void; onOpenTransaction?: (transactionId: string) => void };
type Page = "list" | "create" | "detail" | "edit";
const money = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount / 100);

export default function SavingsGoalsScreen({ userId, deviceId, syncVersion = 0, initialGoalId, onRecordActivity, onOpenTransaction }: Props) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [selected, setSelected] = useState<SavingsGoal | null>(null);
  const [activities, setActivities] = useState<SavingsActivity[]>([]);
  const [page, setPage] = useState<Page>("list");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  async function load() { setLoading(true); try { setGoals(await listSavingsGoals(userId, view)); setMessage(null); } catch { setMessage("Your savings goals could not be loaded. Please try again."); } finally { setLoading(false); } }
  useEffect(() => { load().catch(() => {}); }, [userId, syncVersion, view]);
  async function openGoal(id: string) { const [goal, nextActivities] = await Promise.all([getSavingsGoal(userId, id), listSavingsGoalActivities(userId, id)]); if (goal) { setSelected(goal); setActivities(nextActivities); setConfirmingDelete(false); setConfirmingArchive(false); setPage("detail"); } }
  useEffect(() => {
    if (initialGoalId) void openGoal(initialGoalId).catch(() => setMessage("Your savings goal could not be loaded. Please try again."));
  }, [initialGoalId, userId]);
  async function remove() { if (!selected) return; setDeleting(true); try { await deleteSavingsGoal(userId, deviceId, selected.id); await load(); setSelected(null); setPage("list"); } catch { setMessage("Your savings goal could not be deleted. Please try again."); } finally { setDeleting(false); } }
  async function archive() { if (!selected) return; setDeleting(true); try { await archiveSavingsGoal(userId, deviceId, selected.id); await load(); setSelected(null); setPage("list"); } catch { setMessage("Your savings goal could not be archived. Please try again."); } finally { setDeleting(false); } }
  async function restore() { if (!selected) return; setDeleting(true); try { await restoreSavingsGoal(userId, deviceId, selected.id); setView("active"); setSelected(null); setPage("list"); } catch { setMessage("Your savings goal could not be restored. Please try again."); } finally { setDeleting(false); } }
  if (page === "create" || page === "edit") return <SavingsGoalForm userId={userId} deviceId={deviceId} goal={page === "edit" ? selected ?? undefined : undefined} onCancel={() => setPage(page === "edit" && selected ? "detail" : "list")} onSaved={(goal) => { setSelected(goal); load().catch(() => {}); setPage("detail"); }} />;
  if (loading) return <View style={{ minHeight: 180, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={P.brand} /></View>;
  if (page === "detail" && selected) {
    const today = new Date().toISOString().slice(0, 10);
    const minimum = getMinimumContributionPerOccurrence(selected as ScheduledSavingsGoal, today);
    const contributions = activities.filter((activity) => activity.kind === "contribution");
    const withdrawals = activities.filter((activity) => activity.kind === "withdrawal");
    const status = selected.status === "archived" ? "Archived" : selected.isAchieved ? "Achieved" : "Active";
    return <View style={{ gap: 14 }}>
    <View style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 14, borderWidth: 1, gap: 7, padding: 15 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>{selected.name}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{SAVINGS_GOAL_TYPE_LABELS[selected.goalType]} · {SAVINGS_GOAL_PRIORITY_LABELS[selected.priority]} priority</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "700" }}>Current balance: {money(selected.currentAmountCentavos)}</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "700" }}>Target: {money(selected.targetAmountCentavos)}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Remaining: {money(selected.remainingAmountCentavos)} · {selected.progressPercent}% complete</Text><Text style={{ color: selected.status === "archived" ? P.muted : P.brand, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Status: {status}</Text>{selected.notes ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Notes: {selected.notes}</Text> : null}{selected.targetDate ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Target date: {selected.targetDate}</Text> : null}{selected.nextContributionDate ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Next contribution: {selected.nextContributionDate} · Planned {money(selected.plannedContributionAmountCentavos)}</Text> : <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Contribution frequency: None · Contribute manually whenever you choose.</Text>}{minimum !== null ? <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Minimum per contribution: {money(minimum)}</Text> : null}</View>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Financial account: {selected.linkedAccountName ?? (selected.linkedAccountId ? "Unavailable" : "Not linked")}</Text>
     {selected.status === "active" && selected.currentAmountCentavos < selected.targetAmountCentavos ? <Button label="Add contribution" onPress={() => onRecordActivity?.(selected.id, "contribution")} /> : null}
     {selected.status === "active" ? <Button label="Withdraw" secondary onPress={() => onRecordActivity?.(selected.id, "withdrawal")} /> : null}
     <SavingsForecastSection currentBalanceCentavos={selected.currentAmountCentavos} startingBalanceCentavos={selected.startingAmountCentavos} targetAmountCentavos={selected.targetAmountCentavos} targetDate={selected.targetDate} schedule={selected} interestRateBps={selected.interestRateBps} activities={activities} />
    <SavingsActivityList title="Recent activity" activities={activities.slice(0, 5)} emptyMessage="This savings goal has no recorded activity yet." onOpenTransaction={onOpenTransaction} />
    <SavingsActivityList title="Contributions" activities={contributions} emptyMessage="This savings goal has no recorded contributions. Add a contribution to update its progress." onOpenTransaction={onOpenTransaction} />
    <SavingsActivityList title="Withdrawals" activities={withdrawals} emptyMessage="This savings goal has no recorded withdrawals." onOpenTransaction={onOpenTransaction} />
    {selected.status === "active" ? <><Button label="Edit goal" onPress={() => setPage("edit")} />
    {confirmingArchive ? <View style={{ backgroundColor: "#F8EFDC", borderRadius: 12, gap: 10, padding: 13 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontWeight: "800" }}>Archive this savings goal?</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12 }}>Archived goals are kept with their history and can be restored later.</Text><Button label={deleting ? "Archiving..." : "Confirm archive"} disabled={deleting} onPress={() => { archive().catch(() => {}); }} /><Button label="Cancel" secondary onPress={() => setConfirmingArchive(false)} /></View> : <Button label="Archive goal" secondary onPress={() => setConfirmingArchive(true)} />}</> : <Button label={deleting ? "Restoring..." : "Restore goal"} disabled={deleting} onPress={() => { restore().catch(() => {}); }} />}
    {confirmingDelete ? <View style={{ backgroundColor: "#FFF0F2", borderRadius: 12, gap: 10, padding: 13 }}><Text style={{ color: P.error, fontFamily: "Manrope", fontWeight: "800" }}>Delete this savings goal?</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12 }}>This removes the goal and its history from your active list. This action cannot be undone.</Text><Button label={deleting ? "Deleting..." : "Confirm delete"} danger disabled={deleting} onPress={() => { remove().catch(() => {}); }} /><Button label="Cancel" secondary onPress={() => setConfirmingDelete(false)} /></View> : <Button label="Delete goal" danger onPress={() => setConfirmingDelete(true)} />}
   </View>;
  }
  const totalSavingsCentavos = goals.reduce((total, goal) => total + goal.currentAmountCentavos, 0);
  return <SavingsGoalsOverview userId={userId} deviceId={deviceId} syncVersion={syncVersion} goals={goals} totalSavingsCentavos={totalSavingsCentavos} view={view} onViewChange={setView} message={message} onCreate={() => setPage("create")} onOpenGoal={(id) => { openGoal(id).catch(() => {}); }} onApprove={(goalId, amountCentavos) => onRecordActivity?.(goalId, "contribution", amountCentavos)} />;
}

function Button({ label, onPress, secondary, danger, disabled }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ backgroundColor: secondary ? P.white : danger ? P.error : P.brand, borderColor: P.line, borderRadius: 10, borderWidth: secondary ? 1 : 0, minHeight: 46, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.6 : 1 }}><Text style={{ color: secondary ? P.ink : P.white, fontFamily: "Manrope", fontWeight: "700", textAlign: "center" }}>{label}</Text></Pressable>; }

function SavingsGoalsOverview({ userId, deviceId, syncVersion, goals, totalSavingsCentavos, view, onViewChange, message, onCreate, onOpenGoal, onApprove }: { userId: string; deviceId: string; syncVersion: number; goals: SavingsGoal[]; totalSavingsCentavos: number; view: "active" | "archived"; onViewChange: (view: "active" | "archived") => void; message: string | null; onCreate: () => void; onOpenGoal: (id: string) => void; onApprove: (goalId: string, amountCentavos: number) => void }) {
  const [proposals, setProposals] = useState<SavingsAllocationProposal[]>([]);
  const proposalsByGoalId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  return <View style={{ gap: 14 }}>
    <View><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>Savings Goals</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Total saved: {money(totalSavingsCentavos)}</Text></View>
    {message ? <Text accessibilityRole="alert" style={{ color: P.error }}>{message}</Text> : null}
    <View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1 }}><Button label="Active goals" secondary={view !== "active"} onPress={() => onViewChange("active")} /></View><View style={{ flex: 1 }}><Button label="Archived goals" secondary={view !== "archived"} onPress={() => onViewChange("archived")} /></View></View>
    {view === "active" ? <SavingsAllocationReview userId={userId} deviceId={deviceId} syncVersion={syncVersion} onAllocationChange={setProposals} /> : null}
    <View style={{ gap: 8 }}>
      {goals.length === 0 ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>No {view === "active" ? "active" : "archived"} savings goals yet.</Text> : goals.map((goal) => {
        const proposal = view === "active" ? proposalsByGoalId.get(goal.id) : undefined;
        return <View key={goal.id} style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 13, borderWidth: 1, gap: 7, padding: 14 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${goal.name}`} onPress={() => onOpenGoal(goal.id)}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 15, fontWeight: "800" }}>{goal.name}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{money(goal.currentAmountCentavos)} of {money(goal.targetAmountCentavos)} · {goal.progressPercent}%</Text></Pressable>
          {proposal ? <View style={{ borderTopColor: P.line, borderTopWidth: 1, gap: 6, paddingTop: 9 }}><Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Financial Plan contribution: {money(proposal.proposedTotalCentavos)}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11 }}>{proposal.state.replace("_", " ")}</Text>{proposal.proposedTotalCentavos > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`Contribute to ${goal.name}`} onPress={() => onApprove(goal.id, proposal.proposedTotalCentavos)} style={{ alignItems: "center", backgroundColor: P.brand, borderRadius: 9, padding: 10 }}><Text style={{ color: P.white, fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>Contribute</Text></Pressable> : null}</View> : null}
        </View>;
      })}
    </View>
    {view === "active" ? <Button label="Add savings goal" onPress={onCreate} /> : null}
  </View>;
}

function SavingsActivityList({ title, activities, emptyMessage, onOpenTransaction }: { title: string; activities: SavingsActivity[]; emptyMessage: string; onOpenTransaction?: (transactionId: string) => void }) {
  return <View style={{ gap: 8 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>{title}</Text>{activities.length === 0 ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>{emptyMessage}</Text> : activities.map((activity) => <Pressable key={activity.id} accessibilityRole="button" accessibilityLabel={`Open ${activity.kind} transaction`} onPress={() => onOpenTransaction?.(activity.transactionId)} disabled={!onOpenTransaction} style={{ backgroundColor: P.card, borderColor: P.line, borderRadius: 12, borderWidth: 1, gap: 3, opacity: onOpenTransaction ? 1 : 0.7, padding: 12 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "700" }}>{activity.kind === "contribution" ? "Contribution" : "Withdrawal"} · {money(activity.amountCentavos)}</Text><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11 }}>{activity.activityDate}{activity.notes ? ` · ${activity.notes}` : ""}</Text></Pressable>)}</View>;
}
