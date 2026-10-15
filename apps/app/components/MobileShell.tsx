import React, { useEffect } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ArrowsClockwise, CaretLeft, ChartLine, CheckCircle, Cloud, House, ListBullets, Plus, Target, TrashSimple, User, Wallet, type IconProps } from "phosphor-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../lib/api";
import NewTransactionScreen from "../features/ledger/NewTransactionScreen";
import { getTransaction, type Transaction } from "../local-db/repositories/ledger";
import type { UnusualSpendingInsight } from "../local-db/repositories/unusualSpending";
import TransactionHistoryScreen from "../features/ledger/TransactionHistoryScreen";
import PrivacySettingsScreen from "../features/governance/PrivacySettingsScreen";
import TaxonomyScreen from "../features/taxonomy/TaxonomyScreen";
import FinancialAccountsScreen from "../features/financial-accounts/FinancialAccountsScreen";
import IncomeSourcesScreen from "../features/income-sources/IncomeSourcesScreen";
import FinancialObligationsScreen from "../features/financial-obligations/FinancialObligationsScreen";
import RecurringTransactionsScreen, { AddRecurringTransactionScreen } from "../features/recurring-transactions/RecurringTransactionsScreen";
import ShellPlaceholderPage from "./ShellPlaceholderPage";
import FinancialReportsScreen from "../features/reports/FinancialReportsScreen";
import DashboardScreen from "../features/dashboard/DashboardScreen";
import FinancialPlanScreen from "../features/financial-plan/FinancialPlanScreen";
import PastFinancialPlansScreen from "../features/financial-plan/PastFinancialPlansScreen";
import PastFinancialPlanDetailScreen from "../features/financial-plan/PastFinancialPlanDetailScreen";
import DebtManagerScreen from "../features/debt-manager/DebtManagerScreen";
import SavingsGoalsScreen from "../features/savings-goals/SavingsGoalsScreen";
import type { CreditCardPayment, StatementPaymentContext } from "../local-db/repositories/creditCardPayments";
import type { DebtPayment, DebtPaymentContext } from "../local-db/repositories/debtPayments";
import DebtManagerOverview from "../features/debt-manager/DebtManagerOverview";
import NonCreditDebtListScreen from "../features/debt-manager/NonCreditDebtListScreen";
import NonCreditDebtDetailScreen from "../features/debt-manager/NonCreditDebtDetailScreen";
import { useConnectivityStore } from "../services/connectivity";
import { useToast } from "./Toast";
import { runSync } from "../local-db/sync/runSync";
import { initDatabase } from "../local-db/client";
import { cleanupDiscardedSyncRows } from "../local-db/helpers";
import { isOnline } from "../lib/network";

const TOOLBAR_MAX_WIDTH = 430;
const CONTENT_GUTTER = 20;
const SYNC_STATUS_POLL_MS = 5_000;
const AUTO_SYNC_MS = 30_000;
const MAX_SYNC_ATTEMPTS = 3;
const SYNC_ISSUES_PAGE_SIZE = 50;
const LOGOUT_SYNC_MESSAGES = [
  "Hold on, we're trying to sync unsynced changes",
  "Finishing up...",
  "Please wait...",
];

const palette = {
  shell: "#fcf8f0",
  brand: "#013220",
  brandMedium: "#0E6D46",
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  error: "#D9001F",
  success: "#08B16A",
  card: "#F1F0EB",
} as const;

type Page =
  | "dashboard"
  | "transactions"
  | "history"
   | "financial-reports"
   | "financial-plan"
  | "financial-plan-history"
  | "financial-plan-history-detail"
   | "budget-advice"
   | "savings-goals"
  | "insurance"
  | "assistant"
  | "add-transaction"
  | "add-recurring-transaction"
  | "recurring-transactions"
  | "categories"
  | "financial-accounts"
  | "income-sources"
  | "financial-obligations"
   | "debt-manager"
    | "credit-cards"
    | "credit-card-detail"
    | "non-credit-card-debts"
    | "non-credit-card-debt-detail"
  | "settings";

type MobileShellProps = {
  accessToken: string;
  userId: string;
  deviceId: string;
  onLoggedOut: () => void;
  onRequestReassessment?: () => void;
  signOut?: () => Promise<void>;
};

type SyncQueueIssue = {
  operation_id: string;
  entity: string;
  operation_type: string;
  record_id: string;
  failure_message: string;
  status: string;
  attempts: number;
  created_at: string;
  item_label: string | null;
};

type OdinDevTools = {
  seedFailedSyncRows: (count?: number) => Promise<void>;
  ageDiscardedSyncRows: (days?: number) => Promise<void>;
  countDiscardedSyncRows: () => Promise<number>;
};

type GlobalWithOdinDevTools = typeof globalThis & {
  odinDevTools?: OdinDevTools;
};

function formatSyncAction(operationType: string) {
  if (operationType === "create") return "Create";
  if (operationType === "update") return "Update";
  if (operationType === "delete") return "Delete";
  return "Sync";
}

