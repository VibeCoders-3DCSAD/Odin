import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SquaresFour, ClockCounterClockwise, Plus, Pulse, Wallet } from "phosphor-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ShellPlaceholderPage from "./ShellPlaceholderPage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.8);
const TOOLBAR_MAX_WIDTH = 430;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const requestTimeoutMs = 10_000;

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

  const isActive = (page: Page) => currentPage === page;

  function renderPage() {
    if (currentPage === "settings") {
      return (
        <View className="gap-4">
          <View className="bg-[#F1F0EB] rounded-[1.75rem] p-6 items-center justify-center">
            <MaterialCommunityIcons color={palette.brand} name="cog-outline" size={40} />
            <Text className="text-[#414942] text-sm mt-3 text-center">
              Settings loaded from backend in the next slice
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isLoggingOut}
            onPress={handleLogout}
            className={`min-h-[54px] rounded-[14px] border border-[#EAEAE6] bg-[#F1F0EB] items-center justify-center ${isLoggingOut ? "opacity-50" : "active:opacity-90"}`}
          >
            {isLoggingOut ? (
              <ActivityIndicator color={palette.error} />
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
    <View className="flex-1">
      <SafeAreaView style={{ backgroundColor: palette.shell }} className="flex-1">
        {/* Top bar */}
        <View style={{ backgroundColor: palette.shell }} className="px-5 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
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
              style={{ width: 68, height: 24, resizeMode: "contain" }}
            />
          </View>
          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons color={palette.ink2} name="magnify" size={20} />
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
            <View className="items-center gap-[3px]">
              <Pressable
                onPress={() => setCurrentPage("dashboard")}
                className="items-center"
              >
                <SquaresFour
                  size={21}
                  color={isActive("dashboard") ? palette.brand : palette.mut}
                  weight={isActive("dashboard") ? "fill" : "regular"}
                />
              </Pressable>
              <Text
                style={{ fontSize: 9.5, fontWeight: isActive("dashboard") ? "600" : "500", color: isActive("dashboard") ? palette.brand : palette.mut }}
              >
                Home
              </Text>
            </View>

            <View className="items-center gap-[3px]">
              <Pressable
                onPress={() => setCurrentPage("history")}
                className="items-center"
              >
                <ClockCounterClockwise
                  size={21}
                  color={isActive("history") ? palette.brand : palette.mut}
                  weight={isActive("history") ? "fill" : "regular"}
                />
              </Pressable>
              <Text
                style={{ fontSize: 9.5, fontWeight: isActive("history") ? "600" : "500", color: isActive("history") ? palette.brand : palette.mut }}
              >
                History
              </Text>
            </View>

            <Pressable
              onPress={() => setCurrentPage("add-transaction")}
              accessibilityRole="button"
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

            <View className="items-center gap-[3px]">
              <Pressable
                onPress={() => setCurrentPage("assistant")}
                className="items-center"
              >
                <Pulse
                  size={21}
                  color={isActive("assistant") ? palette.brand : palette.mut}
                  weight={isActive("assistant") ? "fill" : "regular"}
                />
              </Pressable>
              <Text
                style={{ fontSize: 9.5, fontWeight: isActive("assistant") ? "600" : "500", color: isActive("assistant") ? palette.brand : palette.mut }}
              >
                Assistant
              </Text>
            </View>

            <View className="items-center gap-[3px]">
              <Pressable
                onPress={() => setCurrentPage("savings-goals")}
                className="items-center"
              >
                <Wallet
                  size={21}
                  color={isActive("savings-goals") ? palette.brand : palette.mut}
                  weight={isActive("savings-goals") ? "fill" : "regular"}
                />
              </Pressable>
              <Text
                style={{ fontSize: 9.5, fontWeight: isActive("savings-goals") ? "600" : "500", color: isActive("savings-goals") ? palette.brand : palette.mut }}
              >
                Savings
              </Text>
            </View>
          </View>
        </View>
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
    </View>
  );
}
