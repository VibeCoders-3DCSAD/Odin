import { Pressable, Text, View } from "react-native";
import { dashboardColors as P, dashboardStyles } from "../dashboardAppearance";

type Props = {
  title: string;
  copy: string;
  stale?: boolean;
  unavailable?: boolean;
  refreshable?: boolean;
  actionLabel?: string;
  onNavigate: () => void;
  onRefresh: () => void;
};

export function SnapshotCard({ title, copy, stale, unavailable, refreshable, actionLabel = "View details", onNavigate, onRefresh }: Props) {
  return (
    <View style={[dashboardStyles.card, { flex: 1, gap: 8 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>{title}</Text>
        {stale || unavailable || refreshable ? <Pressable accessibilityRole="button" accessibilityLabel={`Refresh ${title}`} onPress={onRefresh} hitSlop={8}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.green }}>Refresh</Text></Pressable> : null}
      </View>
      {unavailable ? <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: P.secondary, marginTop: 6 }}>Information unavailable</Text> : stale ? <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: P.secondary, marginTop: 6 }}>Cached information</Text> : null}
      <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.secondary }}>{copy}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel === "View details" ? `View ${title}` : actionLabel} onPress={onNavigate} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.green }}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