function formatSyncEntity(entity: string) {
  if (entity === "categories") return "Category";
  if (entity === "subcategories") return "Subcategory";
  return entity.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Tab = "home" | "money" | "activity" | "plan";

type HubSegment = { page: Page; label: string };

// Money and Plan group several existing pages behind one tab, switched by segments.
const hubs: Record<"money" | "plan", { title: string; segments: HubSegment[] }> = {
  money: {
    title: "Money",
    segments: [
      { page: "financial-accounts", label: "Accounts" },
      { page: "income-sources", label: "Income" },
      { page: "financial-obligations", label: "Bills" },
      { page: "recurring-transactions", label: "Scheduled" },
    ],
  },
  plan: {
    title: "Plan",
    segments: [
      { page: "financial-plan", label: "Budget" },
      { page: "debt-manager", label: "Debts" },
      { page: "savings-goals", label: "Goals" },
    ],
  },
};

const tabs: { tab: Tab; page: Page; label: string; Icon: React.ComponentType<IconProps> }[] = [
  { tab: "home", page: "dashboard", label: "Home", Icon: House },
  { tab: "money", page: "financial-accounts", label: "Money", Icon: Wallet },
  { tab: "activity", page: "transactions", label: "Activity", Icon: ListBullets },
  { tab: "plan", page: "financial-plan", label: "Plan", Icon: Target },
];

function tabForPage(page: Page): Tab | null {
  if (page === "dashboard") return "home";
  if (page === "transactions") return "activity";
  if (hubs.money.segments.some((segment) => segment.page === page)) return "money";
  if (hubs.plan.segments.some((segment) => segment.page === page)) return "plan";
  return null;
}

// Pages outside the tabs get a back header; anything unlisted goes back to Home.
const parentPage: Partial<Record<Page, Page>> = {
  categories: "settings",
  "credit-cards": "debt-manager",
  "credit-card-detail": "credit-cards",
  "non-credit-card-debts": "debt-manager",
  "non-credit-card-debt-detail": "non-credit-card-debts",
  "financial-plan-history": "financial-plan",
  "financial-plan-history-detail": "financial-plan-history",
};

// These screens draw their own header, so the shell adds no chrome around them.
const fullScreenPages: Page[] = ["add-transaction", "add-recurring-transaction"];

const pageMeta: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Good morning" },
  transactions: { title: "Transactions", subtitle: "Your transaction history" },
  "recurring-transactions": { title: "Recurring Transactions", subtitle: "Manage recurring templates" },
  history: { title: "History", subtitle: "Past activity" },
  "financial-reports": { title: "Financial Reports", subtitle: "Financial outlook and alerts" },
   "budget-advice": { title: "Budgeting", subtitle: "Set up your budget" },
    "financial-plan": { title: "Financial Plan", subtitle: "Plan this month's money" },
  "financial-plan-history": { title: "Past Plans", subtitle: "Completed Financial Plans" },
  "financial-plan-history-detail": { title: "Past Plan", subtitle: "How your plan turned out" },
  "savings-goals": { title: "Savings & Goals", subtitle: "Track your progress" },
  insurance: { title: "Insurance", subtitle: "Coverage overview" },
  assistant: { title: "Assistant", subtitle: "AI-powered help" },
  "add-transaction": { title: "Add Transaction", subtitle: "Record a new entry" },
  "add-recurring-transaction": { title: "Add Recurring Transaction", subtitle: "Create a recurring template" },
  categories: { title: "Categories", subtitle: "Manage your categories" },
  "financial-accounts": { title: "Financial Accounts", subtitle: "Manage your accounts" },
  "income-sources": { title: "Income Sources", subtitle: "Track your income" },
  "financial-obligations": { title: "Obligations", subtitle: "Manage recurring obligations" },
  "debt-manager": { title: "Debt Manager", subtitle: "Credit-card billing cycles" },
  "credit-cards": { title: "Credit Cards", subtitle: "Billing cycles and statements" },
  "credit-card-detail": { title: "Credit Card", subtitle: "Billing cycles and statements" },
  "non-credit-card-debts": { title: "Non Credit Card Debts", subtitle: "Loans and repayment plans" },
  "non-credit-card-debt-detail": { title: "Non Credit Card Debts", subtitle: "Debt details and payments" },
  settings: { title: "Settings", subtitle: "Privacy & Account" },
};

