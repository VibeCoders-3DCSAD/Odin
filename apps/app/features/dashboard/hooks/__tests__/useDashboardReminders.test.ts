import { act, renderHook, waitFor } from "@testing-library/react-native";
import { getDashboardReminders } from "../../../../local-db/repositories/dashboardReminders";
import { useDashboardReminders } from "../useDashboardReminders";
import type { DashboardReminders } from "../../types";

jest.mock("../../../../local-db/repositories/dashboardReminders", () => ({ getDashboardReminders: jest.fn() }));
const mockLoad = jest.mocked(getDashboardReminders);
const empty: DashboardReminders = { attention: { items: [], unavailable: false }, upcoming: { items: [], unavailable: false } };

beforeEach(() => { mockLoad.mockReset(); });

it("discards an old user's request and reloads after synchronization", async () => {
  let finishFirst: (data: DashboardReminders) => void = () => {};
  mockLoad.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; })).mockResolvedValue(empty);
  const hook = renderHook(({ userId, reloadKey }: { userId: string; reloadKey: string }) => useDashboardReminders(userId, reloadKey), { initialProps: { userId: "first", reloadKey: "0" } });
  expect(hook.result.current.loading).toBe(true);
  hook.rerender({ userId: "second", reloadKey: "0" });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => { finishFirst({ attention: { items: [], unavailable: true }, upcoming: { items: [], unavailable: true } }); });
  expect(hook.result.current.data).toEqual(empty);
  hook.rerender({ userId: "second", reloadKey: "1" });
  await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(3));
  expect(mockLoad).toHaveBeenLastCalledWith("second");
});

it("recovers from a failed load with explicit unavailable states", async () => {
  mockLoad.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(empty);
  const hook = renderHook(() => useDashboardReminders("user", "0"));
  await waitFor(() => expect(hook.result.current.data?.attention.unavailable).toBe(true));
  await act(async () => { await hook.result.current.refresh(); });
  expect(hook.result.current.data).toEqual(empty);
});
