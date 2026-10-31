import { dashboardColors as P } from "../../dashboard/dashboardAppearance";

export const AMOUNT_COLORS: Record<string, string> = {
  income: P.green,
  expense: P.error,
};
// Selected WHEN chip fill.
export const CHIP_ON = "#41EDA4";

export const SORT_OPTIONS = [
  { by: "transaction_date", dir: "desc", label: "Newest first", hint: "The default" },
  { by: "transaction_date", dir: "asc", label: "Oldest first" },
  { by: "amount_centavos", dir: "desc", label: "Largest amount" },
  { by: "amount_centavos", dir: "asc", label: "Smallest amount" },
] as const;

export const FILTER_TYPES = [
  { key: "all", label: "Everything" },
  { key: "income", label: "Income" },
  { key: "expense", label: "Expenses" },
  { key: "transfer", label: "Transfers" },
] as const;

export const sectionLabel = {
  fontFamily: "Manrope", fontWeight: "700", fontSize: 11, letterSpacing: 0.6, color: P.secondary,
} as const;

export const DATE_RANGES = ["all", "week", "month", "year", "custom"] as const;

export const PAGE_SIZE = 25;
// Enough rows to fill the screen; the rest render a frame later so a new list paints quickly.
export const INITIAL_RENDER_ROWS = 10;
// listTransactions caps a page at 200 rows.
export const MAX_REFRESH_ROWS = 200;
export const DEFAULT_SORT_BY = "transaction_date";
export const DEFAULT_SORT_DIR = "desc";
