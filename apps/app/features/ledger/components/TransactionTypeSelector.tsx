import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowsLeftRight } from "phosphor-react-native";
import { Segment } from "../../../components/BudgieForm";

export type TransactionType = "expense" | "income" | "transfer";

type Props = {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
};

const TYPES: { key: TransactionType; label: string; icon: (color: string) => ReactNode }[] = [
  { key: "expense", label: "Expense", icon: (color) => <ArrowUpRight color={color} size={14} weight="bold" /> },
  { key: "income", label: "Income", icon: (color) => <ArrowDownLeft color={color} size={14} weight="bold" /> },
  { key: "transfer", label: "Transfer", icon: (color) => <ArrowsLeftRight color={color} size={14} weight="bold" /> },
];

export default function TransactionTypeSelector({ value, onChange }: Props) {
  return <Segment options={TYPES} value={value} onChange={onChange} />;
}
