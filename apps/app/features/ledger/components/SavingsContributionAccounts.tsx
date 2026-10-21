import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import AccountSelectionSheet from "../../../components/AccountSelectionSheet";
import { Banner, FieldLabel, Note, PickerField, styles as ui, v4Font, v4 } from "../../../components/BudgieForm";
import { getSavingsGoal } from "../../../local-db/repositories/savingsGoals";
import { getSavingsExpenseFunding } from "../../../local-db/repositories/savingsExpenseFunding";
import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";

type Props = { userId: string; goalId: string; accounts: FinancialAccount[]; sourceAccountId: string; onSourceChange: (id: string) => void; transactionId?: string };
type LinkedAccount = { id: string; name: string; unallocatedCentavos: number };
function money(value: number) { return `₱${(value / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default function SavingsContributionAccounts({ userId, goalId, accounts, sourceAccountId, onSourceChange, transactionId }: Props) {
  const [linked, setLinked] = useState<LinkedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    let active = true;
    setLinked(null); setError(null);
    async function load() {
      try {
        const goal = await getSavingsGoal(userId, goalId);
        if (!goal?.linkedAccountId) throw new Error("Link this savings goal to an active account before adding a contribution.");
        const funding = transactionId ? await getSavingsExpenseFunding(userId, goal.linkedAccountId, 0, transactionId) : await getSavingsExpenseFunding(userId, goal.linkedAccountId, 0);
        if (active) setLinked({ id: goal.linkedAccountId, name: goal.linkedAccountName ?? "Linked account", unallocatedCentavos: funding.unallocatedCentavos });
      } catch {
        if (active) setError("The goal's linked account could not be loaded. Check its account link and try again.");
      }
    }
    void load();
    return () => { active = false; };
  }, [userId, goalId, transactionId]);
  useEffect(() => { if (linked && !sourceAccountId) onSourceChange(linked.id); }, [linked, sourceAccountId, onSourceChange]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!linked) return <Note>Loading linked account…</Note>;
  const unallocated = sourceAccountId === linked.id;
  const sourceName = unallocated ? `Available money · ${money(linked.unallocatedCentavos)}` : accounts.find((account) => account.id === sourceAccountId)?.name ?? "Select source";
  const options = [
    { id: linked.id, name: "Available money", amountLabel: `${linked.name} · ${money(linked.unallocatedCentavos)} available` },
    ...accounts.filter((account) => account.id !== linked.id && account.status === "active" && account.kind !== "credit_card")
      .map((account) => ({ id: account.id, name: account.name, kind: account.kind, amountLabel: money(account.currentBalanceCentavos) })),
  ];
  return <>
    <PickerField label="From account" value={sourceName} accessibilityLabel="Choose contribution source" onPress={() => setPicking(true)} />
    <View>
      <FieldLabel>To account</FieldLabel>
      <View accessibilityLabel={`To account: ${linked.name}. Linked account, cannot be changed.`} style={ui.fieldBox}>
        <Text style={{ fontFamily: v4Font, color: v4.ink }}>{linked.name}</Text>
      </View>
      <Note>Linked to this savings goal. {unallocated ? "Money in this account that hasn’t been set aside for a savings goal. The account balance stays the same." : "The contribution will be transferred into this account."}</Note>
    </View>
    <AccountSelectionSheet visible={picking} title="Contribution source" accounts={options} selectedId={sourceAccountId} onSelect={onSourceChange} onClose={() => setPicking(false)} />
  </>;
}
