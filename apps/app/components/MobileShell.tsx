import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import ShellPlaceholderPage from "./ShellPlaceholderPage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.8);
const TOOLBAR_MAX_WIDTH = 430;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const requestTimeoutMs = 10_000;

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
  | "settings";

type MobileShellProps = {
  accessToken: string;
  onLoggedOut: () => void;
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
      { page: "transactions", icon: "swap-horizontal-bold", label: "Transactions" },
      { page: "history", icon: "clock-outline", label: "History" },
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
      { page: "savings-goals", icon: "piggy-bank-outline", label: "Savings & Goals" },
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
  settings: { title: "Settings", subtitle: "Privacy & Account" },
};

export default function MobileShell({ accessToken, onLoggedOut }: MobileShellProps) {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const hamburgerAnim = useRef(new Animated.Value(0)).current;

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

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
      await fetch(`${apiBaseUrl}/odin/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch {
    }
    onLoggedOut();
  }

  function renderPage() {
    if (currentPage === "settings") {
      return (
        <View className="gap-4">
          <View className="bg-[#f4f4f0] rounded-[1.75rem] p-6 items-center justify-center">
            <MaterialCommunityIcons color="#003527" name="cog-outline" size={40} />
            <Text className="text-[#414942] text-sm mt-3 text-center">
              Settings loaded from backend in the next slice
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isLoggingOut}
            onPress={handleLogout}
            className={`min-h-[54px] rounded-[14px] border border-[#EAEAE6] bg-[#FCF8F0] items-center justify-center ${isLoggingOut ? "opacity-50" : "active:opacity-90"}`}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#D9001F" />
            ) : (
              <Text className="text-[#D9001F] text-base font-bold">Log out</Text>
            )}
          </Pressable>
        </View>
      );
    }

    const meta = pageMeta[currentPage];
    return <ShellPlaceholderPage title={meta.title} subtitle={meta.subtitle} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf9f5]">
      {/* Top bar */}
      <View className="bg-[#faf9f5]/80 px-5 py-3 flex-row items-center justify-between z-50">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={drawerOpen ? closeDrawer : openDrawer}
            className="w-10 h-10 rounded-full bg-[#f4f4f0] items-center justify-center"
          >
            <View className="w-[18px] h-[18px] items-center justify-center gap-[3px]">
              <Animated.View
                style={{
                  width: 18, height: 2, borderRadius: 2, backgroundColor: "#1b1c1a",
                  transform: [
                    { translateY: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
                    { rotate: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) },
                  ],
                }}
              />
              <Animated.View
                style={{
                  width: 18, height: 2, borderRadius: 2, backgroundColor: "#1b1c1a",
                  opacity: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                }}
              />
              <Animated.View
                style={{
                  width: 18, height: 2, borderRadius: 2, backgroundColor: "#1b1c1a",
                  transform: [
                    { translateY: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
                    { rotate: hamburgerAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-45deg"] }) },
                  ],
                }}
              />
            </View>
          </Pressable>
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-lg bg-[#064e3b] items-center justify-center">
              <MaterialCommunityIcons color="white" name="layers-triple-outline" size={16} />
            </View>
            <Text className="text-[#1b1c1a] text-lg font-semibold tracking-tight">Odin</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable className="w-9 h-9 rounded-full bg-[#f4f4f0] items-center justify-center">
            <MaterialCommunityIcons color="#414942" name="magnify" size={18} />
          </Pressable>
          <Pressable className="w-9 h-9 rounded-full bg-[#f4f4f0] items-center justify-center relative">
            <MaterialCommunityIcons color="#414942" name="bell-outline" size={18} />
            <View className="absolute top-[7px] right-[7px] w-[7px] h-[7px] bg-[#ba1a1a] rounded-full" />
          </Pressable>
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

      {/* Drawer overlay */}
      {drawerOpen ? (
        <Animated.View
          style={{ opacity: overlayAnim }}
          className="absolute inset-0 bg-black/40 z-200"
        >
          <Pressable className="flex-1" onPress={closeDrawer} />
        </Animated.View>
      ) : null}

      {/* Drawer */}
      {drawerOpen ? (
        <Animated.View
          style={{ transform: [{ translateX: drawerAnim }] }}
          className="absolute top-0 left-0 bottom-0 z-300 bg-[#003527]"
        >
          <View style={{ width: DRAWER_WIDTH }} className="flex-1 py-8 px-6">
            {/* Drawer header */}
            <View className="flex-row items-center gap-3 mb-10">
              <View className="w-10 h-10 rounded-xl bg-[#064e3b] items-center justify-center">
                <MaterialCommunityIcons color="white" name="layers-triple-outline" size={20} />
              </View>
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
                    const isActive = currentPage === item.page;
                    return (
                      <Pressable
                        key={item.page}
                        onPress={() => navigate(item.page)}
                        accessibilityRole="button"
                        className={`flex-row items-center gap-3 px-4 py-3 rounded-xl ${
                          isActive ? "bg-white/12" : ""
                        }`}
                      >
                        <MaterialCommunityIcons
                          color={isActive ? "white" : "rgba(255,255,255,0.6)"}
                          name={item.icon}
                          size={20}
                        />
                        <Text
                          className={`flex-1 text-sm ${
                            isActive ? "text-white font-medium" : "text-white/60"
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
              <Pressable
                onPress={() => navigate("settings")}
                accessibilityRole="button"
                className="flex-row items-center gap-3 px-4 py-3 rounded-xl"
              >
                <View className="w-9 h-9 rounded-full bg-[#0a7c5a] items-center justify-center">
                  <Text className="text-white text-xs font-semibold">CT</Text>
                </View>
                <View>
                  <Text className="text-white/90 text-xs font-medium">Charles Togle</Text>
                  <Text className="text-white/40 text-[10px]">Stable-Obligated</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {/* Bottom toolbar */}
      <View className="absolute bottom-0 left-0 right-0 z-100 items-center">
        <View
          style={{ maxWidth: TOOLBAR_MAX_WIDTH }}
          className="w-full bg-[#faf9f5]/85 px-4 pt-2 pb-6 flex-row items-center justify-around"
        >
          <Pressable
            onPress={() => setCurrentPage("dashboard")}
            className={`items-center gap-[2px] px-3 py-[5px] rounded-xl ${
              currentPage === "dashboard" ? "" : ""
            }`}
          >
            <MaterialCommunityIcons
              color={currentPage === "dashboard" ? "#003527" : "#414942"}
              name="home-outline"
              size={22}
            />
            <Text
              className={`text-[10px] ${
                currentPage === "dashboard" ? "text-[#003527] font-semibold" : "text-[#414942]"
              }`}
            >
              Home
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setCurrentPage("history")}
            className="items-center gap-[2px] px-3 py-[5px] rounded-xl"
          >
            <MaterialCommunityIcons
              color={currentPage === "history" ? "#003527" : "#414942"}
              name="clock-outline"
              size={22}
            />
            <Text
              className={`text-[10px] ${
                currentPage === "history" ? "text-[#003527] font-semibold" : "text-[#414942]"
              }`}
            >
              History
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setCurrentPage("add-transaction")}
            accessibilityRole="button"
            className="w-12 h-12 rounded-full bg-[#003527] items-center justify-center -mt-6 shadow-lg shadow-[#003527]/30"
          >
            <MaterialCommunityIcons color="white" name="plus" size={22} />
          </Pressable>

          <Pressable
            onPress={() => setCurrentPage("assistant")}
            className="items-center gap-[2px] px-3 py-[5px] rounded-xl"
          >
            <MaterialCommunityIcons
              color={currentPage === "assistant" ? "#003527" : "#414942"}
              name="chart-timeline-variant"
              size={22}
            />
            <Text
              className={`text-[10px] ${
                currentPage === "assistant" ? "text-[#003527] font-semibold" : "text-[#414942]"
              }`}
            >
              Assistant
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setCurrentPage("savings-goals")}
            className="items-center gap-[2px] px-3 py-[5px] rounded-xl"
          >
            <MaterialCommunityIcons
              color={currentPage === "savings-goals" ? "#003527" : "#414942"}
              name="piggy-bank-outline"
              size={22}
            />
            <Text
              className={`text-[10px] ${
                currentPage === "savings-goals" ? "text-[#003527] font-semibold" : "text-[#414942]"
              }`}
            >
              Savings
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
