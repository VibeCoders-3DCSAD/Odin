jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useLocalSearchParams: jest.fn(() => ({})),
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
jest.mock("../../auth/components/AccessProvider", () => ({ useSession: () => ({ accessToken: "token", userId: "user-1", deviceId: "device-1" }) }));
const mockHandleSync = jest.fn();
jest.mock("../../sync/SyncProvider", () => ({
  useSync: () => ({ syncing: false, queueCount: 0, syncVersion: 0, syncMessage: null, handleSync: mockHandleSync }),
}));
const mockShowToast = jest.fn();
jest.mock("../../../components/Toast", () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock("../../../local-db/repositories/foundations/financialFoundations", () => ({ getIncomeSource: jest.fn() }));

// Screens are stubs exposing their navigation callbacks as buttons; the routes are what is under test.
function mockScreen(name: string, callbacks: string[]) {
  const { Pressable, Text, View } = require("react-native");
  return (props: Record<string, unknown>) => <View>
    <Text>{`${name}:${String(props.incomeSourceId ?? props.scheduledPaymentId ?? "new")}`}</Text>
    {callbacks.map((callback) => <Pressable key={callback} accessibilityLabel={callback}
      onPress={() => (props[callback] as (value: string) => void)(/Saved|Recorded/.test(callback) ? "Saved." : "row-1")} />)}
  </View>;
}
jest.mock("../../income-sources/IncomeSourceFormScreen", () => mockScreen("income-form", ["onClose", "onSaved"]));
jest.mock("../../income-sources/IncomeSourcesScreen", () => mockScreen("income-list", ["onAdd", "onEdit"]));

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import IncomeRoute from "../../../app/(app)/(shell)/(tabs)/money/income";
import NewIncomeSourceRoute from "../../../app/(app)/(shell)/money/income/new";
import EditIncomeSourceRoute from "../../../app/(app)/(shell)/money/income/[id]";
import { getIncomeSource } from "../../../local-db/repositories/foundations/financialFoundations";
import { ROUTES } from "../../../routes";
import { incomeSourceHref } from "../moneyRoutes";

function withId(id: string | string[]) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  jest.mocked(getIncomeSource).mockResolvedValue({ id: "income-1" } as never);
});

describe("income list", () => {
  it("opens the add form, and the edit form by id", () => {
    render(<IncomeRoute />);
    fireEvent.press(screen.getByLabelText("onAdd"));
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.incomeSourceNew);
    fireEvent.press(screen.getByLabelText("onEdit"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: ROUTES.incomeSource, params: { id: "row-1" } });
    expect(incomeSourceHref("row-1")).toEqual({ pathname: ROUTES.incomeSource, params: { id: "row-1" } });
  });
});

describe("income source form", () => {
  it("saves a new source with a toast and sync, then goes back", () => {
    render(<NewIncomeSourceRoute />);
    expect(screen.getByText("income-form:new")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("onSaved"));
    expect(mockShowToast).toHaveBeenCalledWith("Saved.", "success");
    expect(router.back).toHaveBeenCalled();
    expect(mockHandleSync).toHaveBeenCalled();
  });

  it("edits only a source this user owns", async () => {
    withId("income-1");
    render(<EditIncomeSourceRoute />);
    expect(await screen.findByText("income-form:income-1")).toBeTruthy();
    expect(getIncomeSource).toHaveBeenCalledWith("user-1", "income-1");
  });

  it("falls back to the income list without history", async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    withId("income-1");
    render(<EditIncomeSourceRoute />);
    fireEvent.press(await screen.findByLabelText("onClose"));
    expect(router.replace).toHaveBeenCalledWith(ROUTES.moneyIncome);
  });

  it("refuses a malformed id without querying", async () => {
    for (const id of ["../x", "a b", ["income-1", "income-2"], ""]) {
      withId(id);
      render(<EditIncomeSourceRoute />);
      expect(await screen.findByText("This income source can't be opened")).toBeTruthy();
      screen.unmount();
    }
    expect(getIncomeSource).not.toHaveBeenCalled();
  });

  it("shows not found for a source that is missing or not this user's", async () => {
    jest.mocked(getIncomeSource).mockResolvedValue(null);
    withId("someone-elses");
    render(<EditIncomeSourceRoute />);
    fireEvent.press(await screen.findByLabelText("Go back"));
    expect(router.back).toHaveBeenCalled();
    expect(screen.queryByText(/income-form/)).toBeNull();
  });
});

