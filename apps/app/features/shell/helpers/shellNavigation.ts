import { router, type Href } from "expo-router";
import { House, ListBullets, Target, Wallet, type IconProps } from "phosphor-react-native";
import type { ComponentType } from "react";
import { ROUTES } from "../../../routes";

// Route names of the screens inside app/(app)/(shell)/(tabs).
export type ShellTab = "dashboard" | "money" | "activity" | "plan";

export type HubSegment = { href: Href & string; label: string };
export type Hub = { title: string; segments: HubSegment[] };

// Money and Plan group several pages behind one tab, switched by segments.
export const hubs: Record<"money" | "plan", Hub> = {
  money: {
    title: "Money",
    segments: [
      { href: ROUTES.moneyAccounts, label: "Accounts" },
      { href: ROUTES.moneyIncome, label: "Income" },
      { href: ROUTES.moneyBillers, label: "Billers and\nRemittances" },
    ],
  },
  plan: {
    title: "Plan",
    segments: [
      { href: ROUTES.planDebts, label: "Debts" },
      { href: ROUTES.planSavings, label: "Savings Goals" },
      { href: ROUTES.planBudgets, label: "Budget" },
    ],
  },
};

// A tab press opens the tab's first page, as the hub segments always start on the first one.
export const shellTabs: { tab: ShellTab; href: Href; label: string; Icon: ComponentType<IconProps> }[] = [
  { tab: "dashboard", href: ROUTES.dashboard, label: "Home", Icon: House },
  { tab: "money", href: ROUTES.moneyAccounts, label: "Money", Icon: Wallet },
  { tab: "activity", href: ROUTES.activity, label: "Activity", Icon: ListBullets },
  { tab: "plan", href: ROUTES.planDebts, label: "Plan", Icon: Target },
];

// Long pages show a scroll-to-bottom button while plenty of content is still below the viewport.
export const SCROLL_TO_END_PAGES = new Set<string>([ROUTES.planBudgets]);

// Activity hides the tab bar only while it is the visible tab and editing a transaction.
export function isTabBarVisible(focusedTab: string | undefined, activityEditing: boolean) {
  return !(focusedTab === "activity" && activityEditing);
}

// Back follows real history; a page opened without history (a deep link) falls back to its parent.
export function goBackOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
