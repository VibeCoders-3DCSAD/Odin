import { render, waitFor } from "@testing-library/react-native";
import { FinancialHealthCard, type Classification } from "../FinancialHealthCard";

jest.mock("../../../../lib/api", () => ({ API_BASE_URL: "http://test", REQUEST_TIMEOUT_MS: 1000 }));
let mockOnline = true;
jest.mock("../../../../services/connectivity", () => ({ useConnectivityStore: (select: (state: { online: boolean }) => unknown) => select({ online: mockOnline }) }));

const mockFetch = jest.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  mockOnline = true;
  mockFetch.mockReset();
  global.fetch = mockFetch;
});
afterAll(() => { global.fetch = originalFetch; });

const assessment = { emergency_savings: { status: "SUCCESS", label: "EMERGENCY_FUND_ADEQUATE", value: 4 } };
function assessmentResponse(snapshot = assessment) {
  return { ok: true, json: async () => ({ payload: { assessment: { output_snapshot: snapshot } } }) };
}

it("automatically assesses on each online mount without an Update button", async () => {
  mockFetch.mockResolvedValue(assessmentResponse());
  const view = render(<FinancialHealthCard accessToken="token" />);
  await waitFor(() => expect(view.getByText("Well covered")).toBeTruthy());
  expect(mockFetch).toHaveBeenCalledWith("http://test/odin/api/financial-classification/v2/assess", expect.objectContaining({ method: "POST" }));
  expect(view.queryByLabelText("Refresh check-in")).toBeNull();
  expect(view.queryByText("Update")).toBeNull();
  view.unmount();
  const remounted = render(<FinancialHealthCard accessToken="token" />);
  await waitFor(() => expect(remounted.getByText("Well covered")).toBeTruthy());
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it("skips requests offline and refreshes when connectivity returns", async () => {
  mockOnline = false;
  mockFetch.mockResolvedValue(assessmentResponse());
  const view = render(<FinancialHealthCard accessToken="token" />);
  expect(mockFetch).not.toHaveBeenCalled();
  mockOnline = true;
  view.rerender(<FinancialHealthCard accessToken="token" />);
  await waitFor(() => expect(view.getByText("Well covered")).toBeTruthy());
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it("falls back to the latest assessment when automatic refresh fails", async () => {
  mockFetch.mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce(assessmentResponse());
  const view = render(<FinancialHealthCard accessToken="token" />);
  await waitFor(() => expect(view.getByText("Well covered")).toBeTruthy());
  expect(mockFetch).toHaveBeenLastCalledWith("http://test/odin/api/financial-classification/v2/latest", expect.objectContaining({ method: "GET" }));
  expect(view.getByText("Unable to refresh your profile. Your connection or the server may be unavailable.")).toBeTruthy();
});

it.each([
  ["no_credit_card", "NO_CREDIT_CARD", "You said you don't use a credit card."],
  ["always_before_due", "TRANSACTOR", "You said you always pay on or before the due date."],
  ["1_to_11_months", "LIGHT_REVOLVER", "You reported carrying an unpaid balance for 1–11 months."],
  ["over_a_year", "HEAVY_REVOLVER", "You reported carrying an unpaid balance for over a year."],
] as const)("shows the self-reported %s range without inventing an exact month count", (duration, label, detail) => {
  const classification: Classification = { credit_card_behavior: [{ status: "SUCCESS", source: "self_reported", label, value: null, reported_duration: duration }] };
  const view = render(<FinancialHealthCard accessToken="token" initialClassification={classification} />);
  expect(view.getByText(`${detail} Based on what you shared during setup.`)).toBeTruthy();
  if (duration === "always_before_due") {
    expect(view.getByText("Paid on time")).toBeTruthy();
    expect(view.queryByText("Paid in full")).toBeNull();
  }
  expect(view.queryByText(/in 1 of the last 12 months/)).toBeNull();
  expect(mockFetch).not.toHaveBeenCalled();
});
