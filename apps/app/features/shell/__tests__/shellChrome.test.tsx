jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  const { Text } = require("react-native");
  const Tabs = ({ children }: { children: React.ReactNode }) => children;
  Tabs.Screen = ({ name }: { name: string }) => <Text>{`tab:${name}`}</Text>;
  return {
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn(), navigate: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    Tabs,
  };
});
jest.mock("phosphor-react-native", () => {
  const Stub = () => null;
  return new Proxy({ __esModule: true }, { get: (_target, key) => (key === "__esModule" ? true : Stub) });
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});
jest.mock("../../sync/SyncProvider", () => ({
  useSync: () => ({ syncing: false, queueCount: 0, syncVersion: 0, syncMessage: null, handleSync: jest.fn() }),
}));

import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { BackHandler, Text } from "react-native";
import TabsLayout from "../../../app/(app)/(shell)/(tabs)/_layout";
import { ROUTES } from "../../../routes";
import { InnerPage } from "../components/InnerPage";
import { useShellPage } from "../components/PageScroll";
import { ShellTabBar } from "../components/ShellTabBar";
import { TabPage } from "../components/TabPage";
import { hubs, isTabBarVisible } from "../helpers/shellNavigation";
import { useShellChromeStore } from "../stores/useShellChromeStore";

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  useShellChromeStore.setState({ activityEditing: false });
});

describe("tab bar", () => {
  it("offers the four tabs and the add button, opening each tab's first page", () => {
    const screen = render(<ShellTabBar focusedTab="money" />);
    expect(screen.getByLabelText("Money").props.accessibilityState).toEqual({ selected: true });
    const expected: [string, unknown][] = [["Home", ROUTES.dashboard], ["Money", ROUTES.moneyAccounts], ["Activity", ROUTES.activity], ["Plan", ROUTES.planDebts]];
    for (const [label, href] of expected) {
      fireEvent.press(screen.getByLabelText(label));
      expect(router.navigate).toHaveBeenLastCalledWith(href);
    }
    fireEvent.press(screen.getByLabelText("Add transaction"));
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.transactionForm);
  });

  it("hides only while Activity is the visible tab and editing", () => {
    expect(isTabBarVisible("activity", true)).toBe(false);
    expect(isTabBarVisible("activity", false)).toBe(true);
    expect(isTabBarVisible("dashboard", true)).toBe(true);

    useShellChromeStore.setState({ activityEditing: true });
    expect(render(<ShellTabBar focusedTab="activity" />).queryByLabelText("Home")).toBeNull();
    expect(render(<ShellTabBar focusedTab="plan" />).getByLabelText("Home")).toBeTruthy();
  });

  it("is the navigator for exactly the four top-level pages", () => {
    const screen = render(<TabsLayout />);
    expect(screen.getAllByText(/^tab:/).map((node) => node.props.children)).toEqual(["tab:dashboard", "tab:money", "tab:activity", "tab:plan"]);
  });
});

describe("page chrome", () => {
  it("shows the top bar on tab pages unless the page hides its chrome", () => {
    const screen = render(<TabPage tab="dashboard"><Text>content</Text></TabPage>);
    fireEvent.press(screen.getByLabelText("Profile and settings"));
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.settings);
    fireEvent.press(screen.getByLabelText("Financial reports"));
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.financialReports);

    const hidden = render(<TabPage tab="activity" hideChrome><Text>content</Text></TabPage>);
    expect(hidden.queryByLabelText("Profile and settings")).toBeNull();
    expect(hidden.getByText("content")).toBeTruthy();
  });

  it("switches hub segments in place and marks the current one", () => {
    const screen = render(<TabPage tab="money" hub={{ hub: hubs.money, pathname: ROUTES.moneyIncome }}><Text>income</Text></TabPage>);
    expect(screen.getByText("Money")).toBeTruthy();
    expect(screen.getByLabelText("Income").props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(screen.getByLabelText("Billers and Remittances"));
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.moneyBillers);
    fireEvent.press(screen.getByLabelText("Income"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
});

describe("inner page back", () => {
  let intercept: () => boolean = () => false;
  function Content() {
    const { setBackIntercept } = useShellPage();
    React.useEffect(() => { setBackIntercept(() => intercept()); }, [setBackIntercept]);
    return <Text>content</Text>;
  }

  function renderPage() {
    const addListener = jest.spyOn(BackHandler, "addEventListener");
    const screen = render(<InnerPage title="Categories" fallbackHref={ROUTES.settings}><Content /></InnerPage>);
    const hardwareBack = addListener.mock.calls.at(-1)![1] as () => boolean;
    return { screen, hardwareBack };
  }

  it("lets the page swallow Back from the header and Android", () => {
    intercept = () => true;
    const { screen, hardwareBack } = renderPage();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(hardwareBack()).toBe(true);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("follows history when there is some", () => {
    intercept = () => false;
    const { screen, hardwareBack } = renderPage();
    expect(screen.getByText("Categories")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(router.back).toHaveBeenCalledTimes(1);
    // Android back is left to the navigator, which pops the page.
    expect(hardwareBack()).toBe(false);
  });

  it("falls back to the parent page without history", () => {
    intercept = () => false;
    jest.mocked(router.canGoBack).mockReturnValue(false);
    const { screen, hardwareBack } = renderPage();
    fireEvent.press(screen.getByLabelText("Back"));
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.settings);
    act(() => { expect(hardwareBack()).toBe(true); });
    expect(router.replace).toHaveBeenCalledTimes(2);
    expect(router.back).not.toHaveBeenCalled();
  });
});
