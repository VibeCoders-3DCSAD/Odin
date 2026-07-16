import React, { useEffect } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ArrowsClockwise, CheckCircle, Cloud, SquaresFour, ClockCounterClockwise, Plus, Pulse, Wallet } from "phosphor-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../lib/api";
import PrivacySettingsScreen from "../features/governance/PrivacySettingsScreen";
import TaxonomyScreen from "../features/taxonomy/TaxonomyScreen";
import FinancialAccountsScreen from "../features/financial-accounts/FinancialAccountsScreen";
import IncomeSourcesScreen from "../features/income-sources/IncomeSourcesScreen";
import FinancialObligationsScreen from "../features/financial-obligations/FinancialObligationsScreen";
import ShellPlaceholderPage from "./ShellPlaceholderPage";
import { useConnectivityStore } from "../services/connectivity";
import { useToast } from "./Toast";
import { runSync } from "../local-db/sync/runSync";
import { initDatabase } from "../local-db/client";
import { cleanupDiscardedSyncRows } from "../local-db/helpers";
import { isOnline } from "../lib/network";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.8);
const TOOLBAR_MAX_WIDTH = 430;
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
  | "spending-forecast"
  | "anomaly-alerts"
  | "budget-advice"
  | "savings-goals"
  | "debt-manager"
  | "insurance"
  | "assistant"
  | "add-transaction"
  | "categories"
  | "financial-accounts"
  | "income-sources"
  | "financial-obligations"
  | "settings";

