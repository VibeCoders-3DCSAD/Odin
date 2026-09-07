import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { listFinancialAccounts, type FinancialAccount } from "../../local-db/repositories/financialFoundations";

type Props = { userId: string; onOpenCreditCards: () => void };

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;

export default function DebtManagerOverview({ userId, onOpenCreditCards }: Props) {
  const [cards, setCards] = useState<FinancialAccount[] | null>(null);

  useEffect(() => {
    listFinancialAccounts(userId)
      .then((accounts) => setCards(accounts.filter((account) => account.kind === "credit_card" && account.status === "active")))
      .catch(() => setCards([]));
  }, [userId]);

  if (cards === null) return <ActivityIndicator color={P.brand} />;

  return <View>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink }}>Debt Manager</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Review your debt accounts and payment commitments</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Credit Cards" onPress={onOpenCreditCards} style={{ marginTop: 16, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 16, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>Credit Cards</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 4 }}>{cards.length === 0 ? "Add a credit card to begin tracking billing cycles." : `${cards.length} active ${cards.length === 1 ? "card" : "cards"}, organized by billing cycle.`}</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.brand, marginTop: 12 }}>Manage credit cards</Text>
    </Pressable>
  </View>;
}
