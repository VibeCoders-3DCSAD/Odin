import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { ensureCurrentCreditCardCycles, createCreditCardCycle, listCreditCardCycles, listCreditCardCycleTransactions, updateCreditCardCycle, type CreditCardCycle, type CreditCardCycleTransaction } from "../../local-db/repositories/creditCardCycles";
import { calculateCurrentCreditCardCycle } from "../../local-db/repositories/creditCardCycleDates";
import {
  listFinancialAccounts,
  type FinancialAccount,
} from "../../local-db/repositories/financialFoundations";
import { LocalDbError } from "../../local-db/helpers";
import { listCreditCardStatements, type CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import { listCreditCardInstallments, type CreditCardInstallment } from "../../local-db/repositories/creditCardInstallments";
import CreditCardCollections from "./CreditCardCollections";

const P = {
  shell: "#fcf8f0",
  brand: "#013220",
  ink: "#1B1C1A",
  muted: "#6B7A6F",
  line: "#EAEAE6",
  card: "#F1F0EB",
  error: "#D9001F",
} as const;

type Props = { userId: string; deviceId: string; onBack?: () => void };

export default function DebtManagerScreen({ userId, deviceId, onBack }: Props) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [cycles, setCycles] = useState<CreditCardCycle[]>([]);
  const [cycleTransactions, setCycleTransactions] = useState<CreditCardCycleTransaction[]>([]);
  const [statements, setStatements] = useState<CreditCardStatement[]>([]);
  const [installments, setInstallments] = useState<CreditCardInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [editingCycle, setEditingCycle] = useState<{ account: FinancialAccount; cycle: CreditCardCycle | null } | null>(null);
  const [cycleStart, setCycleStart] = useState("");
  const [cycleCutoff, setCycleCutoff] = useState("");
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [cycleSaving, setCycleSaving] = useState(false);
  const [cycleNotice, setCycleNotice] = useState<string | null>(null);
  const [statementCycle, setStatementCycle] = useState<CreditCardCycle | null>(null);
  const hasLoadedData = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const nextAccounts = (await listFinancialAccounts(userId)).filter((account) => account.kind === "credit_card" && account.status === "active");
      setAccounts(nextAccounts);
      hasLoadedData.current = nextAccounts.length > 0;

      let cycleLoadFailed = false;
      try {
        await ensureCurrentCreditCardCycles(userId, deviceId);
      } catch (cycleError) {
        cycleLoadFailed = true;
        console.error("[debt-manager] billing cycle load failed", {
          userId,
          error: cycleError instanceof Error ? cycleError.message : "unknown error",
        });
      }
       const nextCycles = await listCreditCardCycles(userId);
       setCycles(nextCycles);
       setCycleTransactions(await listCreditCardCycleTransactions(userId));
       setStatements(await listCreditCardStatements(userId));
       setInstallments(await listCreditCardInstallments(userId));
      setError(cycleLoadFailed);
      setStale(cycleLoadFailed && hasLoadedData.current);
    } catch (loadError) {
      console.error("[debt-manager] account load failed", {
        userId,
        reason: loadError instanceof Error ? loadError.message : "unknown error",
      });
      setError(true);
      setStale(hasLoadedData.current);
    } finally {
      setLoading(false);
    }
  }, [deviceId, userId]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  function openCycleEditor(account: FinancialAccount, cycle: CreditCardCycle | null) {
    const defaults = cycle ?? (account.creditCardDetails ? calculateCurrentCreditCardCycle({ account_id: account.id, cutoff_day: account.creditCardDetails.cutoffDay }) : null);
    setEditingCycle({ account, cycle });
    setCycleStart(defaults?.cycle_start_date ?? "");
    setCycleCutoff(defaults?.cutoff_date ?? "");
    setCycleError(null);
    setCycleNotice(null);
  }

  async function saveCycle() {
    if (!editingCycle || !/^\d{4}-\d{2}-\d{2}$/.test(cycleStart) || !/^\d{4}-\d{2}-\d{2}$/.test(cycleCutoff) || cycleStart > cycleCutoff) {
      setCycleError("Some credit-card details are not valid. Check the highlighted fields and try again.");
      return;
    }
    setCycleSaving(true);
    setCycleNotice("Your credit-card changes are being saved. Please wait before trying again.");
    try {
      if (editingCycle.cycle) await updateCreditCardCycle(userId, deviceId, editingCycle.cycle.id, { cycle_start_date: cycleStart, cutoff_date: cycleCutoff });
      else await createCreditCardCycle(userId, deviceId, { account_id: editingCycle.account.id, cycle_start_date: cycleStart, cutoff_date: cycleCutoff });
      setEditingCycle(null);
      await load();
      setCycleNotice("Your credit-card changes were saved. Review the billing-cycle details before continuing.");
    } catch (error) {
      setCycleError(
        error instanceof LocalDbError
          ? error.message
          : "Your credit-card changes could not be completed. Review the details and try again.",
      );
    } finally { setCycleSaving(false); }
  }

  if (loading && accounts.length === 0) {
    return <View><Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.muted }}>{"Your credit-card information is loading. Wait a moment for the details to appear."}</Text><ActivityIndicator color={P.brand} style={{ marginTop: 14 }} /></View>;
  }

  if (accounts.length === 0 && !error) {
    return <View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink }}>Debt Manager</Text><Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.muted, marginTop: 10 }}>No credit cards are recorded yet. Add a credit card to track billing cycles and payments.</Text></View>;
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: P.ink }}>Credit Cards</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Billing cycles and statement activity</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 14 }}>
          {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back to Debt Manager" onPress={onBack}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.muted }}>Back</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh credit-card information" onPress={() => load().catch(() => {})}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.brand }}>Refresh</Text></Pressable>
        </View>
      </View>
      {stale ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, backgroundColor: P.card, padding: 10, borderRadius: 10, marginBottom: 12 }}>Credit-card information may be out of date. Refresh or reconcile it with the latest issuer records.</Text> : null}
      {error && !stale ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.error, marginBottom: 12 }}>Your credit-card information could not be loaded or saved. Check your connection and try again.</Text> : null}
      {cycleNotice ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginBottom: 12 }}>{cycleNotice}</Text> : null}
      {editingCycle ? (
        <View style={{ borderWidth: 1, borderColor: P.line, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: P.card }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: P.ink, marginBottom: 10 }}>{editingCycle.cycle ? "Override billing cycle" : "Add billing cycle"}</Text>
          <TextInput accessibilityLabel="Billing-cycle start date" value={cycleStart} onChangeText={setCycleStart} placeholder="Select billing-cycle start date" placeholderTextColor={P.muted} style={{ backgroundColor: P.shell, padding: 10, borderRadius: 8, marginBottom: 8 }} />
          <TextInput accessibilityLabel="Cut-off date" value={cycleCutoff} onChangeText={setCycleCutoff} placeholder="Select cut-off date" placeholderTextColor={P.muted} style={{ backgroundColor: P.shell, padding: 10, borderRadius: 8 }} />
          {cycleError ? <Text style={{ color: P.error, fontFamily: "Manrope", fontSize: 12, marginTop: 7 }}>{cycleError}</Text> : null}
          <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}><Pressable onPress={() => setEditingCycle(null)}><Text style={{ color: P.muted, fontWeight: "700" }}>Cancel</Text></Pressable><Pressable disabled={cycleSaving} onPress={() => saveCycle().catch(() => {})}><Text style={{ color: P.brand, fontWeight: "700" }}>{cycleSaving ? "Saving..." : "Save cycle"}</Text></Pressable></View>
        </View>
      ) : null}
      <CreditCardCollections
        userId={userId}
        deviceId={deviceId}
        accounts={accounts}
        cycles={cycles}
        transactions={cycleTransactions}
        statements={statements}
        installments={installments}
        statementCycle={statementCycle}
        onManageCycle={openCycleEditor}
        onAddStatement={setStatementCycle}
        onCancelStatement={() => setStatementCycle(null)}
        onStatementSaved={load}
      />
    </View>
  );
}
