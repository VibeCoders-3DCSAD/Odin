import type { TransactionFilters, TransactionListItem } from "../../../../local-db/repositories/ledger/ledger";
import { PAGE_SIZE } from "../constants";

export type HistoryFilterState = {
  typeFilter: string;
  categoryFilter: string;
  // The typed search text; it is only queried when a load runs.
  search: string;
  sortBy: string;
  sortDir: string;
  dateRange: string;
  customFromDate: string | null;
  customToDate: string | null;
};

export function buildTransactionFilters(state: HistoryFilterState, after: TransactionListItem | null): TransactionFilters {
  const filters: TransactionFilters = {
    sort_by: state.sortBy,
    sort_dir: state.sortDir,
    limit: PAGE_SIZE,
  };
  if (after) filters.after = after;
  if (state.typeFilter !== "all") filters.transaction_type = state.typeFilter;
  if (state.categoryFilter !== "all") filters.category_id = state.categoryFilter;
  if (state.search.trim()) filters.search = state.search.trim();
  if (state.dateRange === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    filters.from_date = d.toISOString().split("T")[0]!;
  } else if (state.dateRange === "month") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    filters.from_date = d.toISOString().split("T")[0]!;
  } else if (state.dateRange === "year") {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    filters.from_date = d.toISOString().split("T")[0]!;
  } else if (state.dateRange === "custom" && state.customFromDate && state.customToDate) {
    filters.from_date = state.customFromDate;
    filters.to_date = state.customToDate;
  }
  return filters;
}

export function countActiveFilters(state: Omit<HistoryFilterState, "search">): number {
  let count = 0;
  if (state.typeFilter !== "all") count++;
  if (state.categoryFilter !== "all") count++;
  if (state.dateRange !== "all" && (state.dateRange !== "custom" || (state.customFromDate && state.customToDate))) count++;
  if (state.sortBy !== "transaction_date" || state.sortDir !== "desc") count++;
  return count;
}

// The message to show when the custom range cannot be applied, or null when it can.
export function customRangeError(dateRange: string, customFromDate: string | null, customToDate: string | null): string | null {
  if (dateRange === "custom" && (!customFromDate || !customToDate)) return "Choose both a start and end date";
  if (customFromDate && customToDate && customFromDate > customToDate) return "Start date must be before end date";
  return null;
}
