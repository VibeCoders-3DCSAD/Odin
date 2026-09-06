export type ForecastTransaction = {
  transaction_type: "income" | "expense" | "transfer";
  amount_centavos: number;
  transaction_date: string;
  subcategory_label: string | null;
};

export type ForecastResult = {
  projected_balance_centavos: number | null;
  income_centavos: number | null;
  expense_centavos: number | null;
  categories: { label: string; amount_centavos: number }[];
  expected_events: { label: string; date: string }[];
  insights: string[];
  text: string | null;
  period: string | null;
  freshness: string | null;
  confidence: string | null;
};

const MONTHS_IN_WINDOW = 3;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_NAMES_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

// ponytail: deterministic mock only. When FORECAST_PROVIDER points at the ML
// endpoint, this function is replaced by the provider call without changing
// the ForecastResult contract the app parses.
export function buildEmptyForecast(): ForecastResult {
  return {
    projected_balance_centavos: null,
    income_centavos: null,
    expense_centavos: null,
    categories: [],
    expected_events: [],
    insights: [],
    text: null,
    period: null,
    freshness: null,
    confidence: "Cold-start estimate",
  };
}

export function buildForecast(input: {
  openingBalanceCentavos: number;
  transactions: ForecastTransaction[];
  now?: Date;
}): ForecastResult {
  const now = input.now ?? new Date();

  const months = [-1, -2, -3].map((offset) => {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return {
      start: dateKey(first.getFullYear(), first.getMonth(), 1),
      end: dateKey(first.getFullYear(), first.getMonth(), lastDay),
    };
  });

  const inWindow = input.transactions.filter(
    (transaction) =>
      transaction.transaction_type !== "transfer" &&
      months.some((month) => transaction.transaction_date >= month.start && transaction.transaction_date <= month.end),
  );

  const coveredMonths = months.filter((month) =>
    inWindow.some((transaction) => transaction.transaction_date >= month.start && transaction.transaction_date <= month.end),
  ).length;

  if (inWindow.length === 0) {
    return {
      ...buildEmptyForecast(),
      confidence: coveredMonths > 0 ? "Fallback estimate" : "Cold-start estimate",
    };
  }

  const incomeSum = inWindow
    .filter((transaction) => transaction.transaction_type === "income")
    .reduce((sum, transaction) => sum + transaction.amount_centavos, 0);
  const expenseSum = inWindow
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount_centavos, 0);
  const incomeAvg = Math.round(incomeSum / MONTHS_IN_WINDOW);
  const expenseAvg = Math.round(expenseSum / MONTHS_IN_WINDOW);

  const categoryTotals = new Map<string, number>();
  for (const transaction of inWindow) {
    if (transaction.transaction_type !== "expense") continue;
    const label = transaction.subcategory_label?.trim() || "Other";
    categoryTotals.set(label, (categoryTotals.get(label) ?? 0) + transaction.amount_centavos);
  }
  const categories = [...categoryTotals.entries()]
    .map(([label, total]) => ({ label, amount_centavos: Math.round(total / MONTHS_IN_WINDOW) }))
    .filter((category) => category.amount_centavos > 0)
    .sort((a, b) => b.amount_centavos - a.amount_centavos)
    .slice(0, 6);

  const hasIncome = incomeSum > 0;
  const hasExpense = expenseSum > 0;
  const projectedBalance = hasIncome || hasExpense ? input.openingBalanceCentavos + incomeAvg - expenseAvg : null;

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const period = `end of ${MONTH_NAMES[nextMonth.getMonth()]} ${nextMonth.getFullYear()}`;
  const freshness = `As of ${MONTH_NAMES_SHORT[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  const confidence = coveredMonths === MONTHS_IN_WINDOW ? "Personalized estimate" : "Fallback estimate";

  const insights: string[] = [];
  if (hasIncome && hasExpense) {
    const difference = incomeAvg - expenseAvg;
    insights.push(
      difference >= 0
        ? `You are projected to save ${formatPeso(difference)} this period.`
        : `Projected expenses exceed expected income by ${formatPeso(-difference)} this period.`,
    );
  } else if (hasIncome) {
    insights.push("No expected expenses next period.");
  } else if (hasExpense) {
    insights.push("No expected income next period.");
  }
  const topCategory = categories[0];
  if (topCategory) {
    insights.push(`Largest forecasted expense is ${topCategory.label} at ${formatPeso(topCategory.amount_centavos)}.`);
  }
  if (coveredMonths > 0 && coveredMonths < MONTHS_IN_WINDOW) {
    insights.push("Based on limited transaction history — treat as a rough estimate.");
  }

  return {
    projected_balance_centavos: projectedBalance,
    income_centavos: hasIncome ? incomeAvg : null,
    expense_centavos: hasExpense ? expenseAvg : null,
    categories,
    expected_events: [],
    insights: insights.slice(0, 3),
    text: `${confidence} for ${period}. Based on your recent ${coveredMonths}-month transaction history.`,
    period,
    freshness,
    confidence,
  };
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatPeso(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}