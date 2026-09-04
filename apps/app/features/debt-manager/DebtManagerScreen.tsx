import { ActivityIndicator, Text, View } from "react-native";
import { DebtCard } from "./components/DebtCard";
import { DebtHeader } from "./components/DebtHeader";
import { DebtPlanSummary } from "./components/DebtPlanSummary";
import { DebtPriorityEditor } from "./components/DebtPriorityEditor";
import { DebtStrategySelector } from "./components/DebtStrategySelector";
import { CreditCardBillingCycles } from "./components/CreditCardBillingCycles";
import { useDebtManager } from "./hooks/useDebtManager";

type Props = { userId: string; deviceId: string; onSyncRequested?: () => Promise<void>; onCreateRequested?: () => void };

export default function DebtManagerScreen({ userId, deviceId, onSyncRequested, onCreateRequested }: Props) {
  const manager = useDebtManager({ userId, deviceId, onSyncRequested });
  const activeDebts = manager.debts.filter((debt) => debt.status === "active");
  const archivedDebts = manager.debts.filter((debt) => debt.status === "archived");

  return <View style={{ gap: 14 }}>
    <DebtHeader onCreate={onCreateRequested ?? manager.openCreate} />
     <DebtPlanSummary hasCurrentBudget={manager.hasCurrentBudget} debtBudgetMinor={manager.debtBudgetMinor} requiredTotalMinor={manager.plan.requiredTotalMinor} surplusMinor={manager.plan.surplusMinor} shortfallMinor={manager.plan.shortfallMinor} forecastMonths={manager.forecastMonths} forecastDate={manager.forecastDate} creditCardTargetMinor={manager.creditCardTargetMinor} missingCardStrategyCount={manager.missingCardStrategyCount} strategyRequired={manager.strategyRequired} overview={manager.overview} />
    <DebtStrategySelector strategy={manager.strategy} onChange={(value) => void manager.changeStrategy(value)} />
    <CreditCardBillingCycles userId={userId} deviceId={deviceId} onSyncRequested={onSyncRequested} />
    <DebtPriorityEditor priorities={manager.priorities} debts={activeDebts} pendingIds={manager.pendingIds} onMove={manager.movePriority} onRemove={manager.removePriority} />
    {manager.error ? <Text style={{ color: "#D9001F" }}>{manager.error}</Text> : null}
      {manager.loading ? <ActivityIndicator color="#0E6D46" /> : manager.debts.length === 0 ? <Text style={{ color: "#6B7A6F" }}>No debts yet.</Text> : <>
        {activeDebts.length > 0 ? <Text style={{ fontWeight: "800" }}>Active debts</Text> : <Text style={{ color: "#6B7A6F" }}>No active debts. Archived debts remain available below.</Text>}
        {activeDebts.map((debt) => <DebtCard key={debt.id} debt={debt} allocation={manager.plan.allocations.find((item) => item.id === debt.id)} confirming={manager.confirmDeleteId === debt.id} pending={manager.pendingIds.has(debt.id)} onEdit={() => manager.edit(debt)} onRequestDelete={() => manager.setConfirmDeleteId(debt.id)} onCancelDelete={() => manager.setConfirmDeleteId(null)} onConfirmDelete={() => void manager.confirmDelete()} onMovePriority={(direction) => void manager.movePriority(debt.id, direction)} onRemovePriority={() => void manager.removePriority(debt.id)} onChangeStatus={(status) => void manager.changeStatus(debt.id, status)} />)}
        {archivedDebts.length > 0 ? <><Text style={{ fontWeight: "800", marginTop: 8 }}>Archived debts</Text>{archivedDebts.map((debt) => <DebtCard key={debt.id} debt={debt} confirming={manager.confirmDeleteId === debt.id} pending={manager.pendingIds.has(debt.id)} onEdit={() => manager.edit(debt)} onRequestDelete={() => manager.setConfirmDeleteId(debt.id)} onCancelDelete={() => manager.setConfirmDeleteId(null)} onConfirmDelete={() => void manager.confirmDelete()} onMovePriority={(direction) => void manager.movePriority(debt.id, direction)} onRemovePriority={() => void manager.removePriority(debt.id)} onChangeStatus={(status) => void manager.changeStatus(debt.id, status)} />)}</> : null}
      </>}
  </View>;
}
