import DateTimePicker from "@react-native-community/datetimepicker";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import type { Category } from "../../../../local-db/repositories/ledger/taxonomy";
import { BottomSheetSurface } from "../../../../components/BottomSheetSurface";
import { ActionSheet } from "../../../../components/ActionSheet";
import { dashboardColors as P } from "../../../dashboard/dashboardAppearance";
import { DATE_RANGES, FILTER_TYPES, SORT_OPTIONS, sectionLabel } from "../constants";
import { formatIsoDate } from "../helpers/historyFormat";
import type { HistoryFilterState } from "../helpers/transactionFilters";
import { Chip, Radio } from "./FilterOptions";

type Props = {
  visible: boolean;
  onClose: () => void;
  filters: HistoryFilterState;
  categories: Category[];
  datePickerField: "from" | "to" | null;
  onTypeChange: (type: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onDateRangeChange: (range: string) => void;
  onOpenDatePicker: (field: "from" | "to") => void;
  onSelectCustomDate: (field: "from" | "to", date?: Date) => void;
  onSortChange: (by: string, dir: string) => void;
  onReset: () => void;
  onApply: () => void;
};

function dateRangeLabel(range: (typeof DATE_RANGES)[number]): string {
  return range === "all" ? "Any time" : range === "week" ? "This week" : range === "month" ? "This month" : range === "year" ? "This year" : "Custom";
}

// Filter bottom drawer.
export function TransactionFiltersSheet({
  visible, onClose, filters, categories, datePickerField, onTypeChange, onCategoryChange, onDateRangeChange,
  onOpenDatePicker, onSelectCustomDate, onSortChange, onReset, onApply,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const { typeFilter, categoryFilter, dateRange, customFromDate, customToDate, sortBy, sortDir } = filters;
  return (
    <ActionSheet visible={visible} onClose={onClose} backdropColor="rgba(0,0,0,0.45)">
      <BottomSheetSurface
        bottomSpacing={26}
        style={{
          backgroundColor: P.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingTop: 10, paddingHorizontal: 20,
        }}
      >
        <View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: P.divider, alignSelf: "center", marginBottom: 12 }} />

        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink, marginBottom: 6 }}>
          Filters and sort
        </Text>

        {/* Capping the scroll area itself, not the sheet: a capped sheet with a shrinking child left a blank the size of its bottom padding under the buttons. */}
        <ScrollView style={{ maxHeight: Math.round(windowHeight * 0.62) }} contentContainerStyle={{ gap: 11, paddingBottom: 14 }} showsVerticalScrollIndicator={false}>
        <Text style={sectionLabel}>SHOW</Text>
        <View>
          {FILTER_TYPES.map((t) => (
            <Radio key={t.key} label={t.label} selected={typeFilter === t.key} onPress={() => onTypeChange(t.key)} />
          ))}
        </View>

        <Text style={sectionLabel}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          <Chip label="All categories" selected={categoryFilter === "all"} onPress={() => onCategoryChange("all")} />
          {categories.map((category) => (
            <Chip key={category.id} label={category.label} selected={categoryFilter === category.id} onPress={() => onCategoryChange(category.id)} />
          ))}
        </ScrollView>

        <Text style={sectionLabel}>WHEN</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {DATE_RANGES.map((r) => (
            <Chip key={r} label={dateRangeLabel(r)} selected={dateRange === r} onPress={() => onDateRangeChange(r)} />
          ))}
        </View>
        {dateRange === "custom" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["from", "to"] as const).map((field) => {
              const value = field === "from" ? customFromDate : customToDate;
              return (
                <Pressable
                  key={field}
                  onPress={() => onOpenDatePicker(field)}
                  style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface, justifyContent: "center", paddingHorizontal: 14 }}
                >
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11.5, color: P.secondary }}>{field === "from" ? "From" : "To"}</Text>
                  <Text style={{ fontFamily: "Manrope", fontSize: 13.5, color: value ? P.ink : P.secondary, marginTop: 2 }}>{value ?? "Select date"}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {datePickerField ? (
          <DateTimePicker
            value={new Date(`${(datePickerField === "from" ? customFromDate : customToDate) ?? formatIsoDate(new Date())}T12:00:00`)}
            mode="date"
            onChange={(_event, date) => onSelectCustomDate(datePickerField, date)}
          />
        ) : null}

        <Text style={sectionLabel}>SORT BY</Text>
        <View>
          {SORT_OPTIONS.map((opt) => (
            <Radio
              key={`${opt.by}-${opt.dir}`}
              label={opt.label}
              hint={"hint" in opt ? opt.hint : undefined}
              selected={sortBy === opt.by && sortDir === opt.dir}
              onPress={() => onSortChange(opt.by, opt.dir)}
            />
          ))}
        </View>
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={onReset}
            style={{
              flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>
              Reset
            </Text>
          </Pressable>
          <Pressable
            onPress={onApply}
            style={{
              flex: 1, minHeight: 50, borderRadius: 12, backgroundColor: P.brand,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
              Apply
            </Text>
          </Pressable>
        </View>
      </BottomSheetSurface>
    </ActionSheet>
  );
}