type MobileShellProps = {
  accessToken: string;
  userId: string;
  deviceId: string;
  onLoggedOut: () => void;
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
  if (entity === "category_groups") return "Category Group";
  if (entity === "categories") return "Category";
  if (entity === "subcategories") return "Subcategory";
  return entity.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type DrawerItem = {
  page: Page;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  badge?: string;
};

type DrawerSection = {
  label: string;
  items: DrawerItem[];
};

const drawerSections: DrawerSection[] = [
  {
    label: "Overview",
    items: [
      { page: "dashboard", icon: "view-dashboard-outline", label: "Dashboard" },
      { page: "financial-accounts", icon: "wallet-outline", label: "Financial Accounts" },
      { page: "income-sources", icon: "cash-multiple", label: "Income Sources" },
      { page: "financial-obligations", icon: "calendar-check-outline", label: "Obligations" },
      { page: "categories", icon: "tag-outline", label: "Categories" },
      { page: "transactions", icon: "swap-horizontal-bold", label: "Transactions" },
      { page: "history", icon: "clock-outline", label: "History" },
      { page: "settings", icon: "cog-outline", label: "Settings" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { page: "spending-forecast", icon: "chart-timeline-variant", label: "Spending Forecast" },
      { page: "anomaly-alerts", icon: "alert-outline", label: "Anomaly Alerts", badge: "3" },
      { page: "budget-advice", icon: "message-text-outline", label: "Budget Advice" },
    ],
  },
  {
    label: "Wealth",
    items: [
      { page: "savings-goals", icon: "wallet-outline", label: "Savings & Goals" },
      { page: "debt-manager", icon: "credit-card-remove-outline", label: "Debt Manager" },
      { page: "insurance", icon: "shield-outline", label: "Insurance" },
    ],
  },
];

const pageMeta: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Good morning" },
  transactions: { title: "Transactions", subtitle: "Your transaction history" },
  history: { title: "History", subtitle: "Past activity" },
  "spending-forecast": { title: "Spending Forecast", subtitle: "Predictive insights" },
  "anomaly-alerts": { title: "Anomaly Alerts", subtitle: "Unusual activity detected" },
  "budget-advice": { title: "Budget Advice", subtitle: "Smart suggestions" },
  "savings-goals": { title: "Savings & Goals", subtitle: "Track your progress" },
  "debt-manager": { title: "Debt Manager", subtitle: "Manage liabilities" },
  insurance: { title: "Insurance", subtitle: "Coverage overview" },
  assistant: { title: "Assistant", subtitle: "AI-powered help" },
  "add-transaction": { title: "Add Transaction", subtitle: "Record a new entry" },
  categories: { title: "Categories", subtitle: "Manage your categories" },
  "financial-accounts": { title: "Financial Accounts", subtitle: "Manage your accounts" },
  "income-sources": { title: "Income Sources", subtitle: "Track your income" },
  "financial-obligations": { title: "Obligations", subtitle: "Manage recurring obligations" },
  settings: { title: "Settings", subtitle: "Privacy & Account" },
};

export default function MobileShell({ accessToken, userId, deviceId, onLoggedOut, signOut }: MobileShellProps) {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const online = useConnectivityStore(state => state.online);
  const { showToast } = useToast();
  const [settingsSubPage, setSettingsSubPage] = useState(false);
  const [deletionSuccessDate, setDeletionSuccessDate] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
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
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const hamburgerAnim = useRef(new Animated.Value(0)).current;
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
  const syncMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
              COALESCE(c.label, s.label, g.label) as item_label
       FROM sync_queue q
       LEFT JOIN categories c ON q.entity = 'categories' AND q.record_id = c.id AND q.user_id = c.user_id
       LEFT JOIN subcategories s ON q.entity = 'subcategories' AND q.record_id = s.id AND q.user_id = s.user_id
       LEFT JOIN category_groups g ON q.entity = 'category_groups' AND q.record_id = g.id AND q.user_id = g.user_id
       WHERE q.user_id = ? AND q.device_id = ? AND q.status = 'failed' AND q.attempts >= ?
       ORDER BY q.created_at LIMIT ? OFFSET ?`,
      userId,
      deviceId,
      MAX_SYNC_ATTEMPTS,
      SYNC_ISSUES_PAGE_SIZE,
      offset,
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
    if (syncInFlight.current || !userId || !deviceId || !accessToken) return;

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
        return;
      }

      lastAutoSyncAt.current = Date.now();
      const result = await runSync(userId, deviceId, accessToken, { maxAttempts: MAX_SYNC_ATTEMPTS });
      await refreshQueueCount();

      if (showMessage && result.errors > 0) {
        setSyncMessage(`${result.errors} item(s) could not be synced`);
        clearSyncMessageSoon();
      }
    } catch {
      if (showMessage) {
        setSyncMessage("Sync failed");
        clearSyncMessageSoon();
      }
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

    if (online && retryable > 0 && (reconnected || autoSyncDue)) {
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
  }, [userId, deviceId, accessToken]);

  function openDrawer() {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(hamburgerAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  function closeDrawer() {
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(hamburgerAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  }

  function navigate(page: Page) {
    setCurrentPage(page);
    closeDrawer();
  }

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
          await runSync(userId, deviceId, accessToken, { maxAttempts: MAX_SYNC_ATTEMPTS });
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

  const isActive = (page: Page) => currentPage === page;

  function renderPage() {
    if (currentPage === "settings") {
      const syncSection = settingsSubPage ? null : (
        <View>
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
          <PrivacySettingsScreen accessToken={accessToken} userId={userId} onBackToLogin={handleLogout} onSubPageChange={setSettingsSubPage} onDeleted={setDeletionSuccessDate} beforeDangerZone={syncSection} />
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

    if (currentPage === "categories") {
      return <TaxonomyScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("dashboard")} />;
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

    const meta = pageMeta[currentPage];
    return <ShellPlaceholderPage title={meta.title} subtitle={meta.subtitle} />;
  }

  return (
    <View className="flex-1">
      <SafeAreaView style={{ backgroundColor: palette.shell }} className="flex-1">
        {/* Top bar */}
        <View style={{ backgroundColor: palette.shell }} className="px-5 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open navigation menu"
              onPress={drawerOpen ? closeDrawer : openDrawer}
              className="w-10 h-10 items-center justify-center"
            >
              <View className="w-[18px] h-[18px] items-center justify-center gap-[3px]">
                <Animated.View
                  style={{
                    width: 18, height: 2, borderRadius: 2, backgroundColor: palette.ink,
                    transform: [
                      { translateY: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
                      { rotate: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) },
                    ],
                  }}
                />
                <Animated.View
                  style={{
                    width: 18, height: 2, borderRadius: 2, backgroundColor: palette.ink,
                    opacity: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  }}
                />
                <Animated.View
                  style={{
                    width: 18, height: 2, borderRadius: 2, backgroundColor: palette.ink,
                    transform: [
                      { translateY: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
                      { rotate: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-45deg"] }) },
                    ],
                  }}
                />
              </View>
            </Pressable>
            <Image
              source={require("../assets/odin-logo.png")}
              accessibilityLabel="Odin logo"
              style={{ width: 68, height: 24, resizeMode: "contain" }}
            />
          </View>
          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons color={palette.ink2} name="magnify" size={20} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={queueCount > 0 ? `${queueCount} unsynced changes` : "Synced"}
              onPress={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={palette.mut} />
              ) : queueCount > 0 ? (
                <ArrowsClockwise size={20} color="#C25E00" weight="bold" />
              ) : (
                <Cloud size={20} color="#0B8A55" weight="bold" />
              )}
            </Pressable>
            <View className="relative">
              <MaterialCommunityIcons color={palette.ink2} name="bell-outline" size={20} />
              <View className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#ba1a1a] rounded-full" />
            </View>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-24"
          keyboardShouldPersistTaps="handled"
        >
          {renderPage()}
        </ScrollView>

        {/* Bottom toolbar */}
        <View className="absolute bottom-0 left-0 right-0 items-center">
          <View
            style={{ maxWidth: TOOLBAR_MAX_WIDTH, backgroundColor: palette.shell }}
            className="w-full px-6 pt-2 pb-[6px] flex-row items-end justify-between border-t border-[#EAEAE6]"
          >
            <Pressable
              onPress={() => setCurrentPage("dashboard")}
              accessibilityRole="button"
              accessibilityLabel="Home"
              accessibilityState={{ selected: isActive("dashboard") }}
              className="items-center gap-[3px]"
            >
              <SquaresFour
                size={21}
                color={isActive("dashboard") ? palette.brand : palette.mut}
                weight={isActive("dashboard") ? "fill" : "regular"}
              />
              <Text
                style={{ fontSize: 9.5, fontWeight: isActive("dashboard") ? "600" : "500", color: isActive("dashboard") ? palette.brand : palette.mut }}
              >
                Home
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCurrentPage("history")}
              accessibilityRole="button"
              accessibilityLabel="History"
              accessibilityState={{ selected: isActive("history") }}
              className="items-center gap-[3px]"
            >
              <ClockCounterClockwise
                size={21}
                color={isActive("history") ? palette.brand : palette.mut}
                weight={isActive("history") ? "fill" : "regular"}
              />
              <Text
                style={{ fontSize: 9.5, fontWeight: isActive("history") ? "600" : "500", color: isActive("history") ? palette.brand : palette.mut }}
              >
                History
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCurrentPage("add-transaction")}
              accessibilityRole="button"
              accessibilityLabel="Add transaction"
              className="w-[50px] h-[50px] rounded-full items-center justify-center -mt-[22px]"
              style={{
                backgroundColor: palette.brand,
                shadowColor: "#013220",
                shadowOpacity: 0.3,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
              }}
            >
              <Plus size={24} color="white" weight="bold" />
            </Pressable>

            <Pressable
              onPress={() => setCurrentPage("assistant")}
              accessibilityRole="button"
              accessibilityLabel="Assistant"
              accessibilityState={{ selected: isActive("assistant") }}
              className="items-center gap-[3px]"
            >
              <Pulse
                size={21}
                color={isActive("assistant") ? palette.brand : palette.mut}
                weight={isActive("assistant") ? "fill" : "regular"}
              />
              <Text
                style={{ fontSize: 9.5, fontWeight: isActive("assistant") ? "600" : "500", color: isActive("assistant") ? palette.brand : palette.mut }}
              >
                Assistant
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCurrentPage("savings-goals")}
              accessibilityRole="button"
              accessibilityLabel="Savings"
              accessibilityState={{ selected: isActive("savings-goals") }}
              className="items-center gap-[3px]"
            >
              <Wallet
                size={21}
                color={isActive("savings-goals") ? palette.brand : palette.mut}
                weight={isActive("savings-goals") ? "fill" : "regular"}
              />
              <Text
                style={{ fontSize: 9.5, fontWeight: isActive("savings-goals") ? "600" : "500", color: isActive("savings-goals") ? palette.brand : palette.mut }}
              >
                Savings
              </Text>
            </Pressable>
          </View>
        </View>

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
                    <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: palette.mut, marginTop: 5 }}>
                      Discard this change, then recreate it if needed.
                    </Text>
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

      {/* Drawer overlay - rendered last to sit above everything */}
      {drawerOpen ? (
        <Animated.View
          style={{ opacity: overlayAnim }}
          className="absolute inset-0 bg-black/40"
        >
          <Pressable className="flex-1" onPress={closeDrawer} />
        </Animated.View>
      ) : null}

      {/* Drawer */}
      {drawerOpen ? (
        <Animated.View
          style={{ transform: [{ translateX: drawerAnim }], backgroundColor: palette.brand }}
          className="absolute top-0 left-0 bottom-0"
        >
          <View style={{ width: DRAWER_WIDTH }} className="flex-1 py-8 px-6">
            {/* Drawer header */}
            <View className="flex-row items-center gap-3 mb-10">
              <Image
                source={require("../assets/odin-logo.png")}
                accessibilityLabel="Odin logo"
                style={{ width: 32, height: 32, resizeMode: "contain" }}
              />
              <View>
                <Text className="text-white text-xl font-semibold">Odin</Text>
                <Text className="text-white/45 text-[10px] uppercase tracking-widest">Personal Finance</Text>
              </View>
            </View>

            {/* Drawer sections */}
            {drawerSections.map((section) => (
              <View key={section.label} className="mb-8">
                <Text className="text-white/30 text-[10px] font-medium uppercase tracking-widest px-4 mb-2">
                  {section.label}
                </Text>
                <View className="gap-[2px]">
                  {section.items.map((item) => {
                    const active = currentPage === item.page;
                    return (
                      <Pressable
                        key={item.page}
                        onPress={() => navigate(item.page)}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        accessibilityState={{ selected: active }}
                        className={`flex-row items-center gap-3 px-4 py-3 rounded-xl ${
                          active ? "bg-white/12" : ""
                        }`}
                      >
                        <MaterialCommunityIcons
                          color={active ? "white" : "rgba(255,255,255,0.6)"}
                          name={item.icon}
                          size={20}
                        />
                        <Text
                          className={`flex-1 text-sm ${
                            active ? "text-white font-medium" : "text-white/60"
                          }`}
                        >
                          {item.label}
                        </Text>
                        {item.badge ? (
                          <View className="bg-[#ba1a1a]/80 rounded-full px-[7px] py-[2px]">
                            <Text className="text-white text-[10px] font-semibold">{item.badge}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Drawer footer - profile */}
            <View className="mt-auto pt-6">
              <View className="flex-row items-center gap-3 px-4 py-3 rounded-xl">
                <View className="w-9 h-9 rounded-full bg-[#0a7c5a] items-center justify-center">
                  <Text className="text-white text-xs font-semibold">CT</Text>
                </View>
                <View>
                  <Text className="text-white/90 text-xs font-medium">Charles Togle</Text>
                  <Text className="text-white/40 text-[10px]">Stable-Obligated</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
