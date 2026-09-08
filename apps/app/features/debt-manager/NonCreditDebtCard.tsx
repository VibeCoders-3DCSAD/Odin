import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { archiveDebtAccount, markDebtAccountDeleted, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import { deleteTransactionDebtPayment, listDebtPayments, type DebtPayment } from "../../local-db/repositories/debtPayments";
import { getDebtRepaymentForecast } from "./debtForecast";

const P = { brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", shell: "#FCF8F0", danger: "#B42318" } as const;
const PAYMENT_LIMIT = 3;

type Props = {
  userId: string;
  deviceId: string;
  debt: DebtAccount;
  onEdit: (debt: DebtAccount) => void;
  onRecordPayment: (debtId: string) => void;
  onEditPayment: (payment: DebtPayment) => void;
  onChanged: () => void;
};

function money(value: number) { return `PHP ${(value / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`; }
function progressLabel(debt: DebtAccount) { return debt.status === "paid_off" ? "Paid off" : debt.progress === "no_payments" ? "No payments yet" : debt.progress.replace("_", " "); }
function repaymentLabel(status: ReturnType<typeof getDebtRepaymentForecast>["status"]) { return status.replaceAll("_", " "); }

export default function NonCreditDebtCard({ userId, deviceId, debt, onEdit, onRecordPayment, onEditPayment, onChanged }: Props) {
  const [payments, setPayments] = useState<DebtPayment[] | null>(null);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const finished = debt.status === "paid_off";

  function loadPayments() { listDebtPayments(userId, debt.id).then(setPayments).catch(() => setPayments([])); }
  useEffect(() => { setShowAllPayments(false); loadPayments(); }, [debt.id, userId]);

  async function changeDebt(action: "archive" | "delete") {
    try {
      if (action === "archive") await archiveDebtAccount(userId, deviceId, debt.id);
      else await markDebtAccountDeleted(userId, deviceId, debt.id);
      onChanged();
    } catch { setMessage("Your debt changes could not be completed. Review the debt details and try again."); }
  }

  const visiblePayments = showAllPayments ? payments : payments?.slice(0, PAYMENT_LIMIT);
  const forecast = getDebtRepaymentForecast(debt);
  return <View style={{ borderWidth: 1, borderColor: P.line, borderRadius: 18, overflow: "hidden", backgroundColor: "white" }}>
    <View style={{ padding: 16, backgroundColor: P.shell }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontSize: 17, fontWeight: "800", color: P.ink }}>{debt.name}</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>{debt.lenderName ?? "No lender listed"}</Text></View>
        <Text style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: "800", color: P.brand, textTransform: "uppercase" }}>{progressLabel(debt)}</Text>
      </View>
       <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
        <View><Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted }}>REMAINING</Text><Text style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: "800", color: P.ink, marginTop: 2 }}>{money(debt.currentBalanceCentavos)}</Text></View>
        <View style={{ alignItems: "flex-end" }}><Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted }}>NEXT PAYMENT</Text><Text style={{ fontFamily: "Manrope", fontSize: 13, fontWeight: "700", color: P.ink, marginTop: 4 }}>{debt.nextDueDate ?? "Not scheduled"}</Text></View>
       </View>
       <View style={{ borderTopColor: P.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 12 }}>
         <View><Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted }}>REPAYMENT FORECAST</Text><Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 13, fontWeight: "800", marginTop: 3, textTransform: "capitalize" }}>{repaymentLabel(forecast.status)}</Text></View>
         <View style={{ alignItems: "flex-end" }}><Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted }}>ESTIMATED PAYOFF</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "700", marginTop: 3 }}>{forecast.estimatedPayoffDate ?? "Not scheduled"}</Text></View>
       </View>
     </View>
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.ink }}>Recent payments</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>{payments === null ? "Loading..." : `${payments.length} recorded`}</Text></View>
      {payments !== null && payments.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.muted }}>No payments recorded yet.</Text> : null}
      {visiblePayments?.map((payment) => <View key={payment.id} style={{ borderTopWidth: 1, borderTopColor: P.line, paddingTop: 10, gap: 7 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.ink }}>{payment.payment_date}</Text><Text style={{ fontFamily: "Manrope", fontSize: 13, fontWeight: "800", color: P.ink }}>{money(payment.amount_centavos)}</Text></View>
        {confirmingPaymentId === payment.id ? <View style={{ backgroundColor: "#FFF4ED", borderRadius: 10, padding: 10, gap: 8 }}><Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.danger }}>Delete this payment and its related transaction?</Text><View style={{ flexDirection: "row", gap: 14 }}><Pressable accessibilityRole="button" onPress={() => setConfirmingPaymentId(null)}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: P.muted }}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={deletingPaymentId === payment.id} onPress={() => { setDeletingPaymentId(payment.id); deleteTransactionDebtPayment(userId, deviceId, payment.id).then(() => { setConfirmingPaymentId(null); loadPayments(); onChanged(); }).catch(() => setMessage("Your debt payment could not be completed. Review the payment details and try again.")).finally(() => setDeletingPaymentId(null)); }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.danger }}>{deletingPaymentId === payment.id ? "Deleting..." : "Confirm delete"}</Text></Pressable></View></View> : <View style={{ flexDirection: "row", gap: 16 }}><Pressable accessibilityRole="button" accessibilityLabel={`Edit payment on ${payment.payment_date}`} onPress={() => onEditPayment(payment)}><Text style={{ fontFamily: "Manrope", fontSize: 12, fontWeight: "800", color: P.brand }}>Edit payment</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete payment on ${payment.payment_date}`} onPress={() => setConfirmingPaymentId(payment.id)}><Text style={{ fontFamily: "Manrope", fontSize: 12, fontWeight: "800", color: P.danger }}>Delete payment</Text></Pressable></View>}
      </View>)}
      {payments !== null && payments.length > PAYMENT_LIMIT ? <Pressable accessibilityRole="button" accessibilityLabel={`Show ${showAllPayments ? "fewer" : "all"} payments for ${debt.name}`} onPress={() => setShowAllPayments((current) => !current)} style={{ alignSelf: "flex-start" }}><Text style={{ fontFamily: "Manrope", fontSize: 12, fontWeight: "800", color: P.brand }}>{showAllPayments ? "Show fewer payments" : `Load ${payments.length - PAYMENT_LIMIT} more payment${payments.length - PAYMENT_LIMIT === 1 ? "" : "s"}`}</Text></Pressable> : null}
      {message ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.danger }}>{message}</Text> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: P.line, paddingTop: 12, gap: 9 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.ink }}>Debt actions</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{!finished ? <Pressable accessibilityRole="button" accessibilityLabel={`Record payment for ${debt.name}`} onPress={() => onRecordPayment(debt.id)}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.brand }}>Record payment</Text></Pressable> : null}{!finished ? <Pressable accessibilityRole="button" onPress={() => onEdit(debt)}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.brand }}>Edit debt</Text></Pressable> : null}{confirming === "archive" ? <Pressable accessibilityRole="button" onPress={() => changeDebt("archive")}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.danger }}>Confirm archive</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => setConfirming("archive")}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.muted }}>Archive debt</Text></Pressable>}{confirming === "delete" ? <Pressable accessibilityRole="button" onPress={() => changeDebt("delete")}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.danger }}>Confirm delete</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => setConfirming("delete")}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.danger }}>Delete debt</Text></Pressable>}</View></View>
    </View>
  </View>;
}
