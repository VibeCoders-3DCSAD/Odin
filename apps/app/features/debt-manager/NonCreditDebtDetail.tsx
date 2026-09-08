import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { archiveDebtAccount, markDebtAccountDeleted, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import { getDebtTypeLabel } from "./debtTypes";

export default function NonCreditDebtDetail({ userId, deviceId, debt, onEdit, onChanged }: { userId: string; deviceId: string; debt: DebtAccount; onEdit: (debt: DebtAccount) => void; onChanged: () => void }) {
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null); const [message, setMessage] = useState<string | null>(null);
  async function change(action: "archive" | "delete") { try { if (action === "archive") await archiveDebtAccount(userId, deviceId, debt.id); else await markDebtAccountDeleted(userId, deviceId, debt.id); onChanged(); } catch { setMessage("Your debt changes could not be completed. Review the debt details and try again."); } }
  return <View style={{ marginTop: 18, borderWidth: 1, borderColor: "#EAEAE6", borderRadius: 14, padding: 14, gap: 7 }}>
    <Text style={{ fontSize: 16, fontWeight: "800" }}>{debt.name}</Text><Text>{getDebtTypeLabel(debt.type)} · {debt.status}</Text><Text>Remaining balance: PHP {(debt.currentBalanceCentavos / 100).toFixed(2)}</Text><Text>{debt.hasPaymentHistory ? "Payment history available." : "No payments recorded yet."}</Text>
    {message ? <Text style={{ color: "#B42318" }}>{message}</Text> : null}<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Pressable accessibilityRole="button" onPress={() => onEdit(debt)}><Text>Edit debt</Text></Pressable>
      {confirming === "archive" ? <Pressable accessibilityRole="button" onPress={() => change("archive")}><Text>Confirm archive</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => setConfirming("archive")}><Text>Archive debt</Text></Pressable>}
      {confirming === "delete" ? <Pressable accessibilityRole="button" onPress={() => change("delete")}><Text>Confirm delete</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => setConfirming("delete")}><Text>Delete debt</Text></Pressable>}</View>
  </View>;
}
