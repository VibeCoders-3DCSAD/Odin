import React, { useEffect } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CheckCircle, SquaresFour, ClockCounterClockwise, Plus, Pulse, Wallet, Cloud, ArrowsClockwise } from "phosphor-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../lib/api";
import PrivacySettingsScreen from "../features/governance/PrivacySettingsScreen";
import TaxonomyScreen from "../features/taxonomy/TaxonomyScreen";
import ShellPlaceholderPage from "./ShellPlaceholderPage";
import { useConnectivityStore } from "../services/connectivity";
import { useToast } from "./Toast";
import { runSync } from "../local-db/sync/runSync";
import { initDatabase } from "../local-db/client";
import { isOnline } from "../lib/network";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.8);
const TOOLBAR_MAX_WIDTH = 430;

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
  | "settings";

type MobileShellProps = {
  accessToken: string;
  userId: string;
  deviceId: string;
  onLoggedOut: () => void;
  signOut?: () => Promise<void>;
};

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
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const hamburgerAnim = useRef(new Animated.Value(0)).current;
  const initialSyncDone = useRef(false);
  const wasOnline = useRef(false);

  useEffect(() => {
    console.log("[sync] MobileShell — userId:", !!userId, "deviceId:", !!deviceId, "accessToken:", !!accessToken);
    if (!userId || !deviceId || !accessToken) return;

    const sync = () => { runSync(userId, deviceId, accessToken).catch(() => {}); };

    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      console.log("[sync] MobileShell — initial sync trigger");
      sync();
    }

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        console.log("[sync] MobileShell — app back to foreground, syncing");
        sync();
      }
    });

    return () => sub.remove();
  }, [userId, deviceId, accessToken]);

  useEffect(() => {
    if (!userId || !deviceId || !accessToken) return;

    const refreshQueueCount = async () => {
      const db = await initDatabase();
      const row = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status = 'pending'",
        userId,
        deviceId,
      );
      setQueueCount(row?.cnt ?? 0);
    };

    const poll = async () => {
      await refreshQueueCount();
      const online = await isOnline();
      if (online && !wasOnline.current) {
        runSync(userId, deviceId, accessToken).catch(() => {});
      }
      wasOnline.current = online;
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [userId, deviceId, accessToken]);

  useEffect(() => {
    if (!userId || !deviceId || !accessToken) return;

    const autoSync = async () => {
      const online = await isOnline();
      if (!online) return;
      const db = await initDatabase();
      const row = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status = 'pending'",
        userId,
        deviceId,
      );
      const cnt = row?.cnt ?? 0;
      setQueueCount(cnt);
      if (cnt > 0) {
        runSync(userId, deviceId, accessToken).catch(() => {});
      }
    };

    const interval = setInterval(autoSync, 30000);
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
    setSyncing(true);
    setSyncMessage(null);
    try {
      const online = await isOnline();
      if (!online) {
        setSyncMessage("No internet connection");
        setTimeout(() => setSyncMessage(null), 4000);
        return;
      }
      const result = await runSync(userId, deviceId, accessToken);
      if (result.errors > 0) {
        setSyncMessage(`${result.errors} item(s) could not be synced`);
        setTimeout(() => setSyncMessage(null), 4000);
      }
      const db = await initDatabase();
      const row = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status = 'pending'",
        userId,
        deviceId,
      );
      setQueueCount(row?.cnt ?? 0);
    } catch {
      setSyncMessage("Sync failed");
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setSyncing(false);
    }
  }

  async function handleLogout() {
    if (!online) {
      showToast("This action can only be done while online");
      return;
    }
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const db = await initDatabase();
      const pending = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status = 'pending'",
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

        await runSync(userId, deviceId, accessToken);

        const stillPending = await db.getFirstAsync<{ cnt: number }>(
          "SELECT COUNT(*) as cnt FROM sync_queue WHERE user_id = ? AND device_id = ? AND status = 'pending'",
          userId,
          deviceId,
        );

        if (stillPending && stillPending.cnt > 0) {
          setLogoutError("Some changes could not be synced. Please try again before logging out.");
          setIsLoggingOut(false);
          return;
        }
      }

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
    } catch (error) {
      console.error("Logout request failed", error);
      setLogoutError("Logout failed. Please check your connection and try again.");
      setIsLoggingOut(false);
    }
  }

  const isActive = (page: Page) => currentPage === page;

  function renderPage() {
    if (currentPage === "settings") {
      return (
        <View className="gap-6">
          <PrivacySettingsScreen accessToken={accessToken} userId={userId} onBackToLogin={handleLogout} onSubPageChange={setSettingsSubPage} onDeleted={setDeletionSuccessDate} />
          {!settingsSubPage ? (
            <>
              {logoutError ? (
                <View style={{ backgroundColor: "#FFF0F2", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 13, color: "#D9001F" }}>{logoutError}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={queueCount > 0 ? "Sync pending changes" : "Synced"}
                disabled={syncing}
                onPress={handleSync}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {syncing ? (
                    <ActivityIndicator size="small" color={palette.mut} />
                  ) : queueCount > 0 ? (
                    <ArrowsClockwise size={18} color="#C25E00" weight="bold" />
                  ) : (
                    <Cloud size={18} color="#0B8A55" weight="bold" />
                  )}
                  <View>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.ink }}>
                      {syncing ? "Syncing..." : queueCount > 0 ? `${queueCount} pending` : "Synced"}
                    </Text>
                    {syncMessage ? (
                      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut, marginTop: 1 }}>
                        {syncMessage}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <MaterialCommunityIcons color={palette.mut} name="chevron-right" size={20} />
              </Pressable>
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
            </>
          ) : null}
        </View>
      );
    }

    if (currentPage === "categories") {
      return <TaxonomyScreen userId={userId} deviceId={deviceId} onBack={() => setCurrentPage("dashboard")} />;
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
