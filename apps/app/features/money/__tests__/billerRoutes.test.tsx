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
jest.mock("../../../local-db/repositories/scheduled-payments/scheduledPayments", () => ({ getScheduledPayment: jest.fn() }));

// Screens are stubs exposing their navigation callbacks as buttons; the routes are what is under test.
function mockScreen(name: string, callbacks: string[]) {
  const { Pressable, Text, View } = require("react-native");
  return (props: Record<string, unknown>) => <View>
    <Text>{`${name}:${String(props.incomeSourceId ?? props.scheduledPaymentId ?? "new")}`}</Text>
    {callbacks.map((callback) => <Pressable key={callback} accessibilityLabel={callback}
      onPress={() => (props[callback] as (value: string) => void)(/Saved|Recorded/.test(callback) ? "Saved." : "row-1")} />)}
  </View>;
}
jest.mock("../../billers/BillerFormScreen", () => mockScreen("biller-form", ["onClose", "onSaved"]));
jest.mock("../../billers/BillerDetailScreen", () => mockScreen("biller-detail", ["onEdit", "onRecordPayment", "onDeleted"]));
jest.mock("../../billers/RecordBillerPaymentScreen", () => mockScreen("biller-record", ["onClose", "onRecorded"]));
jest.mock("../../billers/BillersScreen", () => mockScreen("biller-list", ["onAdd", "onEdit", "onOpen"]));

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import BillersRoute from "../../../app/(app)/(shell)/(tabs)/money/billers-remittances";
import NewBillerRoute from "../../../app/(app)/(shell)/money/billers-remittances/new";
import BillerDetailRoute from "../../../app/(app)/(shell)/money/billers-remittances/[id]/index";
import EditBillerRoute from "../../../app/(app)/(shell)/money/billers-remittances/[id]/edit";
import RecordBillerPaymentRoute from "../../../app/(app)/(shell)/money/billers-remittances/[id]/record";
import { getScheduledPayment } from "../../../local-db/repositories/scheduled-payments/scheduledPayments";
import { ROUTES } from "../../../routes";
import { billerEditHref, billerHref, billerRecordHref } from "../moneyRoutes";

function withId(id: string | string[]) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  jest.mocked(getScheduledPayment).mockResolvedValue({ id: "biller-1" } as never);
});

describe("billers list", () => {
  it("opens the add form, and the edit form and detail by id", () => {
    render(<BillersRoute />);
    fireEvent.press(screen.getByLabelText("onAdd"));
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.billerNew);
    fireEvent.press(screen.getByLabelText("onEdit"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: ROUTES.billerEdit, params: { id: "row-1" } });
    fireEvent.press(screen.getByLabelText("onOpen"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: ROUTES.biller, params: { id: "row-1" } });
    expect(billerRecordHref("row-1")).toEqual({ pathname: ROUTES.billerRecord, params: { id: "row-1" } });
  });
});

describe("biller pages", () => {
  it("saves a new biller with a toast and sync, then goes back to the list", () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    render(<NewBillerRoute />);
    fireEvent.press(screen.getByLabelText("onSaved"));
    expect(mockShowToast).toHaveBeenCalledWith("Saved.", "success");
    expect(router.replace).toHaveBeenCalledWith(ROUTES.moneyBillers);
    expect(mockHandleSync).toHaveBeenCalled();
  });

  it("opens the edit form and payment form from the detail, and leaves for the list after a delete", async () => {
    withId("biller-1");
    render(<BillerDetailRoute />);
    fireEvent.press(await screen.findByLabelText("onEdit"));
    expect(router.push).toHaveBeenLastCalledWith(billerEditHref("biller-1"));
    fireEvent.press(screen.getByLabelText("onRecordPayment"));
    expect(router.push).toHaveBeenLastCalledWith(billerRecordHref("biller-1"));
    fireEvent.press(screen.getByLabelText("onDeleted"));
    expect(router.dismissTo).toHaveBeenCalledWith(ROUTES.moneyBillers);
    expect(getScheduledPayment).toHaveBeenCalledWith("user-1", "biller-1");
  });

  it("shows not found on the detail for a biller that is missing or not this user's", async () => {
    jest.mocked(getScheduledPayment).mockResolvedValue(null);
    jest.mocked(router.canGoBack).mockReturnValue(false);
    withId("biller-9");
    render(<BillerDetailRoute />);
    fireEvent.press(await screen.findByLabelText("Go back"));
    expect(router.replace).toHaveBeenCalledWith(ROUTES.moneyBillers);
    expect(screen.queryByText(/biller-detail/)).toBeNull();
  });

  it("edits a biller this user owns and refuses anything else", async () => {
    withId("biller-1");
    render(<EditBillerRoute />);
    expect(await screen.findByText("biller-form:biller-1")).toBeTruthy();
    screen.unmount();

    withId("bad id");
    render(<EditBillerRoute />);
    expect(await screen.findByText("This biller or remittance can't be opened")).toBeTruthy();
  });

  it("returns to the detail after recording a payment, even without history", async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    withId("biller-1");
    render(<RecordBillerPaymentRoute />);
    fireEvent.press(await screen.findByLabelText("onRecorded"));
    expect(mockShowToast).toHaveBeenCalledWith("Saved.", "success");
    expect(router.replace).toHaveBeenCalledWith(billerHref("biller-1"));
    expect(mockHandleSync).toHaveBeenCalled();
  });

  it("refuses to record against a biller this user does not own", async () => {
    jest.mocked(getScheduledPayment).mockResolvedValue(null);
    withId("biller-9");
    render(<RecordBillerPaymentRoute />);
    expect(await screen.findByText("This biller or remittance can't be opened")).toBeTruthy();
    expect(screen.queryByText(/biller-record/)).toBeNull();
  });
});
