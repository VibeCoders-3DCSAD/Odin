import { useEffect, useState } from "react";
import { getCurrentBudgetDraft } from "../../../local-db/repositories/budgets";
import { createDebt, deleteDebt, getDebtStrategy, listCurrentDebtPaymentTotals, listDebtPriorities, listDebts, setDebtPriorities, updateDebt, updateDebtStatus, updateDebtStrategy, type Debt, type DebtPaymentSchedule } from "../../../local-db/repositories/debts";
import type { RecurringScheduleValue } from "../../recurring-transactions/components/RecurringScheduleFields";
import { DEBT_PRESETS } from "../presets";
import { calculateDebtPlan, forecastDebtFreeMonths } from "../debtLogic";
import { today } from "../formatters";

function annualizeRateBps(rate: number, period: string): number {
  const multiplier = period === "daily" ? 365 : period === "monthly" ? 12 : 1;
  return Math.round(rate * multiplier * 100);
}

function displayRate(annualRateBps: number, period: string): string {
  const divisor = period === "daily" ? 365 : period === "monthly" ? 12 : 1;
  return String(annualRateBps / 100 / divisor);
}

type Props = { userId: string; deviceId: string; onSyncRequested?: () => Promise<void> };
type Strategy = "snowball" | "avalanche";

export function useDebtManager({ userId, deviceId, onSyncRequested }: Props) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [paidByDebt, setPaidByDebt] = useState<Record<string, number>>({});
  const [debtBudgetMinor, setDebtBudgetMinor] = useState(0);
  const [hasCurrentBudget, setHasCurrentBudget] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [name, setName] = useState("");
  const [lenderName, setLenderName] = useState("");
  const [balance, setBalance] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [minimum, setMinimum] = useState("");
  const [paymentFrequency, setPaymentFrequency] = useState("monthly");
  const [paymentSchedule, setPaymentSchedule] = useState<RecurringScheduleValue>({ frequency: "monthly", intervalCount: "1", dayOfMonth: "", secondDayOfMonth: "", dayOfWeek: null, secondDayOfWeek: null, monthOfYear: null, estimatedIntervalDays: "", timeOfDay: "" });
  const [nextDueDate, setNextDueDate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [targetPayoffDate, setTargetPayoffDate] = useState("");
  const [interestPeriod, setInterestPeriod] = useState("");
  const [interestMethod, setInterestMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [presetData, setPresetData] = useState<Record<string, unknown>>({});
  const [presetKey, setPresetKey] = useState(DEBT_PRESETS[0]!.key);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function withPending(id: string, action: () => Promise<void>) {
    setPendingIds((current) => new Set(current).add(id));
    try { await action(); } finally {
      setPendingIds((current) => { const next = new Set(current); next.delete(id); return next; });
    }
  }

  async function load() {
    setLoading(true);
    try {
      const asOfDate = today();
      const [nextDebts, nextPriorities, nextStrategy, currentBudget] = await Promise.all([
        listDebts(userId), listDebtPriorities(userId), getDebtStrategy(userId), getCurrentBudgetDraft(userId, asOfDate),
      ]);
      setDebts(nextDebts);
      setPriorities(nextPriorities);
      setStrategy(nextStrategy);
      setDebtBudgetMinor(currentBudget?.debtBudgetMinor ?? 0);
      setHasCurrentBudget(Boolean(currentBudget));
      setPaidByDebt(await listCurrentDebtPaymentTotals(userId, asOfDate.slice(0, 7)));
    } catch {
      setError("Debt data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [userId]);

  function openCreate() {
    setFormError(null);
    setEditingId(null);
    setName("");
    setLenderName("");
    setBalance("");
    setInterestRate("");
    setMinimum("");
     setPaymentFrequency("monthly"); setPaymentSchedule({ frequency: "monthly", intervalCount: "1", dayOfMonth: "", secondDayOfMonth: "", dayOfWeek: null, secondDayOfWeek: null, monthOfYear: null, estimatedIntervalDays: "", timeOfDay: "" }); setNextDueDate(""); setMaturityDate(""); setTargetPayoffDate(""); setInterestPeriod(""); setInterestMethod(""); setNotes(""); setPresetData({});
    setPresetKey(DEBT_PRESETS[0]!.key);
    setShowCreate(true);
  }

  function edit(debt: Debt) {
    setFormError(null);
    setEditingId(debt.id);
    setName(debt.name);
    setLenderName(debt.lenderName ?? "");
    setBalance(String(debt.currentBalanceMinor / 100));
    setInterestRate(displayRate(debt.annualInterestRateBps, debt.interestPeriod ?? "annual"));
    setMinimum(String(debt.minimumPaymentMinor / 100));
    setPaymentFrequency(debt.paymentFrequency); setPaymentSchedule({ ...debt.paymentSchedule, frequency: debt.paymentFrequency as RecurringScheduleValue["frequency"], estimatedIntervalDays: "" }); setNextDueDate(debt.nextDueDate ?? ""); setMaturityDate(debt.maturityDate ?? ""); setTargetPayoffDate(debt.targetPayoffDate ?? ""); setInterestPeriod(debt.interestPeriod ?? (debt.annualInterestRateBps > 0 ? "annual" : "")); setInterestMethod(debt.interestMethod ?? ""); setNotes(debt.notes ?? ""); setPresetData(debt.presetData);
    setPresetKey(debt.presetKey);
    setShowCreate(true);
  }

  function cancelForm() {
    setEditingId(null);
    setShowCreate(false);
  }

  async function save(): Promise<boolean> {
    const pendingId = editingId ?? "new";
    if (pendingIds.has(pendingId)) return false;
    setError(null);
    setFormError(null);
    const validFrequencies = ["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly"];
    const validInterestPeriods = ["", "daily", "monthly", "annual"];
    const validInterestMethods = ["", "simple", "amortized", "compound"];
    const validDate = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
    const numericFields = [["balance", balance], ["minimum payment", minimum], ["interest rate", interestRate]] as const;
    const invalidNumeric = numericFields.find(([, value]) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0));
    if (!name.trim()) { setFormError("Debt name is required."); return false; }
    if (invalidNumeric) { setFormError(`${invalidNumeric[0]} must be a non-negative number.`); return false; }
    if (!validFrequencies.includes(paymentFrequency)) { setFormError("Payment frequency must be a supported value."); return false; }
    if (!validInterestPeriods.includes(interestPeriod)) { setFormError("Rate period must be daily, monthly, or annual."); return false; }
    if (interestRate !== "" && !interestPeriod) { setFormError("Select a rate period when entering an interest rate."); return false; }
    if (!validInterestMethods.includes(interestMethod)) { setFormError("Interest method must be simple, amortized, or compound."); return false; }
    const dateFields: Array<[string, string]> = [["Next due date", nextDueDate], ["Maturity date", maturityDate], ["Target payoff date", targetPayoffDate]];
    const invalidDate = dateFields.find(([, value]) => !validDate(value));
    if (invalidDate) { setFormError(`${invalidDate[0]} must use a valid YYYY-MM-DD date.`); return false; }
    try {
      const current = editingId ? debts.find((debt) => debt.id === editingId) : null;
      const input = {
         name, lenderName: lenderName || null, presetKey,
         originalBalanceMinor: current?.originalBalanceMinor ?? Math.round(Number(balance) * 100),
          currentBalanceMinor: Math.round(Number(balance) * 100), annualInterestRateBps: annualizeRateBps(Number(interestRate || 0), interestPeriod),
         minimumPaymentMinor: Math.round(Number(minimum || 0) * 100), paymentFrequency,
         nextDueDate: nextDueDate || null, maturityDate: maturityDate || null,
         targetPayoffDate: targetPayoffDate || null, interestPeriod: interestPeriod || null,
          interestMethod: interestMethod || null, presetData, paymentSchedule: paymentSchedule as DebtPaymentSchedule, notes: notes || null,
      };
       if (editingId) await withPending(pendingId, async () => updateDebt(userId, deviceId, editingId, input).then(() => undefined));
        else await withPending(pendingId, async () => createDebt(userId, deviceId, input).then(() => undefined));
      cancelForm();
      await load();
      await onSyncRequested?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debt could not be saved.");
      return false;
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    try {
      await withPending(confirmDeleteId, async () => deleteDebt(userId, deviceId, confirmDeleteId, true).then(() => undefined));
      setConfirmDeleteId(null);
      await load();
      await onSyncRequested?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debt could not be deleted.");
    }
  }

  async function movePriority(id: string, direction: -1 | 1) {
    try {
      const index = priorities.indexOf(id);
      if (index < 0) {
        if (direction !== -1) return;
        const activeIds = new Set(debts.filter((debt) => debt.status === "active").map((debt) => debt.id));
        const ordered = [...new Set([...priorities.filter((priorityId) => activeIds.has(priorityId)), id])];
        await withPending(id, () => setDebtPriorities(userId, deviceId, ordered));
        setPriorities(ordered);
        await onSyncRequested?.();
        return;
      }
      const next = index + direction;
      if (next < 0 || next >= priorities.length) return;
      const ordered = [...priorities];
      [ordered[index], ordered[next]] = [ordered[next]!, ordered[index]!];
      await withPending(id, () => setDebtPriorities(userId, deviceId, ordered));
      setPriorities(ordered);
      await onSyncRequested?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debt priorities could not be saved.");
    }
  }

  async function removePriority(id: string) {
    try {
      const next = priorities.filter((priorityId) => priorityId !== id);
      await withPending(id, () => setDebtPriorities(userId, deviceId, next));
      setPriorities(next);
      await onSyncRequested?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debt priorities could not be saved.");
    }
  }

  async function changeStrategy(value: Strategy) {
    const previous = strategy;
    setStrategy(value);
    try {
      await updateDebtStrategy(userId, deviceId, value);
    } catch (e) {
      setStrategy(previous);
      setError(e instanceof Error ? e.message : "Debt strategy could not be saved.");
      return;
    }
    try {
      await onSyncRequested?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debt strategy could not be synced.");
    }
  }

  async function changeStatus(id: string, status: "active" | "archived" | "paid_off") {
    try {
      await withPending(id, () => updateDebtStatus(userId, deviceId, id, status));
      await load();
      await onSyncRequested?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debt status could not be saved.");
    }
  }

  const asOfDate = today();
  const plan = calculateDebtPlan({
     debts: debts.filter((debt) => debt.status === "active").map((debt) => ({ id: debt.id, balanceMinor: debt.currentBalanceMinor, minimumPaymentMinor: debt.minimumPaymentMinor, annualInterestRateBps: debt.annualInterestRateBps, paymentFrequency: debt.paymentFrequency, paymentSchedule: debt.paymentSchedule, nextDueDate: debt.nextDueDate, lastPaymentDate: debt.lastPaymentDate, targetPayoffDate: debt.targetPayoffDate, paidPaymentMinor: paidByDebt[debt.id] ?? 0 })),
    debtBudgetMinor, strategy, priorities, asOfDate,
  });

  return {
    debts, priorities, strategy, debtBudgetMinor, hasCurrentBudget, plan,
    forecastMonths: forecastDebtFreeMonths(plan.allocations, debtBudgetMinor, strategy, priorities, asOfDate),
     loading, error, formError, name, lenderName, balance, interestRate, minimum, paymentFrequency, paymentSchedule, nextDueDate, maturityDate, targetPayoffDate, interestPeriod, interestMethod, notes, presetKey, presetData, editingId, showCreate, confirmDeleteId, pendingIds,
     setName, setLenderName, setBalance, setInterestRate, setMinimum, setPaymentFrequency, setPaymentSchedule, setNextDueDate, setMaturityDate, setTargetPayoffDate, setInterestPeriod, setInterestMethod, setNotes, setPresetKey, setPresetData, setConfirmDeleteId,
     openCreate, edit, cancelForm, save, confirmDelete, movePriority, removePriority, changeStrategy, changeStatus, load,
  };
}
