jest.mock("../stores/useAuthStore", () => ({
  useAuthStore: require("zustand").create(() => ({ phase: "locked", busy: false, error: null,
    lockoutMs: 0, recoveryVerified: false, submitPin: jest.fn(), setupPin: jest.fn(),
    verifyOnline: jest.fn(), startRecovery: jest.fn() })),
}));

import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import PinAccessScreen from "../components/PinAccessScreen";
import { useAuthStore } from "../stores/useAuthStore";

describe("PIN access screen", () => {
  beforeEach(() => {
    useAuthStore.setState({ phase: "locked", busy: false, error: null, lockoutMs: 0, recoveryVerified: false });
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  it("shows the countdown and disables PIN entry and unlock during the hour", () => {
    useAuthStore.setState({ lockoutMs: 3_600_000 });
    const screen = render(<PinAccessScreen />);
    expect(screen.getByText("Try again in 01:00:00")).toBeTruthy();
    expect(screen.getByLabelText("Six-digit PIN").props.editable).toBe(false);
    fireEvent.press(screen.getByLabelText("Unlock"));
    expect(useAuthStore.getState().submitPin).not.toHaveBeenCalled();
  });

  it("submits a leading-zero PIN and clears the input", () => {
    const screen = render(<PinAccessScreen />);
    fireEvent.changeText(screen.getByLabelText("Six-digit PIN"), "001234");
    fireEvent.press(screen.getByLabelText("Unlock"));
    expect(useAuthStore.getState().submitPin).toHaveBeenCalledWith("001234");
    expect(screen.getByLabelText("Six-digit PIN").props.value).toBe("");
  });

  it("requires confirmation before enabling encryption", () => {
    useAuthStore.setState({ phase: "enrollment-required" });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<PinAccessScreen />);
    fireEvent.changeText(screen.getByLabelText("Create six-digit PIN"), "001234");
    fireEvent.changeText(screen.getByLabelText("Confirm six-digit PIN"), "001234");
    fireEvent.press(screen.getByLabelText("Save PIN"));
    expect(useAuthStore.getState().setupPin).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith("Protect offline access?", expect.stringContaining("unsynced changes will be preserved"), expect.any(Array));
    act(() => { alert.mock.calls[0]?.[2]?.[1]?.onPress?.(); });
    expect(useAuthStore.getState().setupPin).toHaveBeenCalledWith("001234");
  });

  it("shows online verification without rendering PIN inputs after expiry", () => {
    useAuthStore.setState({ phase: "verification-required" });
    const screen = render(<PinAccessScreen />);
    expect(screen.queryByLabelText("Six-digit PIN")).toBeNull();
    fireEvent.press(screen.getByLabelText("Verify online"));
    expect(useAuthStore.getState().verifyOnline).toHaveBeenCalled();
  });
});
