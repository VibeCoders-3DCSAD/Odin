import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import OnboardingFlow from "../OnboardingFlow";

jest.mock("../../../lib/api", () => ({ API_BASE_URL: "http://test", REQUEST_TIMEOUT_MS: 1000 }));
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");
jest.mock("phosphor-react-native", () => ({ CaretLeft: "Icon", CaretRight: "Icon", Check: "Icon", CheckCircle: "Icon", PencilSimple: "Icon" }));
jest.mock("../../../services/connectivity", () => ({ useConnectivityStore: (selector: (state: { online: boolean }) => unknown) => selector({ online: true }) }));
const mockShowToast = jest.fn();
jest.mock("../../../components/Toast", () => ({ useToast: () => ({ showToast: mockShowToast }) }));
const mockSubmit = jest.fn();
const mockEligibility = jest.fn();
const mockAnswers = {
  display_name: "Juan", date_of_birth: "1995-06-15",
  monthly_income: "50000", monthly_deductions: ["none"], monthly_deduction_amounts: {}, emergency_savings_runway: "1_to_3_months", liquid_emergency_savings: "20000", monthly_essential_living_costs: "30000", paying_off_debt: "false", credit_card_payment_behavior: "never", high_expense_seasons: ["q4"], low_expense_seasons: ["q2"], saving_seasons: ["q2"],
};
jest.mock("../api", () => ({
  getCurrentSession: async () => ({ response: { ok: true }, body: { payload: { session: { id: "session-1", status: "in_progress", current_step_key: "review", raw_answers: mockAnswers } } } }),
  updateSession: async () => ({ response: { ok: true }, body: {} }),
  submitSession: (...args: unknown[]) => mockSubmit(...args),
  updateEligibilityProfile: (...args: unknown[]) => mockEligibility(...args),
  getEligibilityProfile: async () => ({ response: { ok: true }, body: {} }),
}));

it("shows the classification returned when finalizing the questionnaire", async () => {
  mockEligibility.mockResolvedValue({ response: { ok: true }, body: {} });
  mockSubmit.mockResolvedValue({ response: { ok: true }, body: { payload: {
    classification_available: true,
    assessment: { output_snapshot: {
      emergency_savings: { status: "SUCCESS", label: "EMERGENCY_FUND_ADEQUATE", value: 6 },
      debt_burden: { status: "SUCCESS", label: "NOT_OVERBURDENED", value: 0.1 },
      financial_margin: { status: "SUCCESS", label: "POSITIVE_FINANCIAL_MARGIN", value: 15000 },
      credit_card_behavior: [{ status: "SUCCESS", label: "TRANSACTOR", value: 0, source: "self_reported" }],
    } },
  } } });
  const view = render(<OnboardingFlow accessToken="token" userId="user-1" onComplete={jest.fn()} />);
  fireEvent.press(await view.findByText("Submit Assessment"));
  expect(await view.findByText("Assessment Complete")).toBeTruthy();
  expect(await view.findByText("Good safety net")).toBeTruthy();
  expect(view.getByText("You have breathing room")).toBeTruthy();
  expect(view.getByText("Paid in full")).toBeTruthy();
  expect(view.queryByText("Research eligibility")).toBeNull();
  expect(mockEligibility).not.toHaveBeenCalled();
});

it("explains an unavailable classification and still lets the user continue", async () => {
  mockSubmit.mockResolvedValue({ response: { ok: true }, body: { payload: { classification_available: false, assessment: null } } });
  const onComplete = jest.fn();
  const view = render(<OnboardingFlow accessToken="token" userId="user-1" onComplete={onComplete} />);
  fireEvent.press(await view.findByText("Submit Assessment"));
  expect(await view.findByText("Your classification is unavailable right now. You can try again from the dashboard check-in.")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Continue to Dashboard"));
  expect(onComplete).toHaveBeenCalledTimes(1);
});
