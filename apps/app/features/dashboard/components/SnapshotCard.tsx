import { Pressable, Text, View } from "react-native";

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
    <View style={{ flex: 1, minHeight: 132, borderRadius: 32, backgroundColor: "#F8EFDC", padding: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>{title}</Text>
        {stale || unavailable || refreshable ? <Pressable accessibilityRole="button" accessibilityLabel={`Refresh ${title}`} onPress={onRefresh} hitSlop={8}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#066B40" }}>Refresh</Text></Pressable> : null}
      </View>
      {unavailable ? <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: "#414942", marginTop: 6 }}>Information unavailable</Text> : stale ? <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: "#414942", marginTop: 6 }}>Cached information</Text> : null}
      <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 10 }}>{copy}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel === "View details" ? `View ${title}` : actionLabel} onPress={onNavigate} style={{ marginTop: "auto" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#066B40" }}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
