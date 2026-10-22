import { render } from "@testing-library/react-native";
import { FinancialHealthCard, type Classification } from "../FinancialHealthCard";

jest.mock("../../../../lib/api", () => ({ API_BASE_URL: "http://test", REQUEST_TIMEOUT_MS: 1000 }));

it.each([
  ["no_credit_card", "NO_CREDIT_CARD", "You said you don't use a credit card."],
  ["always_before_due", "TRANSACTOR", "You said you always pay on or before the due date."],
  ["1_to_11_months", "LIGHT_REVOLVER", "You reported carrying an unpaid balance for 1–11 months."],
  ["over_a_year", "HEAVY_REVOLVER", "You reported carrying an unpaid balance for over a year."],
] as const)("shows the self-reported %s range without inventing an exact month count", (duration, label, detail) => {
  const classification: Classification = { credit_card_behavior: [{ status: "SUCCESS", source: "self_reported", label, value: null, reported_duration: duration }] };
  const view = render(<FinancialHealthCard accessToken="token" initialClassification={classification} />);
  expect(view.getByText(`${detail} Based on what you shared during setup.`)).toBeTruthy();
  expect(view.queryByText(/in 1 of the last 12 months/)).toBeNull();
});
