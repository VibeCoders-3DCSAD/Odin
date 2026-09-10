import React, { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import type { CreditCardCycle, CreditCardCycleTransaction } from "../../local-db/repositories/creditCardCycles";
import type { CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import type { CreditCardInstallment } from "../../local-db/repositories/creditCardInstallments";
import type { FinancialAccount } from "../../local-db/repositories/financialFoundations";
import CreditCardStatementForm from "./CreditCardStatementForm";
import { calculateCreditCardPaymentStatus, creditBalanceCentavos, deleteStatementPayment, type CreditCardPayment, type StatementPaymentContext } from "../../local-db/repositories/creditCardPayments";
import { recognizeCreditCardSettlement, requestCreditCardSettlement, type CreditCardSettlement } from "../../local-db/repositories/creditCardSettlements";

const P = {
  shell: "#fcf8f0",
  brand: "#013220",
  ink: "#1B1C1A",
  muted: "#6B7A6F",
  line: "#EAEAE6",
  card: "#F1F0EB",
  accent: "#DCEADE",
} as const;

type Props = {
  userId: string;
  deviceId: string;
  accounts: FinancialAccount[];
  cycles: CreditCardCycle[];
  transactions: CreditCardCycleTransaction[];
  statements: CreditCardStatement[];
  installments: CreditCardInstallment[];
  payments: CreditCardPayment[];
  settlements: CreditCardSettlement[];
  statementCycle: CreditCardCycle | null;
  onManageCycle: (account: FinancialAccount, cycle: CreditCardCycle | null) => void;
  onAddStatement: (cycle: CreditCardCycle) => void;
  onCancelStatement: () => void;
  onStatementSaved: () => Promise<void>;
  onPayStatement?: (context: StatementPaymentContext) => void;
  onEditPayment?: (payment: CreditCardPayment) => void;
  accountId?: string;
  today?: string;
};

function formatPeso(centavos: number | null | undefined): string {
  if (centavos == null) return "Not available";
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isCurrentCycle(cycle: CreditCardCycle, today: string): boolean {
  return cycle.cycle_start_date <= today && cycle.cutoff_date >= today;
}

function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromIso(value: string): Date { return new Date(`${value}T12:00:00`); }
function dateToIso(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }

function CreditCardInventory({ accounts, cycles, onManageCycle, today }: Pick<Props, "accounts" | "cycles" | "onManageCycle"> & { today: string }) {
  return (
    <View>
      <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted, marginBottom: 10 }}>{accounts.length} active</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginBottom: 12 }}>Your cards, limits, and available credit.</Text>
      {accounts.map((account) => {
        const accountCycles = cycles.filter((cycle) => cycle.account_id === account.id);
        const currentCycle = accountCycles.find((cycle) => isCurrentCycle(cycle, today)) ?? (accountCycles.length === 1 ? accountCycles[0] ?? null : null);
        const details = account.creditCardDetails;
        return (
          <View key={account.id} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 14, marginBottom: 10, backgroundColor: P.shell }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>{account.name}</Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 3 }}>{details?.issuer ?? account.institutionName ?? "Credit Card"}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Manage billing cycle for ${account.name}`} onPress={() => onManageCycle(account, currentCycle)}>
                <Text style={{ color: P.brand, fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5 }}>{currentCycle ? "Edit cycle" : "Add cycle"}</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 22, marginTop: 13 }}>
              <View>
                <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted }}>Credit limit</Text>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: P.ink, marginTop: 2 }}>{formatPeso(details?.creditLimitCentavos)}</Text>
              </View>
              <View>
                <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted }}>Available credit</Text>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: P.ink, marginTop: 2 }}>{formatPeso(details?.availableCreditCentavos)}</Text>
              </View>
            </View>
            {!currentCycle ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 12 }}>No billing cycles are recorded for this card yet.</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function BillingCycleCard({ account, accountCycleCount, cycle, transactions, statement, payment, statementCycle, onManageCycle, onAddStatement, onCancelStatement, onStatementSaved, onPayStatement, onEditPayment, today, userId, deviceId }: {
  account: FinancialAccount;
  accountCycleCount: number;
  cycle: CreditCardCycle;
  transactions: CreditCardCycleTransaction[];
  statement: CreditCardStatement | undefined;
  payment: CreditCardPayment | undefined;
  statementCycle: CreditCardCycle | null;
  onManageCycle: Props["onManageCycle"];
  onAddStatement: Props["onAddStatement"];
  onCancelStatement: Props["onCancelStatement"];
  onStatementSaved: Props["onStatementSaved"];
  onPayStatement: Props["onPayStatement"];
  onEditPayment: Props["onEditPayment"];
  today: string;
  userId: string;
  deviceId: string;
}) {
  const [confirmingPaymentDelete, setConfirmingPaymentDelete] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const current = isCurrentCycle(cycle, today) || accountCycleCount === 1;
  const needsStatement = cycle.cutoff_date < today && !cycle.statement_date && !statement;
  return (
    <View style={{ borderWidth: 1, borderColor: current ? P.brand : P.line, borderRadius: 16, overflow: "hidden", marginBottom: 12, backgroundColor: P.shell }}>
      <View style={{ padding: 14, backgroundColor: current ? P.accent : P.card }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: P.ink }}>{current ? "Current billing cycle" : "Billing cycle"}</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.ink, marginTop: 4 }}>{account.name}</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 3 }}>{cycle.cycle_start_date} to {cycle.cutoff_date}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit billing cycle for ${account.name}`} onPress={() => onManageCycle(account, cycle)}>
            <Text style={{ color: P.brand, fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5 }}>Edit</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ padding: 14, gap: 14 }}>
        <View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.ink }}>Cycle details</Text>
          <View style={{ gap: 3, marginTop: 6 }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Cycle start: <Text style={{ color: P.ink }}>{cycle.cycle_start_date}</Text></Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Cutoff: <Text style={{ color: P.ink }}>{cycle.cutoff_date}</Text></Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Statement: <Text style={{ color: P.ink }}>{cycle.statement_date ?? "Not recorded"}</Text></Text>
          </View>
        </View>
         {statement ? (
           <View style={{ borderTopWidth: 1, borderTopColor: P.line, paddingTop: 12 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.ink }}>Recorded statement</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 5 }}>Statement date: {statement.statement_date} · Due: {statement.due_date}</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 2 }}>Balance: {formatPeso(statement.statement_balance_centavos)} · Minimum: {formatPeso(statement.minimum_due_centavos)}</Text>
              <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 2 }}>Finance charges: {formatPeso(statement.finance_charge_centavos)}</Text>
             {payment ? (() => {
               const status = calculateCreditCardPaymentStatus(payment.amount_centavos, statement.statement_balance_centavos, statement.minimum_due_centavos);
               const remaining = Math.max(0, statement.statement_balance_centavos - payment.amount_centavos);
               const creditBalance = creditBalanceCentavos(payment.amount_centavos, statement.statement_balance_centavos);
               const message = status === "fully_paid"
                 ? "This statement is fully paid. No remaining statement balance is currently recorded."
                 : status === "minimum_satisfied"
                   ? "The minimum payment is satisfied, but the remaining balance may incur finance charges."
                   : "This statement is not fully paid and the minimum amount due is not yet satisfied. Review the remaining payment.";
               return <View style={{ marginTop: 8 }}><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.ink }}>Payment: {formatPeso(payment.amount_centavos)} · Remaining: {formatPeso(remaining)}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 2 }}>{message}</Text>{creditBalance > 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 2 }}>This payment created a credit balance of {formatPeso(creditBalance)}. Apply it to a future charge only when the user or issuer confirms it.</Text> : null}{confirmingPaymentDelete ? <View style={{ marginTop: 8 }}><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Deleting this payment removes it from the statement history and reverses its related transaction. Cancel to keep it or confirm deletion to continue.</Text><View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}><Pressable onPress={() => setConfirmingPaymentDelete(false)}><Text style={{ color: P.muted, fontWeight: "700", fontFamily: "Manrope", fontSize: 12 }}>Cancel</Text></Pressable><Pressable disabled={deletingPayment} onPress={() => { setDeletingPayment(true); deleteStatementPayment(userId, deviceId, payment.id).then(onStatementSaved).finally(() => { setDeletingPayment(false); setConfirmingPaymentDelete(false); }); }}><Text style={{ color: "#D9001F", fontWeight: "700", fontFamily: "Manrope", fontSize: 12 }}>{deletingPayment ? "Deleting..." : "Confirm delete"}</Text></Pressable></View></View> : <View style={{ flexDirection: "row", gap: 12, marginTop: 7 }}><Pressable accessibilityRole="button" accessibilityLabel={`Edit payment for ${account.name}`} onPress={() => onEditPayment?.(payment)}><Text style={{ color: P.brand, fontWeight: "700", fontFamily: "Manrope", fontSize: 12 }}>Edit payment</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete payment for ${account.name}`} onPress={() => setConfirmingPaymentDelete(true)}><Text style={{ color: "#D9001F", fontWeight: "700", fontFamily: "Manrope", fontSize: 12 }}>Delete payment</Text></Pressable></View>}</View>;
             })() : <Pressable accessibilityRole="button" accessibilityLabel={`Pay statement for ${account.name}`} onPress={() => onPayStatement?.({ statementId: statement.id, cycleId: cycle.id })} style={{ marginTop: 8 }}><Text style={{ color: P.brand, fontWeight: "700", fontFamily: "Manrope", fontSize: 12 }}>Pay statement</Text></Pressable>}
           </View>
        ) : null}
        {needsStatement ? (
          <View style={{ borderTopWidth: 1, borderTopColor: P.line, paddingTop: 12 }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Have you received the statement for this billing cycle?</Text>
            <Pressable accessibilityRole="button" onPress={() => onAddStatement(cycle)} style={{ marginTop: 7 }}><Text style={{ color: P.brand, fontWeight: "700", fontFamily: "Manrope", fontSize: 12 }}>Add statement</Text></Pressable>
            {statementCycle?.id === cycle.id ? <CreditCardStatementForm userId={userId} deviceId={deviceId} cycleId={cycle.id} cycleCutoffDate={cycle.cutoff_date} today={today} onCancel={onCancelStatement} onSaved={onStatementSaved} /> : null}
          </View>
        ) : null}
        <View style={{ borderTopWidth: 1, borderTopColor: P.line, paddingTop: 12 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.ink }}>Transactions</Text>
          {transactions.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 6 }}>No purchases recorded in this billing cycle.</Text> : transactions.map((item) => (
            <View key={item.transaction_id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 9 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.ink }}>{item.merchant_name ?? "Credit-card purchase"}</Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 2 }}>{item.transaction_date} · {item.purchase_type === "installment" ? "Installment purchase" : "Regular purchase"}</Text>
              </View>
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.ink }}>{formatPeso(item.amount_centavos)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function CreditCardCollections({ userId, deviceId, accounts, cycles, transactions, statements, installments, payments, strategies, settlements, statementCycle, onManageCycle, onAddStatement, onCancelStatement, onStatementSaved, onPayStatement, onEditPayment, accountId, today = localToday() }: Props) {
  const visibleAccounts = accountId ? accounts.filter((account) => account.id === accountId) : accounts;
  const visibleCycles = accountId ? cycles.filter((cycle) => cycle.account_id === accountId) : cycles;
  const visibleInstallments = accountId ? installments.filter((installment) => installment.account_id === accountId) : installments;
  const accountsById = new Map(visibleAccounts.map((account) => [account.id, account]));
  const [settlingInstallmentId, setSettlingInstallmentId] = useState<string | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementFee, setSettlementFee] = useState("");
  const [settlementDate, setSettlementDate] = useState(today);
  const [settlementDatePickerVisible, setSettlementDatePickerVisible] = useState(false);
  const [settlementMessage, setSettlementMessage] = useState<string | null>(null);
  return (
    <View>
      {accountId ? null : <CreditCardInventory accounts={visibleAccounts} cycles={visibleCycles} onManageCycle={onManageCycle} today={today} />}
      {visibleInstallments.length > 0 ? <View style={{ borderTopWidth: 1, borderTopColor: P.line, marginTop: 18, paddingTop: 16 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Active installments</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 4 }}>Monthly due amounts are estimates until the issuer confirms them.</Text>
        {visibleInstallments.map((installment) => <View key={installment.id} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 14, padding: 12, marginTop: 10, backgroundColor: P.shell }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: P.ink }}>{installment.description}</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 4 }}>{formatPeso(installment.monthly_amortization_centavos)} / month · {installment.remaining_months} of {installment.term_months} months remaining</Text>
           <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 2 }}>Remaining principal: {formatPeso(installment.remaining_principal_centavos)} · {installment.interest_type === "zero_interest" ? "Zero interest" : `Interest: ${((installment.interest_rate_bps ?? 0) / 100).toFixed(2)}%`}</Text>
           {settlements.filter((settlement) => settlement.installment_id === installment.id).map((settlement) => <View key={settlement.id} style={{ marginTop: 8 }}><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Settlement {settlement.status}: {formatPeso(settlement.settlement_amount_centavos)} on {settlement.settlement_date}{settlement.pretermination_fee_centavos > 0 ? ` | Fee ${formatPeso(settlement.pretermination_fee_centavos)}` : ""}</Text>{settlement.status === "requested" ? <Pressable accessibilityRole="button" accessibilityLabel="Mark settlement issuer recognized" onPress={() => { recognizeCreditCardSettlement(userId, deviceId, settlement.id).then(onStatementSaved).catch(() => setSettlementMessage("The issuer recognition could not be recorded.")); }} style={{ marginTop: 4 }}><Text style={{ color: P.brand, fontWeight: "700", fontSize: 11 }}>Mark issuer recognized</Text></Pressable> : null}</View>)}
           {settlingInstallmentId === installment.id ? <View style={{ gap: 8, marginTop: 10 }}><TextInput accessibilityLabel="Early settlement amount" value={settlementAmount} onChangeText={setSettlementAmount} placeholder="Enter settlement amount" keyboardType="decimal-pad" style={{ backgroundColor: P.card, borderRadius: 8, padding: 9 }} /><TextInput accessibilityLabel="Pre-termination fee" value={settlementFee} onChangeText={setSettlementFee} placeholder="Enter pre-termination fee" keyboardType="decimal-pad" style={{ backgroundColor: P.card, borderRadius: 8, padding: 9 }} /><Pressable accessibilityRole="button" accessibilityLabel="Select early settlement date" onPress={() => setSettlementDatePickerVisible(true)} style={{ backgroundColor: P.card, borderRadius: 8, padding: 9 }}><Text style={{ color: P.ink }}>{settlementDate}</Text></Pressable>{settlementDatePickerVisible ? <DateTimePicker value={dateFromIso(settlementDate)} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, date) => { if (event.type === "set" && date) setSettlementDate(dateToIso(date)); if (Platform.OS !== "ios") setSettlementDatePickerVisible(false); }} /> : null}<View style={{ flexDirection: "row", gap: 12 }}><Pressable onPress={() => setSettlingInstallmentId(null)}><Text style={{ color: P.muted, fontWeight: "700" }}>Cancel</Text></Pressable><Pressable onPress={() => { const amount = Math.round(Number(settlementAmount) * 100); const fee = Math.round(Number(settlementFee || "0") * 100); requestCreditCardSettlement(userId, deviceId, { installmentId: installment.id, settlementDate, remainingPrincipalCentavos: installment.remaining_principal_centavos, settlementAmountCentavos: amount, preterminationFeeCentavos: fee }).then(async () => { setSettlementMessage("The early settlement request was recorded. The installment remains active until the issuer recognizes it."); setSettlingInstallmentId(null); await onStatementSaved(); }).catch(() => setSettlementMessage("Some early-settlement details are not valid.")); }}><Text style={{ color: P.brand, fontWeight: "700" }}>Record early settlement</Text></Pressable></View></View> : <Pressable accessibilityRole="button" accessibilityLabel={`Record early settlement for ${installment.description}`} onPress={() => { setSettlingInstallmentId(installment.id); setSettlementAmount((installment.remaining_principal_centavos / 100).toFixed(2)); setSettlementFee(""); setSettlementDate(today); }} style={{ marginTop: 9 }}><Text style={{ color: P.brand, fontWeight: "700", fontSize: 12 }}>Record early settlement</Text></Pressable>}
         </View>)}
         {settlementMessage ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 8 }}>{settlementMessage}</Text> : null}
      </View> : null}
      <View style={{ height: 1, backgroundColor: P.line, marginVertical: 18 }} />
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Billing Cycles</Text>
         <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted }}>{visibleCycles.length} recorded</Text>
      </View>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginBottom: 12 }}>Statements and purchases stay with the cycle they belong to.</Text>
       {visibleCycles.map((cycle) => {
        const account = accountsById.get(cycle.account_id);
        if (!account) return null;
         const statement = statements.find((item) => item.cycle_id === cycle.id);
         return <BillingCycleCard key={cycle.id} account={account} accountCycleCount={visibleCycles.filter((item) => item.account_id === account.id).length} cycle={cycle} transactions={transactions.filter((transaction) => transaction.cycle_id === cycle.id)} statement={statement} payment={statement ? payments.find((item) => item.statement_id === statement.id) : undefined} statementCycle={statementCycle} onManageCycle={onManageCycle} onAddStatement={onAddStatement} onCancelStatement={onCancelStatement} onStatementSaved={onStatementSaved} onPayStatement={onPayStatement} onEditPayment={onEditPayment} today={today} userId={userId} deviceId={deviceId} />;
      })}
    </View>
  );
}
