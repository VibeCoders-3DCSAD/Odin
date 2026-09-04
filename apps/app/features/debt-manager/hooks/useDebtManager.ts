import { useEffect, useState } from "react";
import { getCurrentBudgetDraft } from "../../../local-db/repositories/budgets";
import { createDebt, deleteDebt, getDebtOverview, getDebtStrategy, listCurrentDebtPaymentTotals, listDebtPriorities, listDebts, setDebtPriorities, updateDebt, updateDebtStatus, updateDebtStrategy, type Debt, type DebtPaymentSchedule, type DebtOverview } from "../../../local-db/repositories/debts";
import type { RecurringScheduleValue } from "../../recurring-transactions/components/RecurringScheduleFields";
import { DEBT_PRESETS, validatePresetData } from "../presets";
import { calculateDebtPlan, forecastDebtFreeDate, forecastDebtFreeMonths } from "../debtLogic";
import { today } from "../formatters";
import { getCreditCardDebtBudgetRequirement } from "../../../local-db/repositories/creditCards";

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
  const [originalBalance, setOriginalBalance] = useState(""); const [balance, setBalance] = useState("");
  const [startDate, setStartDate] = useState(""); const [fees, setFees] = useState(""); const [penalties, setPenalties] = useState("");
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
  const [presetKey, setPresetKey] = useState("personal_loan");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [creditCardTargetMinor, setCreditCardTargetMinor] = useState(0);
  const [creditCardBalanceMinor, setCreditCardBalanceMinor] = useState(0);
  const [missingCardStrategyCount, setMissingCardStrategyCount] = useState(0);
  const [strategyRequired, setStrategyRequired] = useState(false);
  const [overview, setOverview] = useState<DebtOverview>({ totalPaidMinor: 0, totalOriginalMinor: 0, totalRemainingMinor: 0, monthlyPayments: [] });

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
      const [nextDebts, nextPriorities, nextStrategy, currentBudget, nextOverview] = await Promise.all([
        listDebts(userId), listDebtPriorities(userId), getDebtStrategy(userId), getCurrentBudgetDraft(userId, asOfDate), getDebtOverview(userId),
      ]);
      setDebts(nextDebts);
      setPriorities(nextPriorities);
      setStrategy(nextStrategy);
      setDebtBudgetMinor(currentBudget?.debtBudgetMinor ?? 0);
      setHasCurrentBudget(Boolean(currentBudget));
      setOverview(nextOverview);
        const cardTarget = currentBudget ? await getCreditCardDebtBudgetRequirement(userId, currentBudget.periodStart, currentBudget.periodEnd) : { requiredMinor: 0, statementBalanceMinor: 0, missingStrategyCount: 0, strategyRequired: false };
        setCreditCardTargetMinor(cardTarget.requiredMinor);
        setCreditCardBalanceMinor(cardTarget.statementBalanceMinor);
       setMissingCardStrategyCount(cardTarget.missingStrategyCount);
       setStrategyRequired(cardTarget.strategyRequired);
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
    setOriginalBalance(""); setBalance(""); setStartDate(""); setFees(""); setPenalties("");
    setInterestRate("");
    setMinimum("");
     setPaymentFrequency("monthly"); setPaymentSchedule({ frequency: "monthly", intervalCount: "1", dayOfMonth: "", secondDayOfMonth: "", dayOfWeek: null, secondDayOfWeek: null, monthOfYear: null, estimatedIntervalDays: "", timeOfDay: "" }); setNextDueDate(""); setMaturityDate(""); setTargetPayoffDate(""); setInterestPeriod(""); setInterestMethod(""); setNotes(""); setPresetData({});
     setPresetKey("personal_loan");
    setShowCreate(true);
  }

  function edit(debt: Debt) {
    setFormError(null);
    setEditingId(debt.id);
    setName(debt.name);
    setLenderName(debt.lenderName ?? "");
    setOriginalBalance(String(debt.originalBalanceMinor / 100)); setBalance(String(debt.currentBalanceMinor / 100)); setStartDate(typeof debt.presetData.startDate === "string" ? debt.presetData.startDate : ""); setFees(String(Number(debt.presetData.feesCentavos ?? 0) / 100)); setPenalties(String(Number(debt.presetData.penaltiesCentavos ?? 0) / 100));
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
    const validFrequencies = ["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"];
    const validInterestPeriods = ["", "daily", "monthly", "annual"];
    const validInterestMethods = ["", "flat_add_on", "diminishing_balance", "provider_calculated", "no_interest"];
    const validDate = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
    const numericFields = [["balance", balance], ["minimum payment", minimum], ["interest rate", interestRate]] as const;
    const invalidNumeric = numericFields.find(([, value]) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0));
     if (!presetKey) { setFormError("Select debt type."); return false; }
      if (!name.trim()) { setFormError("Debt name is required."); return false; }
      if (presetKey !== "custom_debt" && !lenderName.trim()) { setFormError("Lender or provider is required."); return false; }
      try { validatePresetData(presetKey, presetData); } catch (e) { setFormError(e instanceof Error ? e.message : "Debt type details are invalid."); return false; }
      const autoPrincipal = presetKey === "auto_loan" ? (Number(presetData.vehiclePurchasePriceCentavos) - Number(presetData.downpaymentCentavos)) / 100 : null;
      const originalAmount = autoPrincipal ?? Number(originalBalance);
      if (!Number.isFinite(originalAmount) || originalAmount <= 0) { setFormError("Original amount must be positive."); return false; }
      if (Number(balance) > originalAmount) { setFormError("Current balance cannot exceed the original amount."); return false; }
     if (!balance || !Number.isFinite(Number(balance)) || Number(balance) < 0) { setFormError("Current balance must be non-negative."); return false; }
    if (invalidNumeric) { setFormError(`${invalidNumeric[0]} must be a non-negative number.`); return false; }
     if (!validFrequencies.includes(paymentFrequency)) { setFormError("Payment frequency must be a supported value."); return false; }
     if (paymentFrequency === "custom" && (!/^\d+$/.test(paymentSchedule.estimatedIntervalDays) || Number(paymentSchedule.estimatedIntervalDays) < 1)) { setFormError("Custom payment frequency requires a positive interval in days."); return false; }
    if (!validInterestPeriods.includes(interestPeriod)) { setFormError("Rate period must be daily, monthly, or annual."); return false; }
     if (interestRate !== "" && !interestPeriod) { setFormError("Select a rate period when entering an interest rate."); return false; }
     if (!validInterestMethods.includes(interestMethod)) { setFormError("Select a supported interest method."); return false; }
     if (Number(interestRate || 0) > 0 && !interestMethod) { setFormError("Select an interest method when entering an interest rate."); return false; }
     const dateFields: Array<[string, string]> = [["Start date", startDate], ["Next due date", nextDueDate], ["Maturity date", maturityDate], ["Target payoff date", targetPayoffDate]];
     const invalidDate = dateFields.find(([, value]) => !validDate(value));
     if (invalidDate) { setFormError(`${invalidDate[0]} must use a valid YYYY-MM-DD date.`); return false; }
     if (["personal_loan", "salary_loan", "multipurpose_loan", "business_loan", "auto_loan"].includes(presetKey) && (!startDate || !nextDueDate)) { setFormError("Start date and next payment date are required."); return false; }
    try {
      const current = editingId ? debts.find((debt) => debt.id === editingId) : null;
      const input = {
         name, lenderName: lenderName || null, presetKey,
         originalBalanceMinor: Math.round(originalAmount * 100),
          currentBalanceMinor: Math.round(Number(balance) * 100), annualInterestRateBps: annualizeRateBps(Number(interestRate || 0), interestPeriod),
         minimumPaymentMinor: Math.round(Number(minimum || 0) * 100), paymentFrequency,
         nextDueDate: nextDueDate || null, maturityDate: maturityDate || null,
         targetPayoffDate: targetPayoffDate || null, interestPeriod: interestPeriod || null,
           interestMethod: interestMethod || null, presetData: { ...presetData, startDate: startDate || undefined, feesCentavos: Math.round(Number(fees || 0) * 100), penaltiesCentavos: Math.round(Number(penalties || 0) * 100) }, paymentSchedule: paymentSchedule as DebtPaymentSchedule, notes: notes || null,
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
      debtBudgetMinor: Math.max(0, debtBudgetMinor - creditCardTargetMinor), strategy, priorities, asOfDate, strategyRequired,
  });

  const nonCreditForecastMonths = forecastDebtFreeMonths(plan.allocations, Math.max(0, debtBudgetMinor - creditCardTargetMinor), strategy, priorities, asOfDate);
  const creditCardForecastMonths = creditCardBalanceMinor > 0 && creditCardTargetMinor > 0 ? Math.ceil(creditCardBalanceMinor / creditCardTargetMinor) : creditCardBalanceMinor > 0 ? null : 0;
  const forecastMonths = nonCreditForecastMonths === null || creditCardForecastMonths === null ? null : Math.max(nonCreditForecastMonths, creditCardForecastMonths);
  const nonCreditForecastDate = forecastDebtFreeDate(plan.allocations, Math.max(0, debtBudgetMinor - creditCardTargetMinor), strategy, priorities, asOfDate);
  const forecastDate = forecastMonths === null ? null : creditCardForecastMonths != null && creditCardForecastMonths >= nonCreditForecastMonths! ? (() => { const date = new Date(`${asOfDate}T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + creditCardForecastMonths); return date.toISOString().slice(0, 10); })() : nonCreditForecastDate;

  return {
      debts, priorities, strategy, debtBudgetMinor, creditCardTargetMinor, missingCardStrategyCount, hasCurrentBudget, overview, plan,
        forecastMonths, forecastDate,
      strategyRequired,
      loading, error, formError, name, lenderName, originalBalance, balance, startDate, fees, penalties, interestRate, minimum, paymentFrequency, paymentSchedule, nextDueDate, maturityDate, targetPayoffDate, interestPeriod, interestMethod, notes, presetKey, presetData, editingId, showCreate, confirmDeleteId, pendingIds,
      setName, setLenderName, setOriginalBalance, setBalance, setStartDate, setFees, setPenalties, setInterestRate, setMinimum, setPaymentFrequency, setPaymentSchedule, setNextDueDate, setMaturityDate, setTargetPayoffDate, setInterestPeriod, setInterestMethod, setNotes, setPresetKey, setPresetData, setConfirmDeleteId,
     openCreate, edit, cancelForm, save, confirmDelete, movePriority, removePriority, changeStrategy, changeStatus, load,
  };
}
