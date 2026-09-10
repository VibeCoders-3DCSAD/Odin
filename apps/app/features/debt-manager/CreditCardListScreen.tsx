import React from "react";
import { Pressable, Text, View } from "react-native";
import type { FinancialAccount } from "../../local-db/repositories/financialFoundations";
import type { CreditCardCycle } from "../../local-db/repositories/creditCardCycles";

type Props = {
  accounts: FinancialAccount[];
  cycles: CreditCardCycle[];
  onOpenCard: (accountId: string) => void;
};

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;

function formatPeso(amount: number | null | undefined): string {
  return amount == null ? "Not available" : `PHP ${(amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CreditCardListScreen({ accounts, cycles, onOpenCard }: Props) {
  return <View>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink }}>Credit Cards</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Select a card to view its cycles, statements, and payments.</Text>
    {accounts.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.muted, marginTop: 16 }}>No credit cards are recorded yet.</Text> : accounts.map((account) => {
      const details = account.creditCardDetails;
      const cycle = cycles.filter((item) => item.account_id === account.id).sort((a, b) => b.cutoff_date.localeCompare(a.cutoff_date))[0];
      return <Pressable key={account.id} accessibilityRole="button" accessibilityLabel={`Open ${account.name}`} onPress={() => onOpenCard(account.id)} style={{ marginTop: 12, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 14, backgroundColor: P.shell }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>{account.name}</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 3 }}>{details?.issuer ?? account.institutionName ?? "Credit Card"}</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 10 }}>Credit limit: {formatPeso(details?.creditLimitCentavos)} | Available: {formatPeso(details?.availableCreditCentavos)}</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 3 }}>{cycle ? `Latest cycle: ${cycle.cycle_start_date} to ${cycle.cutoff_date}` : "No billing cycle recorded"}</Text>
      </Pressable>;
    })}
  </View>;
}
