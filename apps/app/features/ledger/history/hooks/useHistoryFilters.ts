import { useEffect, useMemo, useState } from "react";
import { listCategories, type Category } from "../../../../local-db/repositories/ledger/taxonomy";
import { useToast } from "../../../../components/Toast";
import { DEFAULT_SORT_BY, DEFAULT_SORT_DIR } from "../constants";
import { formatIsoDate } from "../helpers/historyFormat";
import { countActiveFilters, customRangeError, type HistoryFilterState } from "../helpers/transactionFilters";

// Filter, search and sort state for the history list, plus the filter sheet's own open and date-picker state.
export function useHistoryFilters(userId: string) {
  const { showToast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<string>(DEFAULT_SORT_DIR);
  const [dateRange, setDateRange] = useState<string>("all");
  const [customFromDate, setCustomFromDate] = useState<string | null>(null);
  const [customToDate, setCustomToDate] = useState<string | null>(null);
  const [datePickerField, setDatePickerField] = useState<"from" | "to" | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let active = true;
    listCategories(userId)
      .then((rows) => { if (active) setCategories(rows); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [userId]);

  const activeFilterCount = useMemo(
    () => countActiveFilters({ typeFilter, categoryFilter, dateRange, customFromDate, customToDate, sortBy, sortDir }),
    [typeFilter, categoryFilter, dateRange, customFromDate, customToDate, sortBy, sortDir],
  );

  function selectCustomDate(field: "from" | "to", date?: Date) {
    setDatePickerField(null);
    if (!date) return;
    if (field === "from") setCustomFromDate(formatIsoDate(date));
    else setCustomToDate(formatIsoDate(date));
  }

  function selectSort(by: string, dir: string) {
    setSortBy(by);
    setSortDir(dir);
  }

  function resetFilters() {
    setTypeFilter("all");
    setCategoryFilter("all");
    setDateRange("all");
    setCustomFromDate(null);
    setCustomToDate(null);
    setSortBy("transaction_date");
    setSortDir("desc");
  }

  function applyFilters() {
    const error = customRangeError(dateRange, customFromDate, customToDate);
    if (error) {
      showToast(error, "danger");
      return;
    }
    setShowFilters(false);
  }

  const state: HistoryFilterState = { typeFilter, categoryFilter, search, sortBy, sortDir, dateRange, customFromDate, customToDate };

  return {
    state,
    categories,
    activeFilterCount,
    datePickerField,
    showFilters,
    setTypeFilter,
    setCategoryFilter,
    setSearch,
    setDateRange,
    setDatePickerField,
    setShowFilters,
    selectCustomDate,
    selectSort,
    resetFilters,
    applyFilters,
  };
}
