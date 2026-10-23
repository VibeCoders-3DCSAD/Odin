import SavingsContributionGoalPicker from "./components/SavingsContributionGoalPicker";
import SavingsContributionAccounts from "./components/SavingsContributionAccounts";
import SavingsExpenseFundingSheet from "./components/SavingsExpenseFundingSheet";
import { getSavingsExpenseFunding, type SavingsExpenseFunding, type SavingsExpenseWithdrawal } from "../../local-db/repositories/savingsExpenseFunding";
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
import { ArrowLeft, Check } from "phosphor-react-native";
import { DEFAULT_TAXONOMY_COLOR, TaxonomyIcon } from "../taxonomy/taxonomyVisuals";
import { AmountHero, Banner, Chip, FieldError, FieldLabel, FormCard, Note, PickerField, Segment, Switch, TextField, styles as ui, v4, v4Font } from "../../components/BudgieForm";
import { CategorySelectorTree, type CategorySelection } from "../../components/CategorySelector";
import TransactionTypeSelector, { TransactionType } from "./components/TransactionTypeSelector";
import { useTransactionData } from "./hooks/useTransactionData";
import { createExpense, createIncome, createSavingsGoalTransfer, createTransfer, updateTransaction, type Transaction, type UpdateTransactionInput } from "../../local-db/repositories/ledger";
import { createStatementPayment, getCreditCardPaymentByStatement, updateStatementPayment, type CreditCardPayment, type StatementPaymentContext } from "../../local-db/repositories/creditCardPayments";
import { getCreditCardStatementByCycle, type CreditCardStatement } from "../../local-db/repositories/creditCardStatements";
import { listDebtAccounts, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import { createTransactionDebtPayment, updateTransactionDebtPayment, type DebtPaymentContext } from "../../local-db/repositories/debtPayments";
import { getCreditCardPurchaseMetadataForTransaction, type CreateCreditCardInstallmentInput } from "../../local-db/repositories/creditCardInstallments";
import { getUnusualSpending, saveUnusualSpending, type UnusualSpendingInsight } from "../../local-db/repositories/unusualSpending";
import { runSync } from "../../local-db/sync/runSync";
import { useToast } from "../../components/Toast";
import { useConnectivityStore } from "../../services/connectivity";
import type { Subcategory } from "../../local-db/repositories/taxonomy";
import CreditCardInstallmentFields, { type InstallmentFieldErrors, type InstallmentFormValue } from "./components/CreditCardInstallmentFields";
import AccountSelectionSheet from "../../components/AccountSelectionSheet";
import { BottomSheetSurface } from "../../components/BottomSheetSurface";
import { ActionSheet } from "../../components/ActionSheet";

const QUICK_AMOUNTS = [100, 250, 500, 1000];

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onClose: () => void;
  onCreated?: (unusualSpending: UnusualSpendingInsight | null) => void;
  transaction?: Transaction;
  statementPaymentContext?: StatementPaymentContext;
  debtPaymentDebtId?: string;
  debtPaymentContext?: DebtPaymentContext;
  savingsActivityContext?: { savingsGoalId: string; kind: "contribution" | "withdrawal"; amountCentavos?: number };
};

