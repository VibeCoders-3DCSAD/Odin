import { Pressable, Text, TextInput, View } from "react-native";
import { Funnel, MagnifyingGlass } from "phosphor-react-native";
import { dashboardColors as P } from "../../../dashboard/dashboardAppearance";

type Props = {
  search: string;
  onSearchChange: (text: string) => void;
  onSearchSubmit: () => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
};

// Search and the filters button share one card.
export function HistorySearchCard({ search, onSearchChange, onSearchSubmit, activeFilterCount, onOpenFilters }: Props) {
  return (
    <View style={{ backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 15, gap: 9 }}>
      <View style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 }}>
        <MagnifyingGlass size={16} color={P.secondary} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
          accessibilityLabel="Search transactions"
          placeholder="Search transactions..."
          placeholderTextColor={P.secondary}
          style={{ flex: 1, minHeight: 46, fontFamily: "Manrope", fontSize: 13.5, color: P.ink }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenFilters}
        style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <Funnel size={17} color={P.ink} />
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>
          Filters and sort{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
        </Text>
      </Pressable>
    </View>
  );
}
