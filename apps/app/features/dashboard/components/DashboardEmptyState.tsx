import { Pressable, Text, View } from "react-native";

type Props = { onNavigate: (page: string) => void };

const actions = [
  { label: "Add account", page: "financial-accounts", copy: "Add an account to make your available balance accurate." },
  { label: "Record a transaction", page: "add-transaction", copy: "Record income or an expense to start tracking your cash flow." },
  { label: "Add an income source", page: "income-sources", copy: "Set expected income to make your monthly plan more useful." },
  { label: "Create a budget", page: "budgeting", copy: "Set a budget to see spending health." },
  { label: "Create a savings goal", page: "savings-goals", copy: "No savings goals yet." },
  { label: "View forecast", page: "spending-forecast", copy: "Forecast information will appear after you record activity." },
];

export function DashboardEmptyState({ onNavigate }: Props) {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Set up your financial picture</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942" }}>Start with an account, then add the records that make each dashboard summary useful.</Text>
       {actions.map((action) => <Pressable key={action.page} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => onNavigate(action.page)} style={{ padding: 20, borderRadius: 32, backgroundColor: "#F8EFDC" }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>{action.label}</Text><Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 6 }}>{action.copy}</Text></Pressable>)}
      <View style={{ height: 140, padding: 20, borderRadius: 32, backgroundColor: "#F8EFDC", justifyContent: "center", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>Charts</Text><Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 6, textAlign: "center" }}>No chart data yet. Record activity to see spending and balance trends.</Text></View>
    </View>
  );
}