export default function NewTransactionScreen({ userId, deviceId, accessToken, onClose, onCreated, transaction, statementPaymentContext, debtPaymentDebtId, debtPaymentContext, savingsActivityContext }: Props) {
  const { showToast } = useToast();
  const online = useConnectivityStore((s) => s.online);
  const isEdit = !!transaction;
  const [isSavingsContribution, setIsSavingsContribution] = useState(false);
  const [selectedSavingsGoalId, setSelectedSavingsGoalId] = useState<string | null>(null);

  const [txType, setTxType] = useState<TransactionType>(savingsActivityContext ? "transfer" : statementPaymentContext ? "expense" : (transaction?.transaction_type as TransactionType) ?? "expense");
  const contributionGoalId = savingsActivityContext?.kind === "contribution" ? savingsActivityContext.savingsGoalId : transaction?.destination_savings_goal_id ?? (isSavingsContribution && txType === "transfer" ? selectedSavingsGoalId : null);

  const [statementPayment, setStatementPayment] = useState<CreditCardStatement | null>(null);
  const [existingStatementPayment, setExistingStatementPayment] = useState<CreditCardPayment | null>(null);
  const [isDebtPayment, setIsDebtPayment] = useState(Boolean(debtPaymentDebtId || debtPaymentContext));
  const [debtPaymentId, setDebtPaymentId] = useState(debtPaymentDebtId ?? debtPaymentContext?.debtAccountId ?? "");
  const [debtPrincipal, setDebtPrincipal] = useState("");
  const [debtInterestOrFees, setDebtInterestOrFees] = useState("0");
  const [activeDebts, setActiveDebts] = useState<DebtAccount[]>([]);
  const isStatementPayment = Boolean(statementPaymentContext);

  useEffect(() => {
    if (!isEdit) setCategorySelection({ tier: null, categoryId: null, subcategoryId: null });
  }, [txType]);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount_centavos / 100) : savingsActivityContext?.amountCentavos ? String(savingsActivityContext.amountCentavos / 100) : "");
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
    categoryId: null,
    subcategoryId: transaction?.subcategory_id ?? null,
  });
  const [description, setDescription] = useState(transaction?.merchant_name ?? transaction?.counterparty_name ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savingsFunding, setSavingsFunding] = useState<SavingsExpenseFunding | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [installmentErrors, setInstallmentErrors] = useState<InstallmentFieldErrors>({});
  const [accountPickerMode, setAccountPickerMode] = useState<"source" | "dest" | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<{
    accountName: string;
    deficitCentavos: number;
    isCreditCard: boolean;
  } | null>(null);

  const { accounts, categories, subcategories, loading, error: dataError } = useTransactionData(userId, txType);

  useEffect(() => { listDebtAccounts(userId).then(setActiveDebts).catch(() => setActiveDebts([])); }, [userId]);

  useEffect(() => {
    if (!debtPaymentDebtId) return;
    setIsDebtPayment(true);
    setDebtPaymentId(debtPaymentDebtId);
    const debt = activeDebts.find((item) => item.id === debtPaymentDebtId);
    if (debt) setDescription(`Payment to ${debt.name}`);
  }, [activeDebts, debtPaymentDebtId]);

  useEffect(() => {
    if (!debtPaymentContext) return;
    import("../../local-db/repositories/debtPayments").then(({ listAllDebtPayments }) => listAllDebtPayments(userId)).then((payments) => {
      const payment = payments.find((item) => item.id === debtPaymentContext.paymentId);
      if (payment) { setDebtPrincipal(String(payment.principal_centavos / 100)); setDebtInterestOrFees(String(payment.interest_centavos / 100)); }
    }).catch(() => {});
  }, [debtPaymentContext, userId]);

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
      setCategorySelection({ tier: null, categoryId: null, subcategoryId: null });
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
    if (currentCategory || currentSubcategory) {
      if (currentCategory?.id !== categorySelection.categoryId) {
        setCategorySelection((current) => ({
          ...current,
          categoryId: currentCategory?.id ?? current.categoryId,
        }));
      }
      return;
    }

    if (!isEdit && subcategories.length > 0) {
      const fallback = subcategories[0]!;
      const fallbackCategory = fallback.category_id ? categories.find((item) => item.id === fallback.category_id) ?? null : null;
      setCategorySelection({
        tier: "subcategory",
        categoryId: fallbackCategory?.id ?? null,
        subcategoryId: fallback.id,
      });
    }
  }, [
    subcategories,
    categories,
    txType,
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
    setCategorySelection({ tier: null, categoryId: null, subcategoryId: null });
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
    return `PHP ${(amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  function resolveEffectiveSubcategoryId(): string {
    if (categorySelection.subcategoryId) return categorySelection.subcategoryId;
    if (categorySelection.categoryId) {
      return subcategories.find((item) => item.category_id === categorySelection.categoryId)?.id ?? "";
    }
    return "";
  }

  function getCategorySummaryLabel(): string {
    if (categorySelection.tier === "subcategory") return getSelectedSubcategory()?.label ?? "Select category";
    if (categorySelection.tier === "category") return getSelectedCategory()?.label ?? "Select category";
    return "Select category";
  }

  function getCategoryFieldLabel(): string {
    const subcategory = categorySelection.tier === "subcategory" ? getSelectedSubcategory() : null;
    const category = getSelectedCategory();
    if (subcategory && category) return `${category.label} · ${subcategory.label}`;
    return getCategorySummaryLabel();
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

  async function handleSave(confirmed = false, savingsWithdrawals?: SavingsExpenseWithdrawal[]) {
    if (saving) return;
    let savePhase = "start";
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
    if (isSavingsContribution && txType === "transfer" && !contributionGoalId) {
      setFormError("Select a savings goal");
      return;
    }
    if (txType === "transfer" && !savingsActivityContext) {
      if (!sourceAccountId) {
        setFormError("Select a source account");
        return;
      }
      if (!contributionGoalId && !destAccountId) {
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
    const principalCentavos = isDebtPayment ? parseMoney(debtPrincipal || amount) : 0;
    const interestCentavos = isDebtPayment ? parseMoney(debtInterestOrFees) : 0;
    if (isDebtPayment && (principalCentavos < 0 || interestCentavos < 0 || principalCentavos + interestCentavos > centavos)) {
      setFormError("Some payment details are not valid. Check the highlighted fields and try again.");
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
    setSaving(true);
    try {
      if (txType === "expense" && !savingsWithdrawals) {
        const funding = await getSavingsExpenseFunding(userId, sourceAccountId, centavos, transaction?.id);
        if (funding.requiredWithdrawalCentavos > 0) {
          setSavingsFunding(funding);
          return;
        }
        savingsWithdrawals = [];
      }
      let createdExpense: Transaction | null = null;
      let unusualSpending: UnusualSpendingInsight | null = null;
      if (isStatementPayment && (!statementPayment || (isEdit && !existingStatementPayment))) {
        setFormError("The selected credit-card statement is no longer available.");
        return;
      }
       if (isEdit && isStatementPayment && existingStatementPayment) {
        await updateStatementPayment(userId, deviceId, existingStatementPayment.id, {
          savings_goal_withdrawals: savingsWithdrawals, amount_centavos: centavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId,
          transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined,
        });
       } else if (isEdit && debtPaymentContext) {
          await updateTransactionDebtPayment(userId, deviceId, debtPaymentContext.paymentId, { savings_goal_withdrawals: savingsWithdrawals, amount_centavos: centavos, principal_centavos: principalCentavos, interest_centavos: interestCentavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId, transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined });
       } else if (isEdit) {
        savePhase = "updateTransaction";
        const updateInput: Record<string, unknown> = {
          amount_centavos: centavos,
          transaction_date: dateStr,
          notes: notes.trim() || "",
        };

        if (txType === "expense") {
          updateInput.savings_goal_withdrawals = savingsWithdrawals;
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
          if (!contributionGoalId) updateInput.destination_account_id = destAccountId;
          const desc = description.trim();
          const note = notes.trim();
          updateInput.notes = desc && note ? `${desc} — ${note}` : (desc || note || "");
        }

         await updateTransaction(userId, deviceId, transaction!.id, updateInput as UpdateTransactionInput);
            } else if (isStatementPayment && statementPaymentContext) {
            await createStatementPayment(userId, deviceId, {
              savings_goal_withdrawals: savingsWithdrawals,
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
             await createTransactionDebtPayment(userId, deviceId, { savings_goal_withdrawals: savingsWithdrawals, debt_account_id: debtPaymentId, amount_centavos: centavos, principal_centavos: principalCentavos, interest_centavos: interestCentavos, source_account_id: sourceAccountId, subcategory_id: effectiveSubcategoryId, transaction_date: dateStr, merchant_name: description.trim() || undefined, notes: notes.trim() || undefined });
          } else if (txType === "expense") {
            savePhase = "createExpense";
            const result = await createExpense(userId, deviceId, {
          savings_goal_withdrawals: savingsWithdrawals,
          amount_centavos: centavos,
          source_account_id: sourceAccountId,
          subcategory_id: effectiveSubcategoryId,
           transaction_date: dateStr,
           credit_card_posting_date: selectedSourceIsCreditCard() ? postingDate.trim() || null : null,
          merchant_name: description.trim() || undefined,
          notes: notes.trim() || undefined,
            installment: installmentInput,
        });
            createdExpense = result.transaction;
      } else if (txType === "income") {
         savePhase = "createIncome";
         await createIncome(userId, deviceId, {
          amount_centavos: centavos,
          destination_account_id: destAccountId,
          subcategory_id: effectiveSubcategoryId,
          transaction_date: dateStr,
          counterparty_name: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else if (contributionGoalId && !savingsActivityContext) {
        await createSavingsGoalTransfer(userId, deviceId, { savings_goal_id: contributionGoalId, kind: "contribution", account_id: sourceAccountId, amount_centavos: centavos, transaction_date: dateStr, notes: [description.trim(), notes.trim()].filter(Boolean).join(" — ") || undefined });
      } else if (savingsActivityContext) {
        const accountId = savingsActivityContext.kind === "contribution" ? sourceAccountId : destAccountId;
        if (!accountId) {
          setFormError(`Select the ${savingsActivityContext.kind === "contribution" ? "source" : "destination"} account`);
          return;
        }
        await createSavingsGoalTransfer(userId, deviceId, { savings_goal_id: savingsActivityContext.savingsGoalId, kind: savingsActivityContext.kind, account_id: accountId, amount_centavos: centavos, transaction_date: dateStr, notes: notes.trim() || undefined });
      } else {
        const desc = description.trim();
        const note = notes.trim();
        const mergedNotes = desc && note ? `${desc} — ${note}` : (desc || note || undefined);
        savePhase = "createTransfer";
        await createTransfer(userId, deviceId, {
          amount_centavos: centavos,
          source_account_id: sourceAccountId,
          destination_account_id: destAccountId,
          transaction_date: dateStr,
          notes: mergedNotes,
        });
      }

      if (createdExpense) {
        try {
          const insight = await getUnusualSpending(userId, createdExpense.id);
          if (insight) await saveUnusualSpending(userId, deviceId, insight);
          unusualSpending = insight;
        } catch (error) {
          console.error("[UNUSUAL-SPENDING] evaluation failed", error);
        }
      }

      showToast(isStatementPayment ? "Your credit-card payment was recorded. Review the statement status to confirm the update." : isEdit ? "Transaction updated" : "Transaction saved", "success");
      savePhase = "runSync";
      runSync(userId, deviceId, accessToken).catch((error) => {
        console.error("[ledger] sync after transaction save failed", {
          error_class: error instanceof Error ? error.constructor.name : "UnknownError",
          save_phase: savePhase,
        });
      });

      resetForm(true);
      // An edit returns to wherever it was opened from, which refreshes that list.
      if (isEdit) onClose();
      else onCreated?.(unusualSpending);
    } catch (error) {
      console.error("[ledger] transaction save failed", {
        error_class: error instanceof Error ? error.constructor.name : "UnknownError",
        save_phase: savePhase,
      });
      setFormError(error instanceof Error ? error.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }

  function renderAccountPicker() {
    const isSource = accountPickerMode === "source";
    const pickable = accounts.filter((a) => !isStatementPayment || a.kind !== "credit_card");

    return <AccountSelectionSheet
      visible={accountPickerMode !== null}
      title={isSource ? "From account" : "To account"}
      accounts={pickable.map((account) => ({ id: account.id, name: account.name, kind: account.kind, amountLabel: formatAccountAmount(account) }))}
      selectedId={isSource ? sourceAccountId : destAccountId}
      onSelect={(id) => { if (isSource) setSourceAccountId(id); else setDestAccountId(id); }}
      onClose={() => setAccountPickerMode(null)}
    />;
  }

  function renderDatePicker(mode: "transaction" | "posting") {
    const posting = mode === "posting";
    const visible = posting ? showPostingDatePicker : showDatePicker;
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
      if (!visible) return null;
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
      <ActionSheet visible onClose={close} backdropColor="rgba(27,28,26,0.4)">
            <Pressable onPress={() => {}}>
              <BottomSheetSurface bottomSpacing={30} style={{ backgroundColor: v4.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                <View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: "#DBD7CD", alignSelf: "center", marginTop: 10 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10 }}>
                  <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}>
                    <Text style={{ fontFamily: v4Font, fontWeight: "600", fontSize: 14, color: v4.mut }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 16, color: v4.ink }}>
                    {posting ? "Posting date" : "Select date"}
                  </Text>
                  <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Done" hitSlop={8}>
                    <Text style={{ fontFamily: v4Font, fontWeight: "700", fontSize: 14, color: v4.brandMid }}>
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
              </BottomSheetSurface>
            </Pressable>
      </ActionSheet>
    );
  }

  function renderCategoryPickerPage() {
    const selectedCategory = getSelectedCategory();
    const selectedSubcategory = getSelectedSubcategory();
    const selectedVisual = categorySelection.tier === "subcategory" ? selectedSubcategory : selectedCategory;

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Note>Pick from your full {txType} category list.</Note>

        {(selectedCategory || selectedSubcategory) ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: v4.okBorder, backgroundColor: v4.okBg, paddingHorizontal: 15, paddingVertical: 14, gap: 4 }}>
            <Text style={{ fontFamily: v4Font, fontSize: 10.5, fontWeight: "700", color: v4.okInk, letterSpacing: 0.6 }}>
              CURRENT SELECTION
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[ui.listTile, { backgroundColor: selectedVisual?.color_hex ?? DEFAULT_TAXONOMY_COLOR }]}>
                <TaxonomyIcon iconKey={selectedVisual?.icon_key} color="#fff" size={16} weight="fill" />
              </View>
              <Text style={{ flex: 1, fontFamily: v4Font, fontWeight: "700", fontSize: 14, color: v4.ink }}>
                {getCategoryFieldLabel()}
              </Text>
            </View>
          </View>
        ) : null}

        {txType === "income" ? (
          subcategories.length === 0 ? (
            <Text style={{ fontFamily: v4Font, fontSize: 13, color: v4.mut, textAlign: "center", paddingVertical: 20 }}>
              No income categories found.
            </Text>
          ) : (
            <View style={ui.list}>
              {subcategories.map((sub, index) => {
                const selected = categorySelection.subcategoryId === sub.id;
                return (
                  <Pressable
                    key={sub.id}
                    onPress={() => {
                      setCategorySelection({ tier: "subcategory", categoryId: null, subcategoryId: sub.id });
                      setShowCategoryPicker(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={sub.label}
                    accessibilityState={{ selected }}
                    style={[ui.listRow, index > 0 ? ui.listRowDivider : null, selected ? ui.listRowSelected : null]}
                  >
                    <View style={ui.listRowMain}>
                      <View style={[ui.listTile, { backgroundColor: sub.color_hex ?? DEFAULT_TAXONOMY_COLOR }]}><TaxonomyIcon iconKey={sub.icon_key} color="#fff" size={16} weight="fill" /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={[ui.listTitle, selected ? { fontWeight: "700" } : null]}>{sub.label}</Text>
                        {sub.description ? <Text numberOfLines={1} style={ui.listSubtitle}>{sub.description}</Text> : null}
                      </View>
                      {selected ? <Check color={v4.brandMid} size={16} weight="bold" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )
        ) : (
          <CategorySelectorTree
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
    );
  }

  if (loading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 60, gap: 10 }}>
        <ActivityIndicator color={v4.brand} />
        <Text style={{ fontFamily: v4Font, fontSize: 13, color: v4.mut }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (dataError) {
    return (
      <View style={{ paddingHorizontal: 18, paddingVertical: 24, gap: 14 }}>
        <Banner tone="error">{dataError}</Banner>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Go back" style={[ui.button, ui.buttonGhost]}>
          <Text style={[ui.buttonText, ui.buttonGhostText]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const descriptionLabel = txType === "income" ? "Payer" : "Description";
  const descriptionPlaceholder = txType === "income" ? "Who paid you?" : txType === "transfer" ? "What's this for?" : "Jollibee - Lunch";
  const needsCategory = txType !== "transfer";
  const debtLocked = Boolean(debtPaymentDebtId || debtPaymentContext);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: v4.shell }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingBottom: 8 }}>
          <Pressable
            onPress={showCategoryPicker ? () => setShowCategoryPicker(false) : onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showCategoryPicker ? "Back to transaction form" : "Close transaction form"}
            style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
          >
            <ArrowLeft color={v4.ink} size={20} weight="bold" />
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontFamily: v4Font, fontWeight: "800", fontSize: 16.5, letterSpacing: -0.2, color: v4.ink }}>
            {showCategoryPicker ? "Select Category" : getScreenTitle()}
          </Text>
        </View>

        {!online && !showCategoryPicker ? (
          <View style={{ marginBottom: 12 }}>
            <Banner tone="warn">You're offline. Changes will sync when you reconnect.</Banner>
          </View>
        ) : null}

        {showCategoryPicker ? renderCategoryPickerPage() : (
          <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {savingsActivityContext ? (
              <FormCard title={savingsActivityContext.kind === "contribution" ? "Savings contribution" : "Savings withdrawal"}>
                <Note>{contributionGoalId ? "Use available money in the linked account, or transfer money from another account." : "This transfer is linked to the selected savings goal."}</Note>
              </FormCard>
            ) : null}
            {isStatementPayment ? (
              <FormCard title="Credit-card statement payment">
                <Note>{statementPayment ? `Statement due ${statementPayment.due_date} · Balance ${formatCurrency(statementPayment.statement_balance_centavos)}` : "Checking the selected statement..."}</Note>
              </FormCard>
            ) : null}

            <AmountHero>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 }}>
                <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 30, letterSpacing: -0.6, color: "#FFFFFF" }}>PHP</Text>
                <TextInput
                  accessibilityLabel="Payment amount"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  keyboardType="decimal-pad"
                  selectionColor="#41EDA4"
                  style={{ flex: 1, fontFamily: v4Font, fontWeight: "800", fontSize: 30, letterSpacing: -0.6, color: "#FFFFFF", paddingVertical: 0, fontVariant: ["tabular-nums"] }}
                />
              </View>
            </AmountHero>

            <FormCard>
              {!isEdit && !isStatementPayment && !savingsActivityContext ? <TransactionTypeSelector value={txType} onChange={(type) => {
                setTxType(type);
                setIsSavingsContribution(false);
                setSelectedSavingsGoalId(null);
                setSourceAccountId("");
                setDestAccountId("");
                setFormError(null);
              }} /> : null}

              <View style={ui.chips}>
                {QUICK_AMOUNTS.map((quickAmount) => (
                  <Chip
                    key={quickAmount}
                    label={quickAmount.toLocaleString()}
                    selected={amount === String(quickAmount)}
                    onPress={() => setAmount(String(quickAmount))}
                    accessibilityLabel={`Set amount to ${quickAmount.toLocaleString()}`}
                  />
                ))}
              </View>

              <TextField
                label={descriptionLabel}
                value={description}
                onChangeText={setDescription}
                placeholder={descriptionPlaceholder}
                accessibilityLabel={descriptionLabel}
              />

              <PickerField label="Date" value={formatDate(date)} onPress={() => setShowDatePicker(true)} />

              {txType === "transfer" && contributionGoalId ? (
                <SavingsContributionAccounts key={contributionGoalId} userId={userId} goalId={contributionGoalId} transactionId={transaction?.id} accounts={accounts} sourceAccountId={sourceAccountId} onSourceChange={setSourceAccountId} />
              ) : txType === "transfer" && isSavingsContribution ? null : txType === "transfer" ? (
                <>
                  <PickerField
                    label="From account"
                    value={sourceAccountId ? getAccountName(sourceAccountId) : "Select account"}
                    placeholder={!sourceAccountId}
                    error={formError === "Select a source account"}
                    onPress={() => setAccountPickerMode("source")}
                  />
                  <PickerField
                    label="To account"
                    value={destAccountId ? getAccountName(destAccountId) : "Select account"}
                    placeholder={!destAccountId}
                    error={formError === "Select a destination account"}
                    onPress={() => setAccountPickerMode("dest")}
                  />
                </>
              ) : (
                <PickerField
                  label={txType === "income" ? "Destination account" : "Account"}
                  value={getPrimaryAccountLabel()}
                  placeholder={txType === "income" ? !destAccountId : !sourceAccountId}
                  error={formError === "Select a source account" || formError === "Select a destination account"}
                  accessibilityLabel="Select account"
                  onPress={() => setAccountPickerMode(txType === "income" ? "dest" : "source")}
                />
              )}
            </FormCard>

            {selectedSourceIsCreditCard() && !isStatementPayment ? (
              <FormCard title="This is a credit card">
                <Segment
                  options={[{ key: "regular", label: "Regular purchase" }, { key: "installment", label: "Installment" }]}
                  value={creditCardPurchaseType}
                  onChange={setCreditCardPurchaseType}
                  disabled={isEdit}
                />
                {isEdit ? <Note>Purchase type is locked after creation. Installment transactions cannot be converted or edited once billing-cycle amortizations may exist.</Note> : null}
                <View>
                  <PickerField
                    label="Posting date (optional)"
                    value={formatPostingDate()}
                    placeholder={!postingDate}
                    accessibilityLabel="Credit-card posting date"
                    onPress={() => setShowPostingDatePicker(true)}
                  />
                  <Text style={[ui.note, { marginTop: 5, color: v4.mut }]}>
                    Use YYYY-MM-DD when the issuer provides a posting date. Otherwise Budgie uses the transaction date as an estimate.
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
              </FormCard>
            ) : null}

            {!isEdit && !isStatementPayment && !savingsActivityContext && !debtPaymentDebtId && !debtPaymentContext ? (
              <FormCard title="This is a savings contribution" right={<Switch value={isSavingsContribution} accessibilityLabel="This is a savings contribution" onToggle={() => {
                setIsSavingsContribution((current) => !current);
                setTxType("transfer");
                setIsDebtPayment(false);
                setSelectedSavingsGoalId(null);
                setSourceAccountId("");
                setDestAccountId("");
                setFormError(null);
              }} />}>
                <Note>Use available money in the linked account, or transfer money from another account.</Note>
                {isSavingsContribution ? <SavingsContributionGoalPicker userId={userId} goalId={selectedSavingsGoalId} onChange={(id) => {
                  setSelectedSavingsGoalId(id);
                  setSourceAccountId("");
                  setFormError(null);
                }} /> : null}
              </FormCard>
            ) : null}

            {txType === "expense" && !isStatementPayment && !selectedSourceIsCreditCard() ? (
              <FormCard
                title="This is a payment for my debt"
                right={<Switch value={isDebtPayment} disabled={debtLocked} accessibilityLabel="This is a payment for my debt" onToggle={() => { setIsDebtPayment((current) => !current); setDebtPaymentId(""); setDebtPrincipal(""); setDebtInterestOrFees("0"); }} />}
              >
                <Note>Choose this when this expense pays down one of your debts.</Note>
                {isDebtPayment ? (
                  <>
                    <FieldLabel>Debt</FieldLabel>
                    {activeDebts.length === 0 ? (
                      <Note>No active debts are available. Add a debt before recording a debt payment.</Note>
                    ) : (
                      <View accessibilityRole="radiogroup" accessibilityLabel="Select the debt this payment applies to" style={[ui.list, { marginTop: -7 }]}>
                        {activeDebts.map((debt, index) => {
                          const selected = debtPaymentId === debt.id;
                          return (
                            <Pressable
                              key={debt.id}
                              accessibilityRole="radio"
                              accessibilityLabel={`${debt.name}, ${formatCurrency(debt.currentBalanceCentavos)}`}
                              accessibilityState={{ selected, disabled: debtLocked }}
                              disabled={debtLocked}
                              onPress={() => setDebtPaymentId(debt.id)}
                              style={[ui.listRow, index > 0 ? ui.listRowDivider : null, selected ? ui.listRowSelected : null]}
                            >
                              <View style={ui.listRowMain}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text numberOfLines={1} style={[ui.listTitle, selected ? { fontWeight: "700" } : null]}>{debt.name}</Text>
                                  <Text numberOfLines={1} style={ui.listSubtitle}>Balance {formatCurrency(debt.currentBalanceCentavos)}</Text>
                                </View>
                                {selected ? <Check color={v4.brandMid} size={16} weight="bold" /> : null}
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                    <TextField label="Principal" suffix="PHP" accessibilityLabel="Principal amount" value={debtPrincipal} onChangeText={setDebtPrincipal} placeholder="Enter principal amount" keyboardType="decimal-pad" />
                    <TextField label="Interest or fee" suffix="PHP" accessibilityLabel="Interest or fee amount" value={debtInterestOrFees} onChangeText={setDebtInterestOrFees} placeholder="Enter interest or fee amount" keyboardType="decimal-pad" />
                    <Note>Principal reduces the debt balance. Principal plus interest or fees cannot exceed the payment amount.</Note>
                  </>
                ) : null}
              </FormCard>
            ) : null}

            <FormCard>
              {needsCategory ? (
                <View>
                  <PickerField
                    label="Category"
                    icon={
                      <View style={[ui.listTile, { backgroundColor: (categorySelection.tier === "subcategory" ? getSelectedSubcategory()?.color_hex : getSelectedCategory()?.color_hex) ?? DEFAULT_TAXONOMY_COLOR }]}>
                        <TaxonomyIcon iconKey={categorySelection.tier === "subcategory" ? getSelectedSubcategory()?.icon_key : getSelectedCategory()?.icon_key} color="#fff" size={16} weight="fill" />
                      </View>
                    }
                    value={getCategoryFieldLabel()}
                    placeholder={!categorySelection.tier}
                    error={formError === "Select a category"}
                    accessibilityLabel={`Category: ${getCategoryFieldLabel()}. Open full list`}
                    onPress={() => setShowCategoryPicker(true)}
                  />
                  {formError === "Select a category" ? <FieldError>Select a category</FieldError> : null}
                </View>
              ) : null}
              <TextField
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes"
                accessibilityLabel="Notes"
                multiline
                numberOfLines={3}
              />
            </FormCard>


            {formError ? <Banner tone="error">{formError}</Banner> : null}

            <Pressable
              onPress={() => handleSave()}
              disabled={saving}
              style={[ui.button, { opacity: saving ? 0.5 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={isEdit ? "Save changes" : "Save transaction"}
              accessibilityState={{ disabled: saving, busy: saving }}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ui.buttonText}>{isEdit ? "Save Changes" : "Save"}</Text>}
            </Pressable>
          </ScrollView>
        )}

        {renderDatePicker("transaction")}
        {renderDatePicker("posting")}
        {renderAccountPicker()}
        <SavingsExpenseFundingSheet funding={savingsFunding} onCancel={() => setSavingsFunding(null)} onConfirm={(withdrawals) => { setSavingsFunding(null); void handleSave(true, withdrawals); }} />
        <Modal visible={balanceWarning !== null} transparent animationType="fade" onRequestClose={() => setBalanceWarning(null)}>
          <Pressable onPress={() => setBalanceWarning(null)} style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(27,28,26,0.4)" }}>
            <Pressable onPress={() => {}}>
              <View style={{ borderRadius: 20, padding: 20, backgroundColor: v4.surface, gap: 10 }}>
                <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 17, color: v4.ink }}>Insufficient available balance</Text>
                <Text style={{ fontFamily: v4Font, fontSize: 13.5, lineHeight: 20, color: v4.ink2 }}>
                  {balanceWarning?.isCreditCard
                    ? `This transaction exceeds ${balanceWarning.accountName}'s available credit by ${formatCurrency(balanceWarning.deficitCentavos)}.`
                    : `This transaction exceeds ${balanceWarning?.accountName}'s available balance by ${formatCurrency(balanceWarning?.deficitCentavos ?? 0)}.`}
                </Text>
                <Note>
                  Continue recording? The available {balanceWarning?.isCreditCard ? "credit" : "balance"} will be negative.
                </Note>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                  <Pressable onPress={() => setBalanceWarning(null)} accessibilityRole="button" accessibilityLabel="Cancel transaction" style={[ui.button, ui.buttonGhost, { flex: 1 }]}>
                    <Text style={[ui.buttonText, ui.buttonGhostText]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setBalanceWarning(null);
                      handleSave(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm record transaction"
                    style={[ui.button, { flex: 1 }]}
                  >
                    <Text style={ui.buttonText}>Continue</Text>
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
