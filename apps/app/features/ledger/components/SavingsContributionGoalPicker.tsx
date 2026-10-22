import { useEffect, useState } from "react";
import AccountSelectionSheet from "../../../components/AccountSelectionSheet";
import { Banner, Note, PickerField } from "../../../components/BudgieForm";
import { listSavingsContributionGoals, type SavingsContributionGoalOption } from "../../../local-db/repositories/savingsGoalContributions";

type Props = {
  userId: string;
  goalId: string | null;
  onChange: (goalId: string) => void;
};

export default function SavingsContributionGoalPicker({ userId, goalId, onChange }: Props) {
  const [goals, setGoals] = useState<SavingsContributionGoalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    listSavingsContributionGoals(userId).then((items) => {
      if (active) setGoals(items);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  if (loading) return <Note>Loading savings goals…</Note>;
  if (error) return <Banner tone="error">Savings goals could not be loaded. Try opening the transaction again.</Banner>;
  if (!goals.length) return <Note>Add an active savings goal and link it to an account before recording a contribution.</Note>;

  return <>
    <PickerField label="Savings goal" value={goals.find((goal) => goal.id === goalId)?.name ?? "Select savings goal"} placeholder={!goalId} accessibilityLabel="Choose savings goal" onPress={() => setPicking(true)} />
    <AccountSelectionSheet visible={picking} title="Savings goal" accounts={goals.map((goal) => ({ id: goal.id, name: goal.name, amountLabel: goal.linkedAccountName ?? "Linked account" }))} selectedId={goalId ?? ""} onSelect={onChange} onClose={() => setPicking(false)} />
  </>;
}
