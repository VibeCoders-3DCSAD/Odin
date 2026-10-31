import type { TransactionListItem } from "../../../../local-db/repositories/ledger/ledger";

// toLocaleString builds a new formatter on every call, which is slow on Hermes.
const amountFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

export function formatAmount(centavos: number): string {
  return amountFormat.format(centavos / 100);
}

export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type TransactionDateGroup = { key: string; date: string; items: TransactionListItem[] };

export function groupTransactionsByDate(transactions: TransactionListItem[]): TransactionDateGroup[] {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const todayKey = today.toDateString();
  const yesterdayKey = yesterday.toDateString();
  const groups: TransactionDateGroup[] = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    // Rows arrive grouped by date, so only the first row of each day is formatted.
    if (last && last.key === tx.transaction_date) {
      last.items.push(tx);
      continue;
    }
    const d = new Date(tx.transaction_date + "T00:00:00+08:00");
    const dateKey = d.toDateString();
    const dateLabel = dateKey === todayKey ? "Today" : dateKey === yesterdayKey ? "Yesterday" : dateFormat.format(d);
    if (last && last.date === dateLabel) {
      last.key = tx.transaction_date;
      last.items.push(tx);
    } else {
      groups.push({ key: tx.transaction_date, date: dateLabel, items: [tx] });
    }
  }
  return groups;
}
