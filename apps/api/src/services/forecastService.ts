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
  horizons: ForecastHorizonResult[];
};

export type ForecastHorizon = "next_day" | "weekly" | "monthly" | "yearly";

export type ForecastPoint = {
  label: string;
  projected_balance_centavos: number;
  income_centavos: number;
  expense_centavos: number;
};

export type ForecastHorizonResult = {
  key: ForecastHorizon;
  label: string;
  period: string;
  points: ForecastPoint[];
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
    horizons: [],
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

  const horizons = buildHorizons({
    now,
    openingBalanceCentavos: input.openingBalanceCentavos,
    monthlyIncomeCentavos: incomeAvg,
    monthlyExpenseCentavos: expenseAvg,
    transactions: input.transactions,
  });

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
    horizons,
  };
}

function buildHorizons(input: {
  now: Date;
  openingBalanceCentavos: number;
  monthlyIncomeCentavos: number;
  monthlyExpenseCentavos: number;
  transactions: ForecastTransaction[];
}): ForecastHorizonResult[] {
  const currentMonthStart = dateKey(input.now.getFullYear(), input.now.getMonth(), 1);
  const longTermStart = dateKey(input.now.getFullYear(), input.now.getMonth() - 12, 1);
  const longTermTransactions = input.transactions.filter((transaction) =>
    transaction.transaction_type !== "transfer" &&
    transaction.transaction_date >= longTermStart &&
    transaction.transaction_date < currentMonthStart,
  );
  const coveredMonths = new Set(longTermTransactions.map((transaction) => transaction.transaction_date.slice(0, 7))).size;
  const longTermIncome = longTermTransactions
    .filter((transaction) => transaction.transaction_type === "income")
    .reduce((sum, transaction) => sum + transaction.amount_centavos, 0);
  const longTermExpense = longTermTransactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount_centavos, 0);
  const yearlyMonthlyIncome = coveredMonths > 0 ? Math.round(longTermIncome / coveredMonths) : input.monthlyIncomeCentavos;
  const yearlyMonthlyExpense = coveredMonths > 0 ? Math.round(longTermExpense / coveredMonths) : input.monthlyExpenseCentavos;

  const definitions: { key: ForecastHorizon; label: string; period: string; count: number; income: number; expense: number; labels: string[] }[] = [
    {
      key: "next_day",
      label: "Next day",
      period: "tomorrow",
      count: 2,
      income: Math.round(input.monthlyIncomeCentavos / 30),
      expense: Math.round(input.monthlyExpenseCentavos / 30),
      labels: ["Today", "Tomorrow"],
    },
    {
      key: "weekly",
      label: "Weekly",
      period: "next 7 days",
      count: 7,
      income: Math.round(input.monthlyIncomeCentavos / 4.345),
      expense: Math.round(input.monthlyExpenseCentavos / 4.345),
      labels: Array.from({ length: 7 }, (_, index) => {
        const date = new Date(input.now);
        date.setDate(date.getDate() + index + 1);
        return date.toLocaleDateString("en-US", { weekday: "short" });
      }),
    },
    {
      key: "monthly",
      label: "Monthly",
      period: "next month",
      count: 5,
      income: input.monthlyIncomeCentavos,
      expense: input.monthlyExpenseCentavos,
      labels: ["Now", "Week 1", "Week 2", "Week 3", "Week 4"],
    },
    {
      key: "yearly",
      label: "Yearly",
      period: "next 12 months",
      count: 12,
      income: yearlyMonthlyIncome,
      expense: yearlyMonthlyExpense,
      labels: Array.from({ length: 12 }, (_, index) => MONTH_NAMES_SHORT[(input.now.getMonth() + index + 1) % 12]!),
    },
  ];

  return definitions.map((definition) => {
    const points: ForecastPoint[] = [];
    let balance = input.openingBalanceCentavos;
    for (let index = 0; index < definition.count; index += 1) {
      if (definition.key !== "next_day" || index > 0) balance += definition.income - definition.expense;
      points.push({
        label: definition.labels[index]!,
        projected_balance_centavos: balance,
        income_centavos: index === 0 && definition.key === "next_day" ? 0 : definition.income,
        expense_centavos: index === 0 && definition.key === "next_day" ? 0 : definition.expense,
      });
    }
    return { key: definition.key, label: definition.label, period: definition.period, points };
  });
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatPeso(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}
