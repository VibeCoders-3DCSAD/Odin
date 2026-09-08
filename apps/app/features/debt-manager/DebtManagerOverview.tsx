import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { listFinancialAccounts, type FinancialAccount } from "../../local-db/repositories/financialFoundations";
import { listDebtAccounts, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import NonCreditDebtDetail from "./NonCreditDebtDetail";
import NonCreditDebtForm from "./NonCreditDebtForm";
import NonCreditDebtList from "./NonCreditDebtList";

type Props = { userId: string; deviceId: string; onOpenCreditCards: () => void };

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;

export default function DebtManagerOverview({ userId, deviceId, onOpenCreditCards }: Props) {
  const [cards, setCards] = useState<FinancialAccount[] | null>(null);
  const [debts, setDebts] = useState<DebtAccount[] | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<DebtAccount | null>(null);
  const [editingDebt, setEditingDebt] = useState<DebtAccount | null | undefined>(undefined);

  async function load() { const [accounts, debtRows] = await Promise.all([listFinancialAccounts(userId), listDebtAccounts(userId)]); setCards(accounts.filter((account) => account.kind === "credit_card" && account.status === "active")); setDebts(debtRows); setSelectedDebt((current) => current ? debtRows.find((item) => item.id === current.id) ?? null : debtRows[0] ?? null); }
  useEffect(() => { load().catch(() => { setCards([]); setDebts([]); }); }, [userId]);

  if (cards === null || debts === null) return <ActivityIndicator color={P.brand} />;
  if (editingDebt !== undefined) return <NonCreditDebtForm userId={userId} deviceId={deviceId} debt={editingDebt} onCancel={() => setEditingDebt(undefined)} onSaved={(debt) => { setEditingDebt(undefined); setSelectedDebt(debt); load().catch(() => {}); }} />;

  return <View>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink }}>Debt Manager</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Review your debt accounts and payment commitments</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Credit Cards" onPress={onOpenCreditCards} style={{ marginTop: 16, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 16, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>Credit Cards</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 4 }}>{cards.length === 0 ? "Add a credit card to begin tracking billing cycles." : `${cards.length} active ${cards.length === 1 ? "card" : "cards"}, organized by billing cycle.`}</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.brand, marginTop: 12 }}>Manage credit cards</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Add non-credit-card debt" onPress={() => setEditingDebt(null)} style={{ marginTop: 16, backgroundColor: P.brand, borderRadius: 14, padding: 12 }}><Text style={{ color: "white", fontWeight: "800" }}>Add debt</Text></Pressable>
    <NonCreditDebtList debts={debts} selectedDebtId={selectedDebt?.id ?? null} onSelectDebt={setSelectedDebt} />
    {selectedDebt ? <NonCreditDebtDetail userId={userId} deviceId={deviceId} debt={selectedDebt} onEdit={setEditingDebt} onChanged={() => load().catch(() => {})} /> : null}
  </View>;
}
