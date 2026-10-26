import { act, configure, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import PreferencesScreen from "../PreferencesScreen";
import type { SeasonalPreferences } from "@odin/spending-insights/seasons";

configure({ asyncUtilTimeout: 5000 });
const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();
let mockOnline = true;
jest.mock("../api", () => ({ getPreferences: (...args: unknown[]) => mockGetPreferences(...args), savePreferences: (...args: unknown[]) => mockSavePreferences(...args) }));
jest.mock("../../../local-db/repositories/unusualSpending", () => ({ listPersistedUnusualSpendings: async () => [], reviseRecurringPaymentGroup: jest.fn() }));
jest.mock("../../../services/connectivity", () => ({ useConnectivityStore: (select: (state: { online: boolean }) => unknown) => select({ online: mockOnline }) }));

const preferences: SeasonalPreferences = {
  high_expense_seasons: ["christmas_ber_months", "custom_tuition"], low_expense_seasons: ["summer"], saving_seasons: ["none"],
  custom_seasonal_events: [{ id: "custom_tuition", name: "Tuition payment", months: [1, 8] }, { id: "custom_reunion", name: "Family reunion", months: [6] }],
};
const result = { response: { ok: true }, body: { payload: { display_name: "Juan", preferences, submitted_at: "2026-10-22T00:00:00Z" } } };

beforeEach(() => { mockOnline = true; mockGetPreferences.mockReset(); mockSavePreferences.mockReset(); });

it("keeps the preferences and payments sections distinct across navigation", async () => {
  mockGetPreferences.mockResolvedValue(result);
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
    await view.findByLabelText("Higher-Expense Seasons");
    for (let visit = 0; visit < 3; visit += 1) {
      expect(view.getAllByText("Payments in certain months")).toHaveLength(1);
      fireEvent.press(view.getByLabelText("Higher-Expense Seasons"));
      expect(view.queryByText("Payments in certain months")).toBeNull();
      await act(async () => { fireEvent.press(view.getByLabelText("Back to preferences")); });
    }
    expect(view.getAllByText("Payments in certain months")).toHaveLength(1);
    expect(errors.mock.calls.filter((args) => String(args[0]).includes("same key"))).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});

it("displays saved seasonal answers and custom months without classification answers", async () => {
  mockGetPreferences.mockResolvedValue(result);
  const onBack = jest.fn();
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={onBack} />);
  expect(await view.findByLabelText("Higher-Expense Seasons")).toBeTruthy();
  expect(view.queryByText("Juan")).toBeNull();
  expect(view.queryByText("Name")).toBeNull();
  expect(view.getByText("Preferences")).toBeTruthy();
  expect(view.getByText("Summer · March–May")).toBeTruthy();
  expect(view.getByText("No particular season")).toBeTruthy();
  expect(view.queryByRole("checkbox")).toBeNull();
  expect(view.queryByText("Custom events")).toBeNull();
  fireEvent.press(view.getByLabelText("Higher-Expense Seasons"));
  expect(view.getByLabelText("Higher-Expense Seasons: Tuition payment")).toBeTruthy();
  expect(view.getByText("Family reunion · June")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Back to preferences"));
  expect(view.queryByText(/Income|Debt Payment|Credit Card|Savings Runway|Essential Costs/)).toBeNull();
  expect(mockGetPreferences).toHaveBeenCalledWith("token");
  fireEvent.press(view.getByLabelText("Back to settings"));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it("distinguishes loading from an unsubmitted questionnaire", async () => {
  let resolve!: (value: unknown) => void;
  mockGetPreferences.mockReturnValue(new Promise((done) => { resolve = done; }));
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  expect(view.getByLabelText("Loading saved preferences")).toBeTruthy();
  expect(view.queryByText(/No submitted questionnaire/)).toBeNull();
  await act(async () => resolve({ response: { ok: true }, body: { payload: { preferences: null, submitted_at: null } } }));
  expect(view.getByText(/No submitted questionnaire yet/)).toBeTruthy();
});

it("offers retry after a failed read", async () => {
  mockGetPreferences.mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce(result);
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  expect(await view.findByText("Unable to load your saved preferences.")).toBeTruthy();
  fireEvent.press(view.getByText("Retry"));
  expect(await view.findByLabelText("Higher-Expense Seasons")).toBeTruthy();
});

it("shows an offline state without treating answers as empty", () => {
  mockOnline = false;
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  expect(view.getByText("Connect to the internet to view your saved preferences.")).toBeTruthy();
  expect(view.queryByText(/No submitted questionnaire/)).toBeNull();
  expect(mockGetPreferences).not.toHaveBeenCalled();
});

it("hides a previous user's answers and ignores requests completed after switching accounts", async () => {
  let resolveOld!: (value: unknown) => void;
  mockGetPreferences.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ response: { ok: true }, body: { payload: { preferences: null, submitted_at: null } } });
  const view = render(<PreferencesScreen accessToken="old-token" userId="old-user" deviceId="device-1" onBack={jest.fn()} />);
  view.rerender(<PreferencesScreen accessToken="new-token" userId="new-user" deviceId="device-1" onBack={jest.fn()} />);
  await view.findByText(/No submitted questionnaire yet/);
  await act(async () => resolveOld(result));
  expect(view.queryByText("Tuition payment · January, August")).toBeNull();
  expect(view.getByText(/No submitted questionnaire yet/)).toBeTruthy();
});

it("saves one category and preserves the other seasonal answers", async () => {
  mockGetPreferences.mockResolvedValue(result);
  let resolve!: (value: unknown) => void;
  mockSavePreferences.mockReturnValue(new Promise((done) => { resolve = done; }));
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Savings Seasons"));
  expect(view.queryByLabelText("Lower-Expense Seasons: Summer")).toBeNull();
  fireEvent.press(view.getByLabelText("Savings Seasons: Rainy Season"));
  fireEvent.press(view.getByLabelText("Save preferences"));
  const draft = mockSavePreferences.mock.calls[0][1];
  expect(draft).toMatchObject({ high_expense_seasons: preferences.high_expense_seasons, low_expense_seasons: ["summer"], saving_seasons: ["rainy_season"] });
  expect(view.getByLabelText("Save preferences").props.accessibilityState.disabled).toBe(true);
  expect(view.getByLabelText("Back to preferences").props.accessibilityState.disabled).toBe(true);
  await act(async () => resolve({ response: { ok: true }, body: { payload: { preferences: draft } } }));
  expect(view.getByText("Preferences saved")).toBeTruthy();
  expect(view.getByLabelText("Savings Seasons")).toBeTruthy();
});

it("cancels edits without sending a save or changing the saved display", async () => {
  mockGetPreferences.mockResolvedValue(result);
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Savings Seasons"));
  fireEvent.press(view.getByLabelText("Savings Seasons: Rainy Season"));
  fireEvent.press(view.getByText("Cancel changes"));
  expect(view.getByText("No particular season")).toBeTruthy();
  expect(mockSavePreferences).not.toHaveBeenCalled();
});

it("preserves the draft after a failed save so the user can retry", async () => {
  mockGetPreferences.mockResolvedValue(result);
  mockSavePreferences.mockRejectedValueOnce(new Error("network"));
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Savings Seasons"));
  fireEvent.press(view.getByLabelText("Savings Seasons: Rainy Season"));
  fireEvent.press(view.getByLabelText("Save preferences"));
  await view.findByText("Unable to save preferences. Please try again.");
  expect(view.getByLabelText("Savings Seasons: Rainy Season").props.accessibilityState.checked).toBe(true);
  const draft = mockSavePreferences.mock.calls[0][1];
  mockSavePreferences.mockResolvedValueOnce({ response: { ok: true }, body: { payload: { preferences: draft } } });
  fireEvent.press(view.getByLabelText("Save preferences"));
  expect(await view.findByText("Preferences saved")).toBeTruthy();
});

it("updates a custom event's name and months without losing its selected ID", async () => {
  mockGetPreferences.mockResolvedValue(result);
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Higher-Expense Seasons"));
  fireEvent.press(view.getByLabelText("Edit event Tuition payment"));
  fireEvent.changeText(view.getByLabelText("Event name"), "Enrollment fees");
  fireEvent.press(view.getByLabelText("August"));
  fireEvent.press(view.getByLabelText("September"));
  fireEvent.press(view.getByText("Save event"));
  expect(view.getByLabelText("Higher-Expense Seasons: Enrollment fees").props.accessibilityState.checked).toBe(true);
  mockSavePreferences.mockResolvedValueOnce({ response: { ok: true }, body: { payload: { preferences: { ...preferences, custom_seasonal_events: [{ id: "custom_tuition", name: "Enrollment fees", months: [1, 9] }, preferences.custom_seasonal_events[1]] } } } });
  fireEvent.press(view.getByLabelText("Save preferences"));
  await view.findByText("Preferences saved");
  expect(mockSavePreferences.mock.calls[0][1].custom_seasonal_events[0]).toEqual({ id: "custom_tuition", name: "Enrollment fees", months: [1, 9] });
  expect(view.getByText(/Enrollment fees · January, September/)).toBeTruthy();
});

it("keeps edits when connectivity is lost and enables saving after reconnecting", async () => {
  mockGetPreferences.mockResolvedValue(result);
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Savings Seasons"));
  fireEvent.press(view.getByLabelText("Savings Seasons: Rainy Season"));
  mockOnline = false;
  view.rerender(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  expect(view.getByLabelText("Save preferences").props.accessibilityState.disabled).toBe(true);
  expect(view.getByLabelText("Savings Seasons: Rainy Season").props.accessibilityState.checked).toBe(true);
  mockOnline = true;
  view.rerender(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  expect(view.getByLabelText("Save preferences").props.accessibilityState.disabled).toBe(false);
  expect(mockGetPreferences).toHaveBeenCalledTimes(1);
});

it("adds custom events with months and includes them in saved preferences", async () => {
  mockGetPreferences.mockResolvedValue(result);
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Higher-Expense Seasons"));
  fireEvent.press(view.getByText("Add event"));
  expect(view.getByLabelText("Save preferences").props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(view.getByLabelText("Event name"), "Birthday");
  fireEvent.press(view.getByLabelText("May"));
  fireEvent.press(view.getByText("Add event"));
  expect(view.getByLabelText("Higher-Expense Seasons: Birthday").props.accessibilityState.checked).toBe(true);
  mockSavePreferences.mockImplementationOnce(async (_token: string, draft: SeasonalPreferences) => ({ response: { ok: true }, body: { payload: { preferences: draft } } }));
  fireEvent.press(view.getByLabelText("Save preferences"));
  await view.findByText("Preferences saved");
  const draft = mockSavePreferences.mock.calls[0][1];
  expect(draft.custom_seasonal_events.at(-1)).toEqual({ id: expect.stringMatching(/^custom_/), name: "Birthday", months: [5] });
  expect(draft.high_expense_seasons).toContain(draft.custom_seasonal_events.at(-1).id);
});

it("requires confirmation to remove a custom event and clears its selected references", async () => {
  mockGetPreferences.mockResolvedValue(result);
  const confirm = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Higher-Expense Seasons"));
  fireEvent.press(view.getByLabelText("Remove event Tuition payment"));
  expect(view.getByLabelText("Higher-Expense Seasons: Tuition payment")).toBeTruthy();
  const buttons = confirm.mock.calls[0]![2]!;
  act(() => buttons.find((button) => button.text === "Remove")!.onPress!());
  expect(view.queryByLabelText("Higher-Expense Seasons: Tuition payment")).toBeNull();
  mockSavePreferences.mockImplementationOnce(async (_token: string, draft: SeasonalPreferences) => ({ response: { ok: true }, body: { payload: { preferences: draft } } }));
  fireEvent.press(view.getByLabelText("Save preferences"));
  await view.findByText("Preferences saved");
  const draft = mockSavePreferences.mock.calls[0][1];
  expect(draft.custom_seasonal_events.some((event: { id: string }) => event.id === "custom_tuition")).toBe(false);
  expect(draft.high_expense_seasons).not.toContain("custom_tuition");
  confirm.mockRestore();
});

it("validates incomplete choices before attempting to save", async () => {
  mockGetPreferences.mockResolvedValue(result);
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Lower-Expense Seasons"));
  fireEvent.press(view.getByLabelText("Lower-Expense Seasons: Summer"));
  fireEvent.press(view.getByLabelText("Save preferences"));
  expect(view.getByText(/Select at least one answer for each seasonal preference/)).toBeTruthy();
  expect(mockSavePreferences).not.toHaveBeenCalled();
});


it.each(["Higher-Expense Seasons", "Lower-Expense Seasons", "Savings Seasons"])("opens %s with its own choices and event form", async (label) => {
  mockGetPreferences.mockResolvedValue(result);
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText(label));
  expect(view.getByLabelText(`${label}: No particular season`)).toBeTruthy();
  expect(view.getByText("Add event")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Back to preferences"));
  expect(view.queryByRole("checkbox")).toBeNull();
  expect(view.getByLabelText(label)).toBeTruthy();
});

it("keeps a valid lower-expense answer when moving its last season to higher expenses", async () => {
  mockGetPreferences.mockResolvedValue(result);
  mockSavePreferences.mockImplementation(async (_token: string, draft: SeasonalPreferences) => ({ response: { ok: true }, body: { payload: { preferences: draft } } }));
  const view = render(<PreferencesScreen accessToken="token" userId="user-1" deviceId="device-1" onBack={jest.fn()} />);
  fireEvent.press(await view.findByLabelText("Higher-Expense Seasons"));
  fireEvent.press(view.getByLabelText("Higher-Expense Seasons: Summer"));
  fireEvent.press(view.getByLabelText("Save preferences"));
  await view.findByText("Preferences saved");
  expect(mockSavePreferences.mock.calls[0][1].low_expense_seasons).toEqual(["none"]);
});
