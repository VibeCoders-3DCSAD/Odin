import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import BudgetingScreen from "../budgeting/BudgetingScreen";

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onSyncRequested?: () => Promise<void>;
};

type PlanSection = "budget" | "savings" | "debt";

const sections: { id: PlanSection; label: string }[] = [
  { id: "budget", label: "Budget Plan" },
  { id: "savings", label: "Savings Contributions Plan" },
  { id: "debt", label: "Debt Repayment Plan" },
];

export default function FinancialPlanScreen({ userId, deviceId, accessToken, onSyncRequested }: Props) {
  const [selectedSection, setSelectedSection] = useState<PlanSection>("budget");

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Financial Plan</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>
        Plan your budget, savings contributions, and debt repayments in one place.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16, marginBottom: 18 }}>
        {sections.map((section) => {
          const selected = selectedSection === section.id;
          return (
            <Pressable
              key={section.id}
              accessibilityRole="tab"
              accessibilityLabel={section.label}
              accessibilityState={{ selected }}
              onPress={() => setSelectedSection(section.id)}
              style={{ backgroundColor: selected ? "#0E6D46" : "#F1F0EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }}
            >
              <Text style={{ color: selected ? "#FFFFFF" : "#414942", fontFamily: "Manrope", fontSize: 12, fontWeight: "700" }}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {selectedSection === "budget" ? (
        <BudgetingScreen userId={userId} deviceId={deviceId} accessToken={accessToken} onSyncRequested={onSyncRequested} />
      ) : (
        <View style={{ backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
          <Text style={{ color: "#1B1C1A", fontFamily: "Manrope", fontSize: 16, fontWeight: "800" }}>
            {sections.find((section) => section.id === selectedSection)?.label}
          </Text>
        </View>
      )}
    </View>
  );
}