export default function MobileShell({ accessToken, userId, deviceId, onLoggedOut, onRequestReassessment, signOut }: MobileShellProps) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [transactionReturnPage, setTransactionReturnPage] = useState<Page>("dashboard");
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [pendingUnusualSpending, setPendingUnusualSpending] = useState<UnusualSpendingInsight | null>(null);
  const [statementPaymentContext, setStatementPaymentContext] = useState<StatementPaymentContext | null>(null);
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<string | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [selectedPastPlanId, setSelectedPastPlanId] = useState<string | null>(null);
  const [debtPaymentDebtId, setDebtPaymentDebtId] = useState<string | null>(null);
  const [debtPaymentContext, setDebtPaymentContext] = useState<DebtPaymentContext | null>(null);
  const [savingsActivityContext, setSavingsActivityContext] = useState<{ savingsGoalId: string; kind: "contribution" | "withdrawal"; amountCentavos?: number } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const online = useConnectivityStore(state => state.online);
  const { showToast } = useToast();
  const [settingsSubPage, setSettingsSubPage] = useState(false);
  const [deletionSuccessDate, setDeletionSuccessDate] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [syncPending, setSyncPending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [syncDetailsVisible, setSyncDetailsVisible] = useState(false);
  const [syncIssues, setSyncIssues] = useState<SyncQueueIssue[]>([]);
  const [syncIssueTotal, setSyncIssueTotal] = useState(0);
  const [failedIssueTotal, setFailedIssueTotal] = useState(0);
  const [pendingIssueTotal, setPendingIssueTotal] = useState(0);
  const [syncIssuesLoading, setSyncIssuesLoading] = useState(false);
  const [allowDiscardLogout, setAllowDiscardLogout] = useState(false);
  const [logoutAfterDiscard, setLogoutAfterDiscard] = useState(false);
  const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);
  const syncSheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 60) setSyncDetailsVisible(false);
      },
    }),
  ).current;
  const initialSyncDone = useRef(false);
  const wasOnline = useRef(false);
  const syncInFlight = useRef(false);
  const lastAutoSyncAt = useRef(0);
  const lastObservedQueueCount = useRef<number | null>(null);
  const syncMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transactionLoadMoreRef = useRef<(() => void) | null>(null);
  const contentScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!__DEV__) return;

    const global = globalThis as GlobalWithOdinDevTools;
    global.odinDevTools = {
      ...global.odinDevTools,
      seedFailedSyncRows: async (count = 51) => {
        const db = await initDatabase();
        const createdAtBase = Date.now();

        for (let i = 0; i < count; i++) {
          await db.runAsync(
            `INSERT OR IGNORE INTO sync_queue
              (operation_id, user_id, device_id, entity, record_id, operation_type,
               base_version, changed_fields, payload, failure_message, status, attempts, last_error, created_at)
             VALUES (?, ?, ?, 'categories', ?, 'update', 1, '[]', '{}', ?, 'failed', 3, 'Test failed sync row', ?)`,
            `test-failed-${i}`,
            userId,
            deviceId,
            `test-record-${i}`,
            `This category "Test category ${i + 1}" could not be updated.`,
            new Date(createdAtBase + i).toISOString(),
          );
        }

        await refreshQueueCount();
      },
      ageDiscardedSyncRows: async (days = 31) => {
        const db = await initDatabase();
        await db.runAsync(
          "UPDATE sync_queue SET discarded_at = datetime('now', ?) WHERE status = 'discarded'",
          `-${days} days`,
        );
      },
      countDiscardedSyncRows: async () => {
        const db = await initDatabase();
        const row = await db.getFirstAsync<{ cnt: number }>(
          "SELECT COUNT(*) as cnt FROM sync_queue WHERE status = 'discarded'",
        );
        return row?.cnt ?? 0;
      },
    };
  }, [deviceId, userId]);

  useEffect(() => {
    initDatabase()
      .then(cleanupDiscardedSyncRows)
      .catch(() => {});
  }, []);

  function clearSyncMessageSoon() {
    if (syncMessageTimer.current) clearTimeout(syncMessageTimer.current);
    syncMessageTimer.current = setTimeout(() => setSyncMessage(null), 4000);
  }

  function startLogoutSyncMessages() {
    if (syncMessageTimer.current) clearTimeout(syncMessageTimer.current);

    let index = 0;
    const firstMessage = LOGOUT_SYNC_MESSAGES[0]!;
    setSyncMessage(LOGOUT_SYNC_MESSAGES[index] ?? firstMessage);
    const interval = setInterval(() => {
      index = (index + 1) % LOGOUT_SYNC_MESSAGES.length;
      setSyncMessage(LOGOUT_SYNC_MESSAGES[index] ?? firstMessage);
    }, 3_000);

    return () => {
      clearInterval(interval);
      setSyncMessage(null);
    };
  }

  async function refreshQueueCount() {
    const db = await initDatabase();
    await cleanupDiscardedSyncRows(db);
    const row = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status IN ('pending', 'failed')",
      userId,
      deviceId,
    );
    const count = row?.cnt ?? 0;
    if (lastObservedQueueCount.current !== null && lastObservedQueueCount.current !== count) {
      setSyncVersion((value) => value + 1);
    }
    lastObservedQueueCount.current = count;
    setQueueCount(count);
    return count;
  }

  async function countRetryableSyncRows() {
    const db = await initDatabase();
    const row = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM sync_queue
       WHERE user_id = ? AND device_id = ?
         AND status IN ('pending', 'failed') AND attempts < ?`,
      userId,
      deviceId,
      MAX_SYNC_ATTEMPTS,
    );
    return row?.cnt ?? 0;
  }

  async function getRetryableSyncStats() {
    const db = await initDatabase();
    const row = await db.getFirstAsync<{ cnt: number; attempts: number }>(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(attempts), 0) as attempts FROM sync_queue
       WHERE user_id = ? AND device_id = ?
         AND status IN ('pending', 'failed') AND attempts < ?`,
      userId,
      deviceId,
      MAX_SYNC_ATTEMPTS,
    );
    return { count: row?.cnt ?? 0, attempts: row?.attempts ?? 0 };
  }

  async function countExhaustedSyncRows() {
    const db = await initDatabase();
    const row = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status = 'failed' AND attempts >= ?",
      userId,
      deviceId,
      MAX_SYNC_ATTEMPTS,
    );
    return row?.cnt ?? 0;
  }

  async function loadSyncIssues(offset = 0) {
    const db = await initDatabase();
    const totalRow = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status = 'failed' AND attempts >= ?",
      userId,
      deviceId,
      MAX_SYNC_ATTEMPTS,
    );
    const failedRow = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status = 'failed' AND attempts >= ?",
      userId,
      deviceId,
      MAX_SYNC_ATTEMPTS,
    );
    const pendingRow = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status IN ('pending', 'failed') AND attempts < ?",
      userId,
      deviceId,
      MAX_SYNC_ATTEMPTS,
    );
    const rows = await db.getAllAsync<SyncQueueIssue>(
      `SELECT q.operation_id, q.entity, q.operation_type, q.record_id, q.failure_message, q.status, q.attempts, q.created_at,
               COALESCE(c.label, s.label) as item_label
       FROM sync_queue q
       LEFT JOIN categories c ON q.entity = 'categories' AND q.record_id = c.id AND q.user_id = c.user_id
       LEFT JOIN subcategories s ON q.entity = 'subcategories' AND q.record_id = s.id AND q.user_id = s.user_id
       WHERE q.user_id = ? AND q.device_id = ? AND q.status = 'failed' AND q.attempts >= ?
        ORDER BY q.created_at LIMIT ${SYNC_ISSUES_PAGE_SIZE} OFFSET ${Math.max(0, Math.trunc(offset))}`,
      userId,
      deviceId,
      MAX_SYNC_ATTEMPTS,
    );
    const total = totalRow?.cnt ?? 0;
    setSyncIssueTotal(total);
    setFailedIssueTotal(failedRow?.cnt ?? 0);
    setPendingIssueTotal(pendingRow?.cnt ?? 0);
    setQueueCount(total);
    setSyncIssues(current => offset === 0 ? rows : [...current, ...rows]);
    return rows;
  }

  async function loadMoreSyncIssues() {
    if (syncIssuesLoading || syncIssues.length >= syncIssueTotal) return;
    setSyncIssuesLoading(true);
    try {
      await loadSyncIssues(syncIssues.length);
    } finally {
      setSyncIssuesLoading(false);
    }
  }

  async function openSyncDetails(canDiscard = false, shouldLogoutAfterDiscard = false) {
    setSyncIssuesLoading(true);
    await loadSyncIssues();
    setSyncIssuesLoading(false);
    setAllowDiscardLogout(canDiscard);
    setLogoutAfterDiscard(shouldLogoutAfterDiscard);
    setSyncDetailsVisible(true);
  }

  async function syncNow(showMessage: boolean) {
    if (syncInFlight.current || !userId || !deviceId || !accessToken) return null;

    syncInFlight.current = true;
    setSyncing(true);
    if (showMessage) setSyncMessage(null);

    try {
      const online = await isOnline();
      if (!online) {
        if (showMessage) {
          setSyncMessage("No internet connection");
          clearSyncMessageSoon();
        }
        return null;
      }

      lastAutoSyncAt.current = Date.now();
      const result = await runSync(userId, deviceId, accessToken);
      await refreshQueueCount();
      setSyncPending(result.hasMore);

      // A pushed local mutation changes the inputs of an unaccepted plan too.
      if (result.pulled > 0 || result.pushed > 0) setSyncVersion((value) => value + 1);

      if (showMessage && result.errors > 0) {
        setSyncMessage(`${result.errors} item(s) could not be synced`);
        clearSyncMessageSoon();
      }
      return result;
    } catch {
      if (showMessage) {
        setSyncMessage("Sync failed");
        clearSyncMessageSoon();
      }
      return null;
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }

  async function tickSyncStatus() {
    if (!userId || !deviceId || !accessToken) return;

    await refreshQueueCount();
    const retryable = await countRetryableSyncRows();
    const online = await isOnline();
    const reconnected = online && !wasOnline.current;
    const autoSyncDue = Date.now() - lastAutoSyncAt.current >= AUTO_SYNC_MS;

    if (online && (syncPending || (retryable > 0 && (reconnected || autoSyncDue)))) {
      await syncNow(false);
    }

    wasOnline.current = online;
  }

  useEffect(() => {
    if (!userId || !deviceId || !accessToken) return;

    const sync = () => { syncNow(false).catch(() => {}); };

    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      sync();
    }

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => {
      sub.remove();
      if (syncMessageTimer.current) clearTimeout(syncMessageTimer.current);
    };
  }, [userId, deviceId, accessToken]);

  useEffect(() => {
    if (!userId || !deviceId || !accessToken) return;

    tickSyncStatus().catch(() => {});
    const interval = setInterval(() => { tickSyncStatus().catch(() => {}); }, SYNC_STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [userId, deviceId, accessToken, syncPending]);

  async function handleSync() {
    if (await countExhaustedSyncRows() > 0) {
      await openSyncDetails(true);
      return;
    }

    await syncNow(true);
  }

  async function finishLogout() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(`${API_BASE_URL}/odin/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Logout failed: ${response.status}`);

    if (signOut) {
      try { await signOut(); } catch {}
    }

    onLoggedOut();
  }

  async function discardSingleIssue(operationId: string) {
    const db = await initDatabase();
    await db.runAsync(
      "UPDATE sync_queue SET status = 'discarded', discarded_at = ? WHERE operation_id = ? AND user_id = ?",
      new Date().toISOString(),
      operationId,
      userId,
    );
    await refreshQueueCount();
    setSyncIssues((prev) => prev.filter((i) => i.operation_id !== operationId));
    setSyncIssueTotal((prev) => prev - 1);
    const issue = syncIssues.find((i) => i.operation_id === operationId);
    if (issue?.status === "failed") setFailedIssueTotal((prev) => prev - 1);
    else setPendingIssueTotal((prev) => prev - 1);
  }

  async function retrySingleIssue(operationId: string) {
    const db = await initDatabase();
    await db.runAsync(
      "UPDATE sync_queue SET status = 'pending', attempts = 0, last_error = NULL WHERE operation_id = ? AND user_id = ? AND status = 'failed'",
      operationId,
      userId,
    );
    await loadSyncIssues();
  }

  async function discardUnsyncedAndLogout() {
    setIsLoggingOut(true);
    try {
      const db = await initDatabase();
      const pendingRows = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status IN ('pending', 'failed') AND attempts < ?",
        userId,
        deviceId,
        MAX_SYNC_ATTEMPTS,
      );
      if ((pendingRows?.cnt ?? 0) > 0) {
        setDiscardConfirmVisible(false);
        await loadSyncIssues();
        showToast(logoutAfterDiscard ? "New changes are still waiting to sync. Retry before logging out." : "New changes are still waiting to sync. Retry before discarding.");
        setIsLoggingOut(false);
        return;
      }
      await db.runAsync(
        "UPDATE sync_queue SET status = 'discarded', discarded_at = ? WHERE user_id = ? AND device_id = ? AND status = 'failed' AND attempts >= ?",
        new Date().toISOString(),
        userId,
        deviceId,
        MAX_SYNC_ATTEMPTS,
      );
      await refreshQueueCount();
      setDiscardConfirmVisible(false);
      setSyncDetailsVisible(false);
      setSyncIssues([]);
      setSyncIssueTotal(0);
      setFailedIssueTotal(0);
      setPendingIssueTotal(0);
      setAllowDiscardLogout(false);
      setLogoutAfterDiscard(false);
      if (logoutAfterDiscard) {
        await finishLogout();
      } else {
        setIsLoggingOut(false);
      }
    } catch (error) {
      console.error("Discard and logout failed", error);
      showToast(logoutAfterDiscard ? "Logout failed. Please check your connection and try again." : "Discard failed. Please try again.");
      setIsLoggingOut(false);
    }
  }

  async function handleLogout() {
    if (!online) {
      showToast("This action can only be done while online");
      return;
    }
    setIsLoggingOut(true);
    setLogoutError(null);
    let stopLogoutSyncMessages: (() => void) | null = null;

    try {
      const db = await initDatabase();
      const pending = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status IN ('pending', 'failed')",
        userId,
        deviceId,
      );

      if (pending && pending.cnt > 0) {
        const online = await isOnline();
        if (!online) {
          setLogoutError("You have unsynced changes. Connect to the internet and sync before logging out so your data is not lost.");
          setIsLoggingOut(false);
          return;
        }

        stopLogoutSyncMessages = startLogoutSyncMessages();

        let retryable = await getRetryableSyncStats();
        while (retryable.count > 0) {
          await runSync(userId, deviceId, accessToken);
          await refreshQueueCount();

          const nextRetryable = await getRetryableSyncStats();
          if (nextRetryable.count === 0) break;
          if (nextRetryable.count === retryable.count && nextRetryable.attempts === retryable.attempts) break;

          retryable = nextRetryable;
          await sleep(5_000);
        }

        const stillPending = await db.getFirstAsync<{ cnt: number }>(
          "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status IN ('pending', 'failed')",
          userId,
          deviceId,
        );

        stopLogoutSyncMessages();
        stopLogoutSyncMessages = null;

        if (stillPending && stillPending.cnt > 0) {
          const exhaustedRows = await countExhaustedSyncRows();
          if (exhaustedRows > 0) {
            await openSyncDetails(true, true);
          } else {
            setLogoutError("We couldn't finish syncing your changes. Please try again before logging out.");
          }
          setIsLoggingOut(false);
          return;
        }
      }

      await finishLogout();
    } catch (error) {
      stopLogoutSyncMessages?.();
      console.error("Logout request failed", error);
      setLogoutError("Logout failed. Please check your connection and try again.");
      setIsLoggingOut(false);
    }
  }

  const activeTab = tabForPage(currentPage);
  const activeHub = activeTab === "money" || activeTab === "plan" ? hubs[activeTab] : null;
  const isFullScreen = fullScreenPages.includes(currentPage);

  const syncIcon = syncing ? (
    <ActivityIndicator size="small" color={palette.mut} />
  ) : queueCount > 0 ? (
    <ArrowsClockwise size={20} color="#C25E00" weight="bold" />
  ) : (
    <Cloud size={20} color="#0B8A55" weight="bold" />
  );

  const syncButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={queueCount > 0 ? `${queueCount} unsynced changes` : "Synced"}
      onPress={handleSync}
      disabled={syncing}
      hitSlop={8}
    >
      {syncIcon}
    </Pressable>
  );

  function renderPage() {
    if (currentPage === "settings") {
      const syncSection = settingsSubPage ? null : (
        <View>
          <Text style={{ fontSize: 11, fontWeight: "700", color: palette.mut, textTransform: "uppercase", letterSpacing: 0.55, marginBottom: 9 }}>
            Manage
          </Text>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: palette.line, overflow: "hidden", marginBottom: 20 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Categories"
              onPress={() => setCurrentPage("categories")}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 14 }}
            >
              <MaterialCommunityIcons color={palette.ink2} name="tag-outline" size={18} />
              <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: palette.ink }}>Categories</Text>
              <MaterialCommunityIcons color={palette.mut} name="chevron-right" size={20} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, fontWeight: "700", color: palette.mut, textTransform: "uppercase", letterSpacing: 0.55, marginBottom: 9 }}>
            Sync
          </Text>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={queueCount > 0 ? "Sync unsynced changes" : "Synced"}
              disabled={syncing}
              onPress={handleSync}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 14 }}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={palette.mut} />
              ) : queueCount > 0 ? (
                <ArrowsClockwise size={18} color="#C25E00" weight="bold" />
              ) : (
                <Cloud size={18} color="#0B8A55" weight="bold" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: palette.ink }}>
                  {syncing ? "Syncing..." : queueCount > 0 ? `${queueCount} unsynced` : "Synced"}
                </Text>
                {syncMessage ? (
                  <Text style={{ fontSize: 10.5, color: palette.mut, marginTop: 1 }}>
                    {syncMessage}
                  </Text>
                ) : null}
              </View>
              <MaterialCommunityIcons color={palette.mut} name="chevron-right" size={20} />
            </Pressable>
          </View>
        </View>
      );

      return (
        <View>
          <PrivacySettingsScreen accessToken={accessToken} userId={userId} onBackToLogin={handleLogout} onRequestReassessment={onRequestReassessment} onSubPageChange={setSettingsSubPage} onDeleted={setDeletionSuccessDate} beforeDangerZone={syncSection} />
          {!settingsSubPage ? (
            <View style={{ marginTop: 20 }}>
              {logoutError ? (
                <View style={{ backgroundColor: "#FFF0F2", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 13, color: "#D9001F" }}>{logoutError}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log out"
                disabled={isLoggingOut}
                onPress={handleLogout}
                className={`min-h-[54px] rounded-[14px] border border-[#EAEAE6] bg-[#F1F0EB] items-center justify-center ${(!online || isLoggingOut) ? "opacity-50" : "active:opacity-90"}`}
              >
                {isLoggingOut ? (
                  <ActivityIndicator color={palette.error} />
                ) : (
                <Text className="text-[#D9001F] text-base font-bold">Log out</Text>
              )}
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    }

    if (currentPage === "add-transaction") {
      return <NewTransactionScreen userId={userId} deviceId={deviceId} accessToken={accessToken} transaction={transactionToEdit ?? undefined} statementPaymentContext={statementPaymentContext ?? undefined} debtPaymentDebtId={debtPaymentDebtId ?? undefined} debtPaymentContext={debtPaymentContext ?? undefined} savingsActivityContext={savingsActivityContext ?? undefined} onClose={() => { setTransactionToEdit(null); setStatementPaymentContext(null); setDebtPaymentDebtId(null); setDebtPaymentContext(null); setSavingsActivityContext(null); setCurrentPage(transactionReturnPage); }} onCreated={(unusualSpending) => { setTransactionToEdit(null); setStatementPaymentContext(null); setDebtPaymentDebtId(null); setDebtPaymentContext(null); setSavingsActivityContext(null); setPendingUnusualSpending(unusualSpending); setCurrentPage("transactions"); }} />;
    }

    if (currentPage === "add-recurring-transaction") {
      return <AddRecurringTransactionScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("recurring-transactions")} onSyncRequested={handleSync} />;
    }

    if (currentPage === "transactions") {
      return <TransactionHistoryScreen userId={userId} deviceId={deviceId} accessToken={accessToken} unusualSpending={pendingUnusualSpending} onUnusualSpendingDismissed={() => setPendingUnusualSpending(null)} onNewTransaction={() => { setTransactionReturnPage("transactions"); setCurrentPage("add-transaction"); }} onLoadMoreChange={(loadMore) => { transactionLoadMoreRef.current = loadMore; }} />;
    }

    if (currentPage === "recurring-transactions") {
      return <RecurringTransactionsScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("transactions")} onSyncRequested={handleSync} onCreateRequested={() => setCurrentPage("add-recurring-transaction")} />;
    }

    if (currentPage === "categories") {
      return <TaxonomyScreen userId={userId} deviceId={deviceId} syncVersion={syncVersion} onBack={() => setCurrentPage("dashboard")} />;
    }

    if (currentPage === "financial-accounts") {
      return <FinancialAccountsScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("dashboard")} onSyncRequested={handleSync} />;
    }

    if (currentPage === "income-sources") {
      return <IncomeSourcesScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("dashboard")} onSyncRequested={handleSync} />;
    }

    if (currentPage === "financial-obligations") {
      return <FinancialObligationsScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("dashboard")} onSyncRequested={handleSync} />;
    }

    if (currentPage === "debt-manager") {
      return <DebtManagerOverview userId={userId} onOpenCreditCards={() => setCurrentPage("credit-cards")} onOpenNonCreditDebts={() => setCurrentPage("non-credit-card-debts")} />;
    }

    if (currentPage === "credit-cards") {
      return <DebtManagerScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("debt-manager")} onOpenCard={(accountId) => { setSelectedCreditCardId(accountId); setCurrentPage("credit-card-detail"); }} />;
    }

    if (currentPage === "credit-card-detail" && selectedCreditCardId) {
      return <DebtManagerScreen userId={userId} deviceId={deviceId} accountId={selectedCreditCardId} onBack={() => setCurrentPage("credit-cards")} onPayStatement={(context) => { setStatementPaymentContext(context); setTransactionToEdit(null); setTransactionReturnPage("credit-card-detail"); setCurrentPage("add-transaction"); }} onEditPayment={async (payment: CreditCardPayment) => { const transaction = await getTransaction(userId, payment.transaction_id); if (!transaction) return; setStatementPaymentContext({ statementId: payment.statement_id, cycleId: payment.cycle_id }); setTransactionToEdit(transaction); setTransactionReturnPage("credit-card-detail"); setCurrentPage("add-transaction"); }} />;
    }

    if (currentPage === "non-credit-card-debts") {
      return <NonCreditDebtListScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("debt-manager")} onOpenDebt={(debtId) => { setSelectedDebtId(debtId); setCurrentPage("non-credit-card-debt-detail"); }} />;
    }

    if (currentPage === "non-credit-card-debt-detail" && selectedDebtId) {
      return <NonCreditDebtDetailScreen userId={userId} deviceId={deviceId} debtId={selectedDebtId} onBack={() => setCurrentPage("non-credit-card-debts")} onRecordPayment={(debtId) => { setDebtPaymentDebtId(debtId); setDebtPaymentContext(null); setStatementPaymentContext(null); setTransactionToEdit(null); setTransactionReturnPage("non-credit-card-debt-detail"); setCurrentPage("add-transaction"); }} onEditPayment={async (payment: DebtPayment) => { const transaction = await getTransaction(userId, payment.transaction_id); if (!transaction) return; setDebtPaymentDebtId(null); setDebtPaymentContext({ paymentId: payment.id, debtAccountId: payment.debt_account_id }); setStatementPaymentContext(null); setTransactionToEdit(transaction); setTransactionReturnPage("non-credit-card-debt-detail"); setCurrentPage("add-transaction"); }} />;
    }

    if (currentPage === "financial-plan") {
      return <FinancialPlanScreen userId={userId} deviceId={deviceId} accessToken={accessToken} syncVersion={syncVersion} onSyncRequested={handleSync} onOpenPastPlans={() => setCurrentPage("financial-plan-history")} />;
    }

    if (currentPage === "financial-plan-history") {
      return <PastFinancialPlansScreen userId={userId} onOpenPlan={(planId) => { setSelectedPastPlanId(planId); setCurrentPage("financial-plan-history-detail"); }} />;
    }

    if (currentPage === "financial-plan-history-detail" && selectedPastPlanId) {
      return <PastFinancialPlanDetailScreen userId={userId} planId={selectedPastPlanId} onBack={() => setCurrentPage("financial-plan-history")} />;
    }

    if (currentPage === "savings-goals") {
      return <SavingsGoalsScreen userId={userId} deviceId={deviceId} syncVersion={syncVersion} onRecordActivity={(savingsGoalId, kind) => { setSavingsActivityContext({ savingsGoalId, kind }); setTransactionToEdit(null); setStatementPaymentContext(null); setTransactionReturnPage("savings-goals"); setCurrentPage("add-transaction"); }} onOpenTransaction={(transactionId) => { getTransaction(userId, transactionId).then((transaction) => { if (!transaction) return; setSavingsActivityContext(null); setStatementPaymentContext(null); setTransactionToEdit(transaction); setTransactionReturnPage("savings-goals"); setCurrentPage("add-transaction"); }).catch(() => {}); }} />;
    }


    if (currentPage === "dashboard") {
      return <DashboardScreen userId={userId} deviceId={deviceId} accessToken={accessToken} onNavigate={setCurrentPage as (page: string) => void} />;
    }

    if (currentPage === "financial-reports") {
      return <FinancialReportsScreen userId={userId} deviceId={deviceId} accessToken={accessToken} />;
    }

    const meta = pageMeta[currentPage] ?? pageMeta.dashboard;
    return <ShellPlaceholderPage title={meta.title} subtitle={meta.subtitle} />;
  }

  return (
    <View className="flex-1">
      <SafeAreaView style={{ backgroundColor: palette.shell }} className="flex-1">
        {isFullScreen ? (
          <View style={{ flex: 1 }}>
            {renderPage()}
          </View>
        ) : (
          <>
        {activeTab ? (
          /* Top bar: profile and sync, logo, notifications */
          <View style={{ backgroundColor: palette.shell, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 11 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile and settings"
                onPress={() => setCurrentPage("settings")}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center" }}
              >
                <User size={16} color="#FFFFFF" weight="bold" />
              </Pressable>
              {syncButton}
            </View>
            <Image
              source={require("../assets/odin-logo.png")}
              accessibilityLabel="Budgie logo"
              style={{ width: 68, height: 22, resizeMode: "contain" }}
            />
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Financial reports"
                onPress={() => setCurrentPage("financial-reports")}
                hitSlop={8}
              >
                <ChartLine size={20} color={palette.ink} />
              </Pressable>
            </View>
          </View>
        ) : (
          /* Inner header: back, title, sync */
          <View style={{ backgroundColor: palette.shell, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => setCurrentPage(parentPage[currentPage] ?? "dashboard")}
              hitSlop={10}
            >
              <CaretLeft size={20} color={palette.ink2} weight="bold" />
            </Pressable>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: "Manrope", fontSize: 16.5, fontWeight: "800", letterSpacing: -0.16, color: palette.ink }}>
              {(pageMeta[currentPage] ?? pageMeta.dashboard).title}
            </Text>
            {syncButton}
          </View>
        )}

        {/* Content */}
        <ScrollView
          className="flex-1"
          contentContainerClassName={activeTab ? "pb-24" : "pb-8"}
          contentContainerStyle={{ paddingHorizontal: CONTENT_GUTTER }}
          keyboardShouldPersistTaps="handled"
          onScroll={({ nativeEvent }) => {
            const distanceFromBottom = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
            if (currentPage === "transactions" && distanceFromBottom < 200) transactionLoadMoreRef.current?.();
          }}
          scrollEventThrottle={16}
          ref={contentScrollRef}
          // The hub title scrolls away; the segment row (child 1) stays pinned.
          stickyHeaderIndices={activeHub ? [1] : undefined}
        >
          {activeHub ? (
            <Text style={{ marginTop: 6, fontFamily: "Manrope", fontSize: 22, fontWeight: "800", letterSpacing: -0.22, color: palette.ink }}>
              {activeHub.title}
            </Text>
          ) : null}
          {activeHub ? (
            // Bleeds into the content gutters so scrolled content never shows beside the pinned row.
            <View style={{ backgroundColor: palette.shell, marginHorizontal: -CONTENT_GUTTER, paddingHorizontal: CONTENT_GUTTER, paddingTop: 12, marginBottom: 16 }}>
              <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: palette.line }}>
                {activeHub.segments.map((segment) => {
                  const selected = currentPage === segment.page;
                  return (
                    <Pressable
                      key={segment.page}
                      accessibilityRole="tab"
                      accessibilityLabel={segment.label}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        contentScrollRef.current?.scrollTo({ y: 0, animated: false });
                        setCurrentPage(segment.page);
                      }}
                      style={{ flex: 1, alignItems: "center", paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: selected ? palette.brand : "transparent" }}
                    >
                      <Text style={{ fontFamily: "Manrope", fontSize: 13, fontWeight: selected ? "700" : "600", color: selected ? palette.brand : palette.mut }}>
                        {segment.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {renderPage()}
        </ScrollView>

        {/* Bottom tab bar */}
        {activeTab ? (
          <View className="absolute bottom-0 left-0 right-0 items-center">
            <View
              style={{ maxWidth: TOOLBAR_MAX_WIDTH, backgroundColor: palette.shell, paddingBottom: bottomInset + 8, minHeight: 62 + bottomInset }}
              className="w-full px-6 pt-[7px] flex-row items-start justify-between border-t border-[#EAEAE6]"
            >
              {tabs.flatMap(({ tab, page, label, Icon }, index) => {
                const selected = activeTab === tab;
                const button = (
                  <Pressable
                    key={tab}
                    onPress={() => setCurrentPage(page)}
                    accessibilityRole="tab"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    style={{ width: 44, height: 36, alignItems: "center", justifyContent: "center" }}
                  >
                    {selected ? (
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center" }}>
                        <Icon size={20} color="#FFFFFF" weight="fill" />
                      </View>
                    ) : (
                      <Icon size={22} color={palette.mut} />
                    )}
                  </Pressable>
                );
                if (index !== 2) return [button];
                return [
                  <Pressable
                    key="add"
                    onPress={() => { setTransactionReturnPage(currentPage); setCurrentPage("add-transaction"); }}
                    accessibilityRole="button"
                    accessibilityLabel="Add transaction"
                    className="w-[50px] h-[50px] rounded-full items-center justify-center -mt-[22px]"
                    style={{
                      backgroundColor: palette.brand,
                      shadowColor: "#013220",
                      shadowOpacity: 0.3,
                      shadowRadius: 18,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 6,
                    }}
                  >
                    <Plus size={23} color="white" weight="bold" />
                  </Pressable>,
                  button,
                ];
              })}
            </View>
          </View>
        ) : null}
          </>
        )}

        {deletionSuccessDate ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.shell, paddingHorizontal: 30, justifyContent: "center", alignItems: "center" }}>
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "#EFFEF7", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
              <CheckCircle size={56} color={palette.success} weight="fill" />
            </View>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: palette.ink }}>
              Deletion requested
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "400", fontSize: 14, lineHeight: 22.4, color: palette.mut, marginTop: 10, textAlign: "center", maxWidth: 270 }}>
              Your account is scheduled for deletion. You have{" "}
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: palette.ink2 }}>30 days</Text>
              {" "}to cancel by logging back in. After that, all data is permanently erased.
            </Text>
            <View style={{ width: "100%", marginTop: 26, padding: 16, borderRadius: 14, backgroundColor: "#F8EFDC", borderWidth: 1, borderColor: palette.line }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12.5, color: palette.mut }}>
                  Scheduled deletion
                </Text>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.ink }}>
                  {new Date(deletionSuccessDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
              style={{
                width: "100%", marginTop: 26, height: 52, borderRadius: 14,
                backgroundColor: palette.brand,
                justifyContent: "center", alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14.5, color: "#FFFFFF" }}>
                Back to login
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Modal visible={syncDetailsVisible} transparent animationType="slide" presentationStyle="overFullScreen" onDismiss={() => setSyncDetailsVisible(false)} onRequestClose={() => setSyncDetailsVisible(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.38)", justifyContent: "flex-end" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close sync details" onPress={() => setSyncDetailsVisible(false)} style={{ flex: 1 }} />
            <View style={{ backgroundColor: palette.shell, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, maxHeight: "78%" }}>
              <View {...syncSheetPanResponder.panHandlers} style={{ paddingVertical: 8, marginTop: -8, marginBottom: 10 }}>
                <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center" }} />
              </View>
              <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>
                Unsynced changes
              </Text>
              <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 6 }}>
                We are sorry, we ran into a problem and cannot sync these changes. The only option is to discard them, then recreate them if needed.
              </Text>

              <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: palette.mut, marginTop: 10 }}>
                Showing {syncIssues.length} of {syncIssueTotal} changes
              </Text>

              <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 10 }}>
                {syncIssues.length === 0 ? (
                  <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut }}>
                    No unsynced changes found.
                  </Text>
                ) : syncIssues.map((issue) => (
                  <View key={issue.operation_id} style={{ borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, padding: 12 }}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13.5, color: palette.ink }}>
                      {formatSyncAction(issue.operation_type)} {issue.item_label ?? formatSyncEntity(issue.entity)} {issue.status === "failed" ? "Failed" : "Waiting"}
                    </Text>
                    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: palette.mut, marginTop: 3 }}>
                      {issue.status === "failed" ? issue.failure_message : "This change is waiting to sync."}
                    </Text>
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8 }}>
                      {issue.status === "failed" ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Retry this change"
                          onPress={() => { retrySingleIssue(issue.operation_id).catch(() => {}); }}
                          hitSlop={4}
                          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: palette.card }}
                        >
                          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: palette.ink2 }}>
                            Retry
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Discard this change"
                        onPress={() => { discardSingleIssue(issue.operation_id); }}
                        hitSlop={4}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#FFF0F2" }}
                      >
                        <TrashSimple size={12} color={palette.error} />
                        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: palette.error }}>
                          Discard
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {syncIssues.length < syncIssueTotal ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Load more unsynced changes"
                  disabled={syncIssuesLoading}
                  onPress={() => { loadMoreSyncIssues().catch(() => {}); }}
                  style={{ minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center", marginTop: 10 }}
                >
                  {syncIssuesLoading ? (
                    <ActivityIndicator color={palette.mut} />
                  ) : (
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: palette.ink2 }}>Load more</Text>
                  )}
                </Pressable>
              ) : null}

              <View style={{ gap: 10, marginTop: 18 }}>
                {allowDiscardLogout && failedIssueTotal > 0 && pendingIssueTotal === 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={logoutAfterDiscard ? "Discard failed changes and log out" : "Discard failed changes"}
                    onPress={() => setDiscardConfirmVisible(true)}
                    style={{ minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: "#FFCDD2", backgroundColor: "#FFF0F2", alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: palette.error }}>
                      Discard {failedIssueTotal} failed change{failedIssueTotal === 1 ? "" : "s"}{logoutAfterDiscard ? " and log out" : ""}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close sync details"
                  onPress={() => setSyncDetailsVisible(false)}
                  style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={discardConfirmVisible} transparent animationType="fade" onRequestClose={() => setDiscardConfirmVisible(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
            <View style={{ borderRadius: 20, backgroundColor: palette.shell, padding: 20 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 19, color: palette.ink }}>
                Discard failed changes?
              </Text>
              <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8 }}>
                This will discard all {failedIssueTotal} failed local change{failedIssueTotal === 1 ? "" : "s"}, not just the changes currently shown. This cannot be undone. Recreate anything you still need.
              </Text>
              <View style={{ gap: 10, marginTop: 18 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={logoutAfterDiscard ? "Confirm discard failed changes and log out" : "Confirm discard failed changes"}
                  disabled={isLoggingOut}
                  onPress={discardUnsyncedAndLogout}
                  style={{ minHeight: 50, borderRadius: 14, backgroundColor: palette.error, alignItems: "center", justifyContent: "center" }}
                >
                  {isLoggingOut ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#fff" }}>
                      Discard {failedIssueTotal}{logoutAfterDiscard ? " and log out" : ""}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel discard"
                  onPress={() => setDiscardConfirmVisible(false)}
                  style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
