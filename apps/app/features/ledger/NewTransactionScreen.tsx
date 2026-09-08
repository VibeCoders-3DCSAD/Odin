import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarBlank, CaretLeft, CaretRight, Repeat, Wallet, X } from "phosphor-react-native";
import { CategorySelectorTree, type CategorySelection } from "../../components/CategorySelector";
import TransactionTypeSelector, { TransactionType } from "./components/TransactionTypeSelector";
import { useTransactionData } from "./hooks/useTransactionData";
import { createExpense, createIncome, createTransfer, updateTransaction, type Transaction, type UpdateTransactionInput } from "../../local-db/repositories/ledger";
import { createStatementPayment, getCreditCardPaymentByStatement, updateStatementPayment, type CreditCardPayment, type StatementPaymentContext } from "../../local-db/repositories/creditCardPayments";
import { getCreditCardStatementByCycle, type CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import { listDebtAccounts, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import { createTransactionDebtPayment, updateTransactionDebtPayment, type DebtPaymentContext } from "../../local-db/repositories/debtPayments";
import { getCreditCardPurchaseMetadataForTransaction, type CreateCreditCardInstallmentInput } from "../../local-db/repositories/creditCardInstallments";
import { createRecurringTemplate } from "../../local-db/repositories/recurringTransactions";
import { runSync } from "../../local-db/sync/runSync";
import { useToast } from "../../components/Toast";
import { useConnectivityStore } from "../../services/connectivity";
import type { Subcategory } from "../../local-db/repositories/taxonomy";
import RecurringScheduleFields, { type RecurringScheduleValue } from "../recurring-transactions/components/RecurringScheduleFields";
import CreditCardInstallmentFields, { type InstallmentFieldErrors, type InstallmentFormValue } from "./components/CreditCardInstallmentFields";

const palette = {
  shell: "#fcf8f0",
  brand: "#013220",
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  card: "#F1F0EB",
  softCard: "#f7eed9",
  successTint: "#20c277",
  successCard: "#effff6",
} as const;

const QUICK_AMOUNTS = [100, 250, 500, 1000];

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onClose: () => void;
  transaction?: Transaction;
  statementPaymentContext?: StatementPaymentContext;
  debtPaymentDebtId?: string;
  debtPaymentContext?: DebtPaymentContext;
};

export default function NewTransactionScreen({ userId, deviceId, accessToken, onClose, transaction, statementPaymentContext, debtPaymentDebtId, debtPaymentContext }: Props) {
  const { showToast } = useToast();
  const online = useConnectivityStore((s) => s.online);
  const isEdit = !!transaction;

  const [txType, setTxType] = useState<TransactionType>(statementPaymentContext ? "expense" : (transaction?.transaction_type as TransactionType) ?? "expense");
  const [statementPayment, setStatementPayment] = useState<CreditCardStatement | null>(null);
  const [existingStatementPayment, setExistingStatementPayment] = useState<CreditCardPayment | null>(null);
  const [isDebtPayment, setIsDebtPayment] = useState(Boolean(debtPaymentDebtId || debtPaymentContext));
  const [debtPaymentId, setDebtPaymentId] = useState(debtPaymentDebtId ?? debtPaymentContext?.debtAccountId ?? "");
  const [activeDebts, setActiveDebts] = useState<DebtAccount[]>([]);
  const isStatementPayment = Boolean(statementPaymentContext);

  useEffect(() => {
    if (!isEdit) setCategorySelection({ tier: null, groupId: null, categoryId: null, subcategoryId: null });
  }, [txType]);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount_centavos / 100) : "");
  const [date, setDate] = useState(transaction ? new Date(transaction.transaction_date + "T00:00:00") : new Date());
  const [postingDate, setPostingDate] = useState(transaction?.credit_card_posting_date ?? "");
  const [creditCardPurchaseType, setCreditCardPurchaseType] = useState<"regular" | "installment">("regular");
  const [editInstallmentLocked, setEditInstallmentLocked] = useState(false);
  const [installment, setInstallment] = useState<InstallmentFormValue>({
    originalPrincipal: "", termMonths: "", remainingPrincipal: "", remainingMonths: "", monthlyAmortization: "",
    interestType: "zero_interest", interestRatePercent: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPostingDatePicker, setShowPostingDatePicker] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState(transaction?.source_account_id ?? "");
  const [destAccountId, setDestAccountId] = useState(transaction?.destination_account_id ?? "");
  const [categorySelection, setCategorySelection] = useState<CategorySelection>({
    tier: transaction?.subcategory_id ? "subcategory" : null,
    groupId: null,
    categoryId: null,
    subcategoryId: transaction?.subcategory_id ?? null,
  });
  const [description, setDescription] = useState(transaction?.merchant_name ?? transaction?.counterparty_name ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [installmentErrors, setInstallmentErrors] = useState<InstallmentFieldErrors>({});
  const [accountPickerMode, setAccountPickerMode] = useState<"source" | "dest" | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringSchedule, setRecurringSchedule] = useState<RecurringScheduleValue>({
    frequency: "monthly",
    intervalCount: "1",
    dayOfMonth: "",
    secondDayOfMonth: "",
    dayOfWeek: null,
    secondDayOfWeek: null,
    monthOfYear: null,
    estimatedIntervalDays: "",
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<{
    accountName: string;
    deficitCentavos: number;
    isCreditCard: boolean;
  } | null>(null);

  const { accounts, groups, categories, subcategories, loading, error: dataError } = useTransactionData(userId, txType);

  useEffect(() => { listDebtAccounts(userId).then(setActiveDebts).catch(() => setActiveDebts([])); }, [userId]);

  useEffect(() => {
    if (!debtPaymentDebtId) return;
    setIsDebtPayment(true);
    setDebtPaymentId(debtPaymentDebtId);
    const debt = activeDebts.find((item) => item.id === debtPaymentDebtId);
    if (debt) setDescription(`Payment to ${debt.name}`);
  }, [activeDebts, debtPaymentDebtId]);

  useEffect(() => {
    if (!statementPaymentContext) return;
    let active = true;
    getCreditCardStatementByCycle(userId, statementPaymentContext.cycleId)
      .then((statement) => {
        if (!active) return;
        if (!statement || statement.id !== statementPaymentContext.statementId || !statement.authoritative) {
          setFormError("The selected credit-card statement is no longer available.");
          return;
        }
        setStatementPayment(statement);
        return getCreditCardPaymentByStatement(userId, statement.id).then((payment) => { if (active) setExistingStatementPayment(payment); });
      })
      .catch(() => { if (active) setFormError("The selected credit-card statement is no longer available."); });
    return () => { active = false; };
  }, [statementPaymentContext, userId]);

  useEffect(() => {
    if (!isEdit) {
      setCategorySelection({ tier: null, groupId: null, categoryId: null, subcategoryId: null });
    }
  }, [txType, isEdit]);

  useEffect(() => {
    if (txType === "transfer") return;

    const currentSubcategory = categorySelection.subcategoryId
      ? subcategories.find((item) => item.id === categorySelection.subcategoryId) ?? null
      : null;
    const currentCategory = categorySelection.categoryId
      ? categories.find((item) => item.id === categorySelection.categoryId) ?? null
      : currentSubcategory?.category_id ? categories.find((item) => item.id === currentSubcategory.category_id) ?? null : null;
    const currentGroup = categorySelection.groupId
      ? groups.find((item) => item.id === categorySelection.groupId) ?? null
      : currentCategory ? groups.find((item) => item.id === currentCategory.category_group_id) ?? null : null;

    if (currentCategory || currentGroup || currentSubcategory) {
      if (currentGroup?.id !== categorySelection.groupId || currentCategory?.id !== categorySelection.categoryId) {
        setCategorySelection((current) => ({
          ...current,
          groupId: currentGroup?.id ?? current.groupId,
          categoryId: currentCategory?.id ?? current.categoryId,
        }));
      }
      return;
    }

    if (!isEdit && subcategories.length > 0) {
      const fallback = subcategories[0]!;
      const fallbackCategory = fallback.category_id ? categories.find((item) => item.id === fallback.category_id) ?? null : null;
      const fallbackGroup = fallbackCategory ? groups.find((item) => item.id === fallbackCategory.category_group_id) ?? null : null;
      setCategorySelection({
        tier: "subcategory",
        groupId: fallbackGroup?.id ?? null,
        categoryId: fallbackCategory?.id ?? null,
        subcategoryId: fallback.id,
      });
    }
  }, [
    subcategories,
    categories,
    groups,
    txType,
    categorySelection.groupId,
    categorySelection.categoryId,
    categorySelection.subcategoryId,
    isEdit,
  ]);

  useEffect(() => {
    if (txType === "transfer") {
      setShowCategoryPicker(false);
    }
  }, [txType]);

  useEffect(() => {
    let active = true;
    if (!isEdit || transaction?.transaction_type !== "expense") return () => { active = false; };
    getCreditCardPurchaseMetadataForTransaction(userId, transaction.id)
      .then((metadata) => {
        if (!active) return;
        if (!metadata) {
          setCreditCardPurchaseType("regular");
          setEditInstallmentLocked(false);
          return;
        }
        setCreditCardPurchaseType(metadata.purchase_type);
        setEditInstallmentLocked(metadata.purchase_type === "installment");
        if (metadata.installment) {
          setInstallment({
            originalPrincipal: formatCentavosForInput(metadata.installment.original_principal_centavos),
            termMonths: String(metadata.installment.term_months),
            remainingPrincipal: formatCentavosForInput(metadata.installment.remaining_principal_centavos),
            remainingMonths: String(metadata.installment.remaining_months),
            monthlyAmortization: formatCentavosForInput(metadata.installment.monthly_amortization_centavos),
            interestType: metadata.installment.interest_type,
            interestRatePercent: metadata.installment.interest_type === "interest_bearing" ? ((metadata.installment.interest_rate_bps ?? 0) / 100).toFixed(2) : "",
          });
        }
      })
      .catch((error) => {
        console.error("[ledger] failed to load credit-card purchase metadata", {
          transactionId: transaction.id,
          error: error instanceof Error ? error.message : "unknown error",
        });
      });
    return () => { active = false; };
  }, [isEdit, transaction?.id, transaction?.transaction_type, userId]);

  useEffect(() => {
    const isCardExpense = txType === "expense" && accounts.some((account) => account.id === sourceAccountId && account.kind === "credit_card");
    if (isEdit || !isCardExpense || creditCardPurchaseType !== "installment") return;
    const nextOriginalPrincipal = amount.trim();
    setInstallment((current) => {
      const shouldDefaultRemainingPrincipal = !current.remainingPrincipal.trim() || current.remainingPrincipal === current.originalPrincipal;
      const nextRemainingPrincipal = shouldDefaultRemainingPrincipal ? nextOriginalPrincipal : current.remainingPrincipal;
      if (current.originalPrincipal === nextOriginalPrincipal && current.remainingPrincipal === nextRemainingPrincipal) return current;
      return { ...current, originalPrincipal: nextOriginalPrincipal, remainingPrincipal: nextRemainingPrincipal };
    });
  }, [accounts, amount, creditCardPurchaseType, isEdit, sourceAccountId, txType]);

  function resetForm(keepType = false) {
    setAmount("");
    setDescription("");
    setNotes("");
    setCategorySelection({ tier: null, groupId: null, categoryId: null, subcategoryId: null });
    setSourceAccountId("");
    setDestAccountId("");
    setPostingDate("");
    setCreditCardPurchaseType("regular");
    setInstallment({ originalPrincipal: "", termMonths: "", remainingPrincipal: "", remainingMonths: "", monthlyAmortization: "", interestType: "zero_interest", interestRatePercent: "" });
    setInstallmentErrors({});
    setFormError(null);
    if (!keepType) setTxType("expense");
  }

  function parseMoney(value: string): number {
    const cleaned = value.replace(/,/g, "").trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return 0;
    const parsed = parseFloat(cleaned);
    if (Number.isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }

  function parseAmount(): number {
    return parseMoney(amount);
  }

  function formatCentavosForInput(centavos: number): string {
    return (centavos / 100).toFixed(2);
  }

  function formatDate(value: Date): string {
    const today = new Date();
    if (value.toDateString() === today.toDateString()) return "Today";
    return value.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }

  function formatAccountAmount(account: (typeof accounts)[number]): string {
    const amount = account.kind === "credit_card" && account.creditCardDetails
      ? account.creditCardDetails.availableCreditCentavos ?? account.creditCardDetails.creditLimitCentavos
      : account.currentBalanceCentavos;
    return `P${(amount / 100).toLocaleString()}`;
  }

  function getSelectedSubcategory(): Subcategory | null {
    return categorySelection.subcategoryId
      ? subcategories.find((item) => item.id === categorySelection.subcategoryId) ?? null
      : null;
  }

  function getSelectedCategory() {
    if (categorySelection.categoryId) {
      return categories.find((item) => item.id === categorySelection.categoryId) ?? null;
    }
    const selectedSubcategory = getSelectedSubcategory();
    if (!selectedSubcategory?.category_id) return null;
    return categories.find((item) => item.id === selectedSubcategory.category_id) ?? null;
  }

  function getSelectedGroup() {
    if (categorySelection.groupId) {
      return groups.find((item) => item.id === categorySelection.groupId) ?? null;
    }
    const selectedCategory = getSelectedCategory();
    if (!selectedCategory) return null;
    return groups.find((item) => item.id === selectedCategory.category_group_id) ?? null;
  }

  function resolveEffectiveSubcategoryId(): string {
    if (categorySelection.subcategoryId) return categorySelection.subcategoryId;
    if (categorySelection.categoryId) {
      return subcategories.find((item) => item.category_id === categorySelection.categoryId)?.id ?? "";
    }
    if (categorySelection.groupId) {
      const categoryIds = categories
        .filter((item) => item.category_group_id === categorySelection.groupId)
        .map((item) => item.id);
      return subcategories.find((item) => item.category_id && categoryIds.includes(item.category_id))?.id ?? "";
    }
    return "";
  }

  function getCategorySummaryLabel(): string {
    if (categorySelection.tier === "subcategory") return getSelectedSubcategory()?.label ?? "Select category";
    if (categorySelection.tier === "category") return getSelectedCategory()?.label ?? "Select category";
    if (categorySelection.tier === "group") return getSelectedGroup()?.label ?? "Select category";
    return "Select category";
  }

  function getAccountName(id: string): string {
    return accounts.find((a) => a.id === id)?.name ?? "Select account";
  }

  function getPrimaryAccountLabel(): string {
    if (txType === "income") return destAccountId ? getAccountName(destAccountId) : "Select account";
    return sourceAccountId ? getAccountName(sourceAccountId) : "Select account";
  }

  function getBalanceWarning(amountCentavos: number) {
    const accountId = txType === "income" ? "" : sourceAccountId;
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return null;

    const isCreditCard = account.kind === "credit_card" && account.creditCardDetails;
    let availableCentavos = isCreditCard
      ? account.creditCardDetails!.availableCreditCentavos ?? account.creditCardDetails!.creditLimitCentavos
      : account.currentBalanceCentavos;

    if (
      isEdit
      && transaction?.source_account_id === account.id
      && (transaction.transaction_type === "expense" || transaction.transaction_type === "transfer")
    ) {
      availableCentavos += transaction.amount_centavos;
    }

    const remainingCentavos = availableCentavos - amountCentavos;
    return remainingCentavos < 0
      ? { accountName: account.name, deficitCentavos: Math.abs(remainingCentavos), isCreditCard: Boolean(isCreditCard) }
      : null;
  }

  function formatCurrency(amountCentavos: number): string {
    return `₱${(amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function selectedSourceIsCreditCard(): boolean {
    return txType === "expense" && accounts.some((account) => account.id === sourceAccountId && account.kind === "credit_card");
  }

  function formatPostingDate(): string {
    if (!postingDate) return "Select posting date";
    return formatDate(new Date(`${postingDate}T00:00:00`));
  }

  function getScreenTitle(): string {
    return isEdit ? "Edit Transaction" : "New Transaction";
  }

  function renderFieldLabel(label: string) {
    return (
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.mut, letterSpacing: 0.4, marginBottom: 8 }}>
        {label}
      </Text>
    );
  }

  async function handleSave(confirmed = false) {
    let savePhase = "start";
    console.log("[DEBUG-TX-SAVE] started", { isEdit, txType });
    setFormError(null);
    const centavos = parseAmount();
    const effectiveSubcategoryId = resolveEffectiveSubcategoryId();
    if (centavos <= 0) {
      setFormError("Enter a valid amount");
      return;
    }

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    if (txType === "expense" && !sourceAccountId) {
      setFormError("Select a source account");
      return;
    }
    if (txType === "income" && !destAccountId) {
      setFormError("Select a destination account");
      return;
    }
    if (txType === "transfer") {
      if (!sourceAccountId) {
        setFormError("Select a source account");
        return;
      }
      if (!destAccountId) {
        setFormError("Select a destination account");
        return;
      }
    }
    if (txType !== "transfer" && !effectiveSubcategoryId) {
      setFormError("Select a category");
      return;
    }
    if (isDebtPayment && !debtPaymentId) {
      setFormError("Select a debt before continuing");
      return;
    }
    if (selectedSourceIsCreditCard() && postingDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(postingDate.trim())) {
      setFormError("Some credit-card details are not valid. Check the highlighted fields and try again.");
      return;
    }

    if (editInstallmentLocked) {
      setFormError("Installment transactions cannot be edited after creation because amortizations and available-credit holds may already be linked to billing cycles.");
      return;
    }

    const isInstallmentPurchase = !isEdit && selectedSourceIsCreditCard() && creditCardPurchaseType === "installment";
    let installmentInput: CreateCreditCardInstallmentInput | undefined;
    if (isInstallmentPurchase) {
      const originalPrincipal = parseMoney(installment.originalPrincipal);
      const termMonths = Number.parseInt(installment.termMonths, 10);
      const remainingMonths = Number.parseInt(installment.remainingMonths, 10);
      const remainingPrincipal = parseMoney(installment.remainingPrincipal);
      const monthlyAmortization = parseMoney(installment.monthlyAmortization);
      const interestRateBps = Math.round(Number.parseFloat(installment.interestRatePercent) * 100);
      const errors: InstallmentFieldErrors = {};
      if (originalPrincipal <= 0 || originalPrincipal !== centavos) errors.originalPrincipal = "Enter the transaction amount as the original principal.";
      if (!/^\d+$/.test(installment.termMonths) || termMonths <= 0) errors.termMonths = "Enter a positive whole-number term.";
      if (!/^\d+$/.test(installment.remainingMonths) || remainingMonths < 0 || remainingMonths > termMonths) errors.remainingMonths = "Remaining months cannot exceed the term.";
      if (!installment.remainingPrincipal.trim() || remainingPrincipal < 0 || remainingPrincipal > originalPrincipal) errors.remainingPrincipal = "Enter a non-negative amount up to the original principal.";
      if (monthlyAmortization <= 0) errors.monthlyAmortization = "Enter a positive monthly amount.";
      if (installment.interestType === "interest_bearing" && (!Number.isFinite(interestRateBps) || interestRateBps < 0)) errors.interestRatePercent = "Enter a non-negative interest rate.";
      if (Object.keys(errors).length) {
        setInstallmentErrors(errors);
        setFormError("Some installment details are not valid. Check the highlighted fields and try again.");
        return;
      }
      setInstallmentErrors({});
      installmentInput = {
        description: description.trim(), original_principal_centavos: centavos,
        remaining_principal_centavos: remainingPrincipal, term_months: termMonths,
        remaining_months: remainingMonths, monthly_amortization_centavos: monthlyAmortization,
        interest_type: installment.interestType,
        interest_rate_bps: installment.interestType === "zero_interest" ? 0 : interestRateBps,
        settlement_status: "active",
      };
    }

    const warning = getBalanceWarning(centavos);
    if (warning && !confirmed) {
      setBalanceWarning(warning);
      return;
    }

    savePhase = "validated";
    console.log("[DEBUG-TX-SAVE] validation passed", { isEdit, txType });
    setSaving(true);
    try {
      if (isStatementPayment && (!statementPayment || (isEdit && !existingStatementPayment))) {
        setFormError("The selected credit-card statement is no longer available.");
        return;
      }
       if (isEdit && isStatementPayment && existingStatementPayment) {
        await updateStatementPayment(userId, deviceId, existingStatementPayment.id, {
          amount_centavos: centavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId,
          transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined,
        });
       } else if (isEdit && debtPaymentContext) {
         await updateTransactionDebtPayment(userId, deviceId, debtPaymentContext.paymentId, { amount_centavos: centavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId, transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined });
       } else if (isEdit) {
        savePhase = "updateTransaction";
        console.log("[DEBUG-TX-SAVE] calling updateTransaction");
        const updateInput: Record<string, unknown> = {
          amount_centavos: centavos,
          transaction_date: dateStr,
          notes: notes.trim() || "",
        };

        if (txType === "expense") {
          updateInput.source_account_id = sourceAccountId;
          updateInput.subcategory_id = effectiveSubcategoryId;
          updateInput.merchant_name = description.trim() || "";
          updateInput.credit_card_posting_date = selectedSourceIsCreditCard() ? postingDate.trim() || null : null;
        } else if (txType === "income") {
          updateInput.destination_account_id = destAccountId;
          updateInput.subcategory_id = effectiveSubcategoryId;
          updateInput.counterparty_name = description.trim() || "";
        } else {
          updateInput.source_account_id = sourceAccountId;
          updateInput.destination_account_id = destAccountId;
          const desc = description.trim();
          const note = notes.trim();
          updateInput.notes = desc && note ? `${desc} — ${note}` : (desc || note || "");
        }

         await updateTransaction(userId, deviceId, transaction!.id, updateInput as UpdateTransactionInput);
         console.log("[DEBUG-TX-SAVE] updateTransaction completed");
            } else if (isStatementPayment && statementPaymentContext) {
            await createStatementPayment(userId, deviceId, {
              statementId: statementPaymentContext.statementId,
              cycleId: statementPaymentContext.cycleId,
              amount_centavos: centavos,
              source_account_id: sourceAccountId,
              subcategory_id: effectiveSubcategoryId,
              transaction_date: dateStr,
              merchant_name: description.trim() || undefined,
              notes: notes.trim() || undefined,
            });
          } else if (isDebtPayment && txType === "expense") {
            await createTransactionDebtPayment(userId, deviceId, { debt_account_id: debtPaymentId, amount_centavos: centavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId, transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined });
          } else if (txType === "expense") {
            savePhase = "createExpense";
           console.log("[DEBUG-TX-SAVE] calling createExpense");
           await createExpense(userId, deviceId, {
          amount_centavos: centavos,
          source_account_id: sourceAccountId,
          subcategory_id: effectiveSubcategoryId,
           transaction_date: dateStr,
           credit_card_posting_date: selectedSourceIsCreditCard() ? postingDate.trim() || null : null,
          merchant_name: description.trim() || undefined,
          notes: notes.trim() || undefined,
          installment: installmentInput,
        });
      } else if (txType === "income") {
         savePhase = "createIncome";
         console.log("[DEBUG-TX-SAVE] calling createIncome");
         await createIncome(userId, deviceId, {
          amount_centavos: centavos,
          destination_account_id: destAccountId,
          subcategory_id: effectiveSubcategoryId,
          transaction_date: dateStr,
          counterparty_name: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        const desc = description.trim();
        const note = notes.trim();
        const mergedNotes = desc && note ? `${desc} — ${note}` : (desc || note || undefined);
        savePhase = "createTransfer";
        console.log("[DEBUG-TX-SAVE] calling createTransfer");
        await createTransfer(userId, deviceId, {
          amount_centavos: centavos,
          source_account_id: sourceAccountId,
          destination_account_id: destAccountId,
          transaction_date: dateStr,
          notes: mergedNotes,
        });
      }

      if (!isEdit && isRecurring && !isInstallmentPurchase) {
        savePhase = "createRecurringTemplate";
        console.log("[DEBUG-TX-SAVE] calling createRecurringTemplate");
        const freqInterval = parseInt(recurringSchedule.intervalCount, 10);
        const dom = parseInt(recurringSchedule.dayOfMonth, 10);
        const secondDom = parseInt(recurringSchedule.secondDayOfMonth, 10);
        await createRecurringTemplate(userId, deviceId, {
          transaction_type: txType,
          name: description.trim() || `${txType} recurring`,
          amount_centavos: centavos,
          frequency: recurringSchedule.frequency,
          interval_count: Number.isInteger(freqInterval) && freqInterval > 0 ? freqInterval : undefined,
          day_of_month: Number.isInteger(dom) && dom >= 1 && dom <= 31 ? dom : undefined,
          second_day_of_month: Number.isInteger(secondDom) && secondDom >= 1 && secondDom <= 31 ? secondDom : undefined,
          day_of_week: recurringSchedule.dayOfWeek != null ? recurringSchedule.dayOfWeek : undefined,
          starts_on: dateStr,
          subcategory_id: effectiveSubcategoryId || undefined,
          source_account_id: sourceAccountId || undefined,
          destination_account_id: destAccountId || undefined,
          notes: notes.trim() || undefined,
        });
      }

      showToast(isStatementPayment ? "Your credit-card payment was recorded. Review the statement status to confirm the update." : isEdit ? "Transaction updated" : "Transaction saved", "success");
      savePhase = "runSync";
      console.log("[DEBUG-TX-SAVE] starting runSync");
      runSync(userId, deviceId, accessToken, { maxAttempts: 3 }).catch((error) => {
        console.error("[DEBUG-TX-SAVE] runSync failed", {
          name: error instanceof Error ? error.name : "unknown",
          message: error instanceof Error ? error.message : String(error),
        });
      });

      resetForm(true);
    } catch (error) {
      console.error("[DEBUG-TX-SAVE] failed", {
        phase: savePhase,
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
      setFormError(error instanceof Error ? error.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }

  function renderAccountPicker() {
    if (!accountPickerMode) return null;
    const isSource = accountPickerMode === "source";

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setAccountPickerMode(null)}>
        <Pressable onPress={() => setAccountPickerMode(null)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"}>
              <Pressable onPress={() => {}}>
                <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get("window").height * 0.85 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
                  <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled" bounces={false}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: palette.ink }}>
                      {isSource ? "From account" : "To account"}
                    </Text>
                    {accounts.length === 0 ? (
                      <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, textAlign: "center", paddingVertical: 20 }}>
                        No financial accounts available
                      </Text>
                    ) : (
                       accounts.filter((a) => !isStatementPayment || a.kind !== "credit_card").map((a) => {
                        const selected = isSource ? sourceAccountId === a.id : destAccountId === a.id;
                        return (
                          <Pressable
                            key={a.id}
                            onPress={() => {
                              if (isSource) setSourceAccountId(a.id);
                              else setDestAccountId(a.id);
                              setAccountPickerMode(null);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={a.name}
                            accessibilityState={{ selected }}
                            style={{
                              padding: 14,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: selected ? palette.brand : palette.line,
                              backgroundColor: selected ? palette.successCard : palette.card,
                            }}
                          >
                            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }}>
                              {a.name}
                            </Text>
                            <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 2 }}>
                               {a.kind.replace("_", " ")} · {formatAccountAmount(a)}
                            </Text>
                          </Pressable>
                        );
                      }))}
                  </ScrollView>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Modal>
    );
  }

  function renderDatePicker(mode: "transaction" | "posting") {
    const posting = mode === "posting";
    const visible = posting ? showPostingDatePicker : showDatePicker;
    if (!visible) return null;
    const selectedDate = posting && postingDate ? new Date(`${postingDate}T00:00:00`) : date;
    const close = () => posting ? setShowPostingDatePicker(false) : setShowDatePicker(false);
    const select = (nextDate: Date) => {
      if (posting) {
        setPostingDate(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`);
      } else {
        setDate(nextDate);
      }
    };

    if (Platform.OS === "android") {
      return (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          maximumDate={new Date()}
          onChange={(_event, nextDate) => {
            close();
            if (nextDate) select(nextDate);
          }}
        />
      );
    }

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable onPress={close} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, paddingTop: 14 }}>
                  <Pressable onPress={close}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.mut }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: palette.ink }}>
                    Select date
                  </Text>
                  <Pressable onPress={close}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.brand }}>
                      Done
                    </Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  maximumDate={new Date()}
                  display="spinner"
                  onChange={(_event, nextDate) => {
                    if (nextDate) select(nextDate);
                  }}
                />
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    );
  }

  function renderCategoryPickerPage() {
    const selectedGroup = getSelectedGroup();
    const selectedCategory = getSelectedCategory();
    const selectedSubcategory = getSelectedSubcategory();

    return (
               <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, marginBottom: 16 }}>
          Pick from your full {txType} category list.
        </Text>

        {(selectedGroup || selectedCategory || selectedSubcategory) ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: palette.successTint, backgroundColor: palette.successCard, padding: 14, marginBottom: 18 }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: "600", color: palette.successTint, letterSpacing: 0.4, marginBottom: 4 }}>
              CURRENT SELECTION
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: palette.ink }}>
              {getCategorySummaryLabel()}
            </Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {txType === "income" ? (
            subcategories.length === 0 ? (
              <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, textAlign: "center", paddingVertical: 20 }}>
                No income categories found.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {subcategories.map((sub) => {
                  const selected = categorySelection.subcategoryId === sub.id;
                  return (
                    <Pressable
                      key={sub.id}
                      onPress={() => {
                        setCategorySelection({ tier: "subcategory", groupId: null, categoryId: null, subcategoryId: sub.id });
                        setShowCategoryPicker(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={sub.label}
                      accessibilityState={{ selected }}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected ? palette.brand : palette.line,
                        backgroundColor: selected ? palette.successCard : palette.card,
                      }}
                    >
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }}>
                        {sub.label}
                      </Text>
                      {sub.description ? (
                        <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 2 }}>
                          {sub.description}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )
          ) : (
            <CategorySelectorTree
              groups={groups}
              categories={categories}
              subcategories={subcategories}
              selection={categorySelection}
              onSelect={(nextSelection) => {
                setCategorySelection(nextSelection);
                setShowCategoryPicker(false);
              }}
              emptyMessage="No categories found for this transaction type."
            />
          )}
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 60 }}>
        <ActivityIndicator color={palette.brand} />
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut, marginTop: 10 }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (dataError) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 60 }}>
        <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.error, marginBottom: 14 }}>
          {dataError}
        </Text>
        <Pressable onPress={onClose} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.line }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: palette.ink2 }}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const descriptionLabel = txType === "income" ? "PAYER" : "DESCRIPTION";
  const descriptionPlaceholder = txType === "income" ? "Who paid you?" : txType === "transfer" ? "What's this for?" : "Jollibee - Lunch";
  const needsCategory = txType !== "transfer";
  const selectedSubcategory = getSelectedSubcategory();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: palette.shell }}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 14 }}>
          <Pressable
            onPress={showCategoryPicker ? () => setShowCategoryPicker(false) : onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showCategoryPicker ? "Back to transaction form" : "Close transaction form"}
          >
            {showCategoryPicker ? <CaretLeft color={palette.ink} size={22} weight="bold" /> : <X color={palette.ink} size={22} weight="bold" />}
          </Pressable>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: palette.ink }}>
            {showCategoryPicker ? "Select Category" : getScreenTitle()}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {!online && !showCategoryPicker ? (
          <View style={{ backgroundColor: "#fff4d7", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#8D6E00" }}>
              You're offline. Changes will sync when you reconnect.
            </Text>
          </View>
        ) : null}

        {showCategoryPicker ? renderCategoryPickerPage() : (
          <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
             {!isEdit && !isStatementPayment ? <TransactionTypeSelector value={txType} onChange={setTxType} /> : null}
             {isStatementPayment ? <View style={{ borderRadius: 14, backgroundColor: palette.card, padding: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.ink }}>Credit-card statement payment</Text><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: palette.mut, marginTop: 3 }}>{statementPayment ? `Statement due ${statementPayment.due_date} · Balance ${formatCurrency(statementPayment.statement_balance_centavos)}` : "Checking the selected statement..."}</Text></View> : null}

            <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 2 }}>
              <Text style={{ fontFamily: "Manrope", fontSize: 15, color: palette.mut, marginBottom: 2 }}>PHP</Text>
              <TextInput
                accessibilityLabel="Payment amount"
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="#b9b39f"
                keyboardType="decimal-pad"
                style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 54, color: palette.ink, textAlign: "center", minWidth: 180, paddingVertical: 0 }}
              />
              <View style={{ width: 138, height: 2, borderRadius: 999, backgroundColor: palette.successTint, marginTop: 6 }} />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              {QUICK_AMOUNTS.map((quickAmount) => {
                const selected = amount === String(quickAmount);
                return (
                  <Pressable
                    key={quickAmount}
                    onPress={() => setAmount(String(quickAmount))}
                    style={{
                      minWidth: 52,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? palette.successTint : "#e6dcc7",
                      backgroundColor: selected ? "#cbffe8" : palette.card,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontFamily: "Manrope", fontWeight: selected ? "700" : "600", fontSize: 13, color: palette.ink2 }}>
                      {quickAmount.toLocaleString()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View>
              {renderFieldLabel(descriptionLabel)}
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={descriptionPlaceholder}
                editable
                placeholderTextColor={palette.mut}
                style={{ height: 58, borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", paddingHorizontal: 16, fontFamily: "Manrope", fontSize: 16, color: palette.ink, backgroundColor: palette.softCard }}
              />
            </View>

            {txType === "transfer" ? (
              <View style={{ gap: 14 }}>
                <View>
                  {renderFieldLabel("DATE")}
                  <Pressable onPress={() => setShowDatePicker(true)} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <CalendarBlank color={palette.mut} size={18} weight="regular" />
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: palette.ink }}>{formatDate(date)}</Text>
                    </View>
                  </Pressable>
                </View>
                <View>
                  {renderFieldLabel("FROM ACCOUNT")}
                  <Pressable onPress={() => setAccountPickerMode("source")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Wallet color={palette.mut} size={18} weight="regular" />
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: sourceAccountId ? palette.ink : palette.mut }}>
                        {sourceAccountId ? getAccountName(sourceAccountId) : "Select account"}
                      </Text>
                    </View>
                    <CaretRight color={palette.mut} size={16} weight="bold" />
                  </Pressable>
                </View>
                <View>
                  {renderFieldLabel("TO ACCOUNT")}
                  <Pressable onPress={() => setAccountPickerMode("dest")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Wallet color={palette.mut} size={18} weight="regular" />
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: destAccountId ? palette.ink : palette.mut }}>
                        {destAccountId ? getAccountName(destAccountId) : "Select account"}
                      </Text>
                    </View>
                    <CaretRight color={palette.mut} size={16} weight="bold" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  {renderFieldLabel("DATE")}
                  <Pressable onPress={() => setShowDatePicker(true)} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <CalendarBlank color={palette.mut} size={18} weight="regular" />
                      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: palette.ink }}>{formatDate(date)}</Text>
                    </View>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  {renderFieldLabel("ACCOUNT")}
                  <Pressable accessibilityLabel="Select account" onPress={() => setAccountPickerMode(txType === "income" ? "dest" : "source")} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <Wallet color={palette.mut} size={18} weight="regular" />
                      <Text numberOfLines={1} style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: (sourceAccountId || destAccountId) ? palette.ink : palette.mut, flex: 1 }}>
                        {getPrimaryAccountLabel()}
                      </Text>
                    </View>
                    <CaretRight color={palette.mut} size={16} weight="bold" />
                  </Pressable>
               </View>
             </View>
            )}

             {selectedSourceIsCreditCard() && !isStatementPayment ? (
              <>
                <View>
                  {renderFieldLabel("PURCHASE TYPE")}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {(["regular", "installment"] as const).map((type) => {
                      const selected = creditCardPurchaseType === type;
                      const purchaseTypeLocked = isEdit;
                      return <Pressable key={type} disabled={purchaseTypeLocked} onPress={() => setCreditCardPurchaseType(type)} accessibilityRole="radio" accessibilityState={{ selected, disabled: purchaseTypeLocked }} style={{ flex: 1, borderWidth: 1, borderColor: selected ? palette.brand : "#e8deca", backgroundColor: selected ? palette.successCard : palette.softCard, borderRadius: 14, padding: 13, opacity: purchaseTypeLocked && !selected ? 0.55 : 1 }}>
                        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.ink }}>{type === "regular" ? "Regular Purchase" : "Installment Purchase"}</Text>
                      </Pressable>;
                    })}
                  </View>
                  {isEdit ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 6 }}>Purchase type is locked after creation. Installment transactions cannot be converted or edited once billing-cycle amortizations may exist.</Text> : null}
                </View>
                <View>
                {renderFieldLabel("POSTING DATE (OPTIONAL)")}
                <Pressable
                  accessibilityLabel="Credit-card posting date"
                  onPress={() => setShowPostingDatePicker(true)}
                  style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", backgroundColor: palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 15, color: postingDate ? palette.ink : palette.mut }}>{formatPostingDate()}</Text>
                  <CalendarBlank color={palette.mut} size={18} weight="regular" />
                </Pressable>
                <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 5 }}>
                  Use YYYY-MM-DD when the issuer provides a posting date. Otherwise Odin uses the transaction date as an estimate.
                </Text>
                </View>
                {creditCardPurchaseType === "installment" ? <CreditCardInstallmentFields value={installment} errors={installmentErrors} readOnly={editInstallmentLocked} onChange={(next) => {
                  const changed = (Object.keys(next) as (keyof InstallmentFormValue)[]).find((key) => next[key] !== installment[key]);
                  if (changed) setInstallmentErrors((current) => ({ ...current, [changed]: undefined }));
                  if (changed === "termMonths" && (!installment.remainingMonths.trim() || installment.remainingMonths === installment.termMonths)) {
                    setInstallment({ ...next, remainingMonths: next.termMonths });
                  } else {
                    setInstallment(next);
                  }
                }} /> : null}
              </>
             ) : null}

             {txType === "expense" && !isStatementPayment && !selectedSourceIsCreditCard() ? <View><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isDebtPayment, disabled: Boolean(debtPaymentDebtId || debtPaymentContext) }} disabled={Boolean(debtPaymentDebtId || debtPaymentContext)} onPress={() => { setIsDebtPayment((current) => !current); setDebtPaymentId(""); }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: palette.ink }}>Record as a debt payment</Text></Pressable><Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut, marginTop: 4 }}>Choose this when this expense pays down one of your debts.</Text>{isDebtPayment ? <View style={{ gap: 6, marginTop: 8 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: palette.ink }}>Select the debt this payment applies to</Text>{activeDebts.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut }}>No active debts are available. Add a debt before recording a debt payment.</Text> : activeDebts.map((debt) => <Pressable key={debt.id} accessibilityRole="radio" accessibilityState={{ selected: debtPaymentId === debt.id, disabled: Boolean(debtPaymentDebtId || debtPaymentContext) }} disabled={Boolean(debtPaymentDebtId || debtPaymentContext)} onPress={() => setDebtPaymentId(debt.id)} style={{ padding: 10, borderWidth: 1, borderColor: debtPaymentId === debt.id ? palette.brand : palette.line, borderRadius: 10 }}><Text style={{ color: palette.ink }}>{debt.name} · {formatCurrency(debt.currentBalanceCentavos)}</Text></Pressable>)}</View> : null}</View> : null}

            {needsCategory ? (
              <View>
                {renderFieldLabel(categorySelection.tier ? `CATEGORY · ${categorySelection.tier.toUpperCase()}` : "CATEGORY")}
                <Pressable onPress={() => setShowCategoryPicker(true)} style={{ borderRadius: 16, borderWidth: 1, borderColor: categorySelection.tier ? palette.successTint : "#e8deca", backgroundColor: categorySelection.tier ? palette.successCard : palette.softCard, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 15, color: palette.ink }}>{getCategorySummaryLabel()}</Text>
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut, marginTop: 4 }}>Open full list to view everything</Text>
                  </View>
                  <CaretRight color={palette.mut} size={16} weight="bold" />
                </Pressable>
              </View>
            ) : null}

            <View>
              {renderFieldLabel("NOTES")}
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes"
                placeholderTextColor={palette.mut}
                multiline
                numberOfLines={3}
                style={{ borderRadius: 16, borderWidth: 1, borderColor: "#e8deca", paddingHorizontal: 16, paddingTop: 14, fontFamily: "Manrope", fontSize: 15, color: palette.ink, backgroundColor: palette.softCard, minHeight: 92, textAlignVertical: "top" }}
              />
            </View>

               {!isEdit && !isStatementPayment && !(selectedSourceIsCreditCard() && creditCardPurchaseType === "installment") ? (
              <>
                <View style={{ borderRadius: 18, backgroundColor: "#f4ead2", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Repeat color={palette.ink2} size={18} weight="regular" />
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: palette.ink }}>Recurring</Text>
                  </View>
                  <Pressable onPress={() => setIsRecurring(!isRecurring)} accessibilityRole="switch" accessibilityLabel="Recurring transaction" accessibilityState={{ checked: isRecurring }} style={{ width: 50, height: 30, borderRadius: 999, backgroundColor: isRecurring ? palette.successTint : "#e4dfd3", padding: 3, justifyContent: "center" }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignSelf: isRecurring ? "flex-end" : "flex-start" }} />
                  </Pressable>
                </View>

                {isRecurring ? (
                  <RecurringScheduleFields
                    frequencies={["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly"]}
                    value={recurringSchedule}
                    onChange={setRecurringSchedule}
                    showIntervalCount
                  />
                ) : null}
              </>
            ) : null}

            {formError ? (
              <View style={{ backgroundColor: "#fff0f2", borderRadius: 14, padding: 12 }}>
                <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.error, fontWeight: "600" }}>{formError}</Text>
              </View>
            ) : null}

            {isEdit ? (
              <Pressable onPress={() => handleSave()} disabled={saving} style={{ height: 54, borderRadius: 16, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel="Save changes">
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#fff" }}>Save Changes</Text>}
              </Pressable>
            ) : (
              <Pressable onPress={() => handleSave()} disabled={saving} style={{ height: 54, borderRadius: 16, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center", opacity: saving ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel="Save transaction">
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#fff" }}>Save</Text>}
              </Pressable>
            )}
          </ScrollView>
        )}

        {renderDatePicker("transaction")}
        {renderDatePicker("posting")}
        {renderAccountPicker()}
        <Modal visible={balanceWarning !== null} transparent animationType="fade" onRequestClose={() => setBalanceWarning(null)}>
          <Pressable onPress={() => setBalanceWarning(null)} style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.4)" }}>
            <Pressable onPress={() => {}}>
              <View style={{ borderRadius: 20, padding: 22, backgroundColor: palette.shell }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>Insufficient available balance</Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: palette.ink2, marginTop: 12 }}>
                  {balanceWarning?.isCreditCard
                    ? `This transaction exceeds ${balanceWarning.accountName}'s available credit by ${formatCurrency(balanceWarning.deficitCentavos)}.`
                    : `This transaction exceeds ${balanceWarning?.accountName}'s available balance by ${formatCurrency(balanceWarning?.deficitCentavos ?? 0)}.`}
                </Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8 }}>
                  Continue recording? The available {balanceWarning?.isCreditCard ? "credit" : "balance"} will be negative.
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 22 }}>
                  <Pressable onPress={() => setBalanceWarning(null)} accessibilityRole="button" accessibilityLabel="Cancel transaction">
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.mut }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setBalanceWarning(null);
                      handleSave(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm record transaction"
                  >
                    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: palette.brand }}>Continue</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}
