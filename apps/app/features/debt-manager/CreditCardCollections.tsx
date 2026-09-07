import React from "react";
import { Pressable, Text, View } from "react-native";
import type { CreditCardCycle, CreditCardCycleTransaction } from "../../local-db/repositories/creditCardCycles";
import type { CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import type { FinancialAccount } from "../../local-db/repositories/financialFoundations";
import CreditCardStatementForm from "./CreditCardStatementForm";

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
  statementCycle: CreditCardCycle | null;
  editingStatement: CreditCardStatement | null;
  onManageCycle: (account: FinancialAccount, cycle: CreditCardCycle | null) => void;
  onAddStatement: (cycle: CreditCardCycle) => void;
  onCancelStatement: () => void;
  onEditStatement: (statement: CreditCardStatement) => void;
  onCancelEditStatement: () => void;
  onStatementSaved: () => Promise<void>;
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

function BillingCycleCard({ account, accountCycleCount, cycle, transactions, statement, statementCycle, editingStatement, onManageCycle, onAddStatement, onCancelStatement, onEditStatement, onCancelEditStatement, onStatementSaved, today, userId, deviceId }: {
  account: FinancialAccount;
  accountCycleCount: number;
  cycle: CreditCardCycle;
  transactions: CreditCardCycleTransaction[];
  statement: CreditCardStatement | undefined;
  statementCycle: CreditCardCycle | null;
  editingStatement: CreditCardStatement | null;
  onManageCycle: Props["onManageCycle"];
  onAddStatement: Props["onAddStatement"];
  onCancelStatement: Props["onCancelStatement"];
  onEditStatement: Props["onEditStatement"];
  onCancelEditStatement: Props["onCancelEditStatement"];
  onStatementSaved: Props["onStatementSaved"];
  today: string;
  userId: string;
  deviceId: string;
}) {
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.ink }}>Recorded statement</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit statement for ${account.name}`} onPress={() => editingStatement?.id === statement.id ? onCancelEditStatement() : onEditStatement(statement)}>
                <Text style={{ color: P.brand, fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5 }}>Edit</Text>
              </Pressable>
            </View>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 5 }}>Statement date: {statement.statement_date} · Due: {statement.due_date}</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 2 }}>Balance: {formatPeso(statement.statement_balance_centavos)} · Minimum: {formatPeso(statement.minimum_due_centavos)}</Text>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 2 }}>Finance charges: {formatPeso(statement.finance_charge_centavos)}</Text>
            {editingStatement?.id === statement.id ? <CreditCardStatementForm userId={userId} deviceId={deviceId} cycleId={cycle.id} cycleStartDate={cycle.cycle_start_date} today={today} statement={statement} onCancel={onCancelEditStatement} onSaved={onStatementSaved} /> : null}
          </View>
        ) : null}
        {needsStatement ? (
          <View style={{ borderTopWidth: 1, borderTopColor: P.line, paddingTop: 12 }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Have you received the statement for this billing cycle?</Text>
            <Pressable accessibilityRole="button" onPress={() => onAddStatement(cycle)} style={{ marginTop: 7 }}><Text style={{ color: P.brand, fontWeight: "700", fontFamily: "Manrope", fontSize: 12 }}>Add statement</Text></Pressable>
            {statementCycle?.id === cycle.id ? <CreditCardStatementForm userId={userId} deviceId={deviceId} cycleId={cycle.id} cycleStartDate={cycle.cycle_start_date} today={today} onCancel={onCancelStatement} onSaved={onStatementSaved} /> : null}
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

export default function CreditCardCollections({ userId, deviceId, accounts, cycles, transactions, statements, statementCycle, editingStatement, onManageCycle, onAddStatement, onCancelStatement, onEditStatement, onCancelEditStatement, onStatementSaved, today = localToday() }: Props) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  return (
    <View>
      <CreditCardInventory accounts={accounts} cycles={cycles} onManageCycle={onManageCycle} today={today} />
      <View style={{ height: 1, backgroundColor: P.line, marginVertical: 18 }} />
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Billing Cycles</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted }}>{cycles.length} recorded</Text>
      </View>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginBottom: 12 }}>Statements and purchases stay with the cycle they belong to.</Text>
      {cycles.map((cycle) => {
        const account = accountsById.get(cycle.account_id);
        if (!account) return null;
        return <BillingCycleCard key={cycle.id} account={account} accountCycleCount={cycles.filter((item) => item.account_id === account.id).length} cycle={cycle} transactions={transactions.filter((transaction) => transaction.cycle_id === cycle.id)} statement={statements.find((item) => item.cycle_id === cycle.id)} statementCycle={statementCycle} editingStatement={editingStatement} onManageCycle={onManageCycle} onAddStatement={onAddStatement} onCancelStatement={onCancelStatement} onEditStatement={onEditStatement} onCancelEditStatement={onCancelEditStatement} onStatementSaved={onStatementSaved} today={today} userId={userId} deviceId={deviceId} />;
      })}
    </View>
  );
}
