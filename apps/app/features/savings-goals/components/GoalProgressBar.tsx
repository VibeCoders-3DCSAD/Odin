import { View } from "react-native";

// Bare progress track for savings goals (list row and goal detail). Debt Manager's labelled, toned bar lives in debtUi.
const TRACK = "#DCDAD2";
const BRAND = "#013220";

export function GoalProgressBar({ percent }: { percent: number }) {
  const width = Math.max(0, Math.min(100, percent));
  return <View style={{ backgroundColor: TRACK, borderRadius: 999, height: 6, overflow: "hidden" }}><View style={{ backgroundColor: BRAND, borderRadius: 999, height: 6, width: `${width}%` }} /></View>;
}
