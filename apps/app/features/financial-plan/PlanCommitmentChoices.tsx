import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReservationSkips } from "./api";

type Props = {
  skips: ReservationSkips;
  onChange: (skips: ReservationSkips) => void;
};

const choices = [
  { key: "savingsContributions", label: "I'll budget savings manually", excluded: "Savings contributions excluded from this plan." },
  { key: "debtRepayments", label: "I'll budget debt repayments manually", excluded: "Debt repayments excluded from this plan. Existing payments are still due." },
  { key: "scheduledPayments", label: "I'll budget billers & remittances manually", excluded: "Billers and remittances excluded from this plan. Existing bills are still due." },
] as const;

export function PlanCommitmentChoices({ skips, onChange }: Props) {
  return <View style={styles.section}>
    <Text style={styles.heading}>Savings, debt &amp; bills</Text>
    <Text style={styles.description}>All are included by default. Set the amounts on the next screen.</Text>
    {choices.map(({ key, label, excluded }) => {
      const checked = skips[key];
      return <View key={key} style={styles.choice}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }} onPress={() => onChange({ ...skips, [key]: !skips[key] })} style={[styles.row, checked && styles.selected]}>
          <View style={[styles.checkbox, checked && styles.checked]}><Text style={styles.check}>{checked ? "✓" : ""}</Text></View>
          <Text style={styles.label}>{label}</Text>
        </Pressable>
        {checked ? <Text style={styles.excluded}>{excluded}</Text> : null}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 20, gap: 8 },
  heading: { fontFamily: "Manrope", fontSize: 16, fontWeight: "800", color: "#1B1C1A" },
  description: { fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", lineHeight: 18 },
  choice: { gap: 5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: "#D7DDD8", backgroundColor: "#FCF8F0" },
  selected: { borderColor: "#0E6D46", backgroundColor: "#EEFFF8" },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: "#A8B0AA", alignItems: "center", justifyContent: "center" },
  checked: { borderColor: "#0E6D46", backgroundColor: "#0E6D46" },
  check: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  label: { flex: 1, fontFamily: "Manrope", fontSize: 13, fontWeight: "700", color: "#1B1C1A" },
  excluded: { fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F", lineHeight: 16 },
});
