import { fireEvent, render, waitFor } from "@testing-library/react-native";
import RecurrenceQuestion from "../RecurrenceQuestion";

describe("RecurrenceQuestion", () => {
  it("saves a one-time or frequent answer straight away", async () => {
    const onAnswer = jest.fn().mockResolvedValue(undefined);
    const view = render(<RecurrenceQuestion transactionDate="2026-06-10" onAnswer={onAnswer} />);

    fireEvent.press(view.getByLabelText("No. This is a one time only"));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("one_time", undefined));
  });

  it("asks for months before saving an answer in certain months, starting with the expense's month", async () => {
    const onAnswer = jest.fn().mockResolvedValue(undefined);
    const view = render(<RecurrenceQuestion transactionDate="2026-06-10" onAnswer={onAnswer} />);

    fireEvent.press(view.getByLabelText("Yes, in certain months"));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(view.getByLabelText("June").props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(view.getByLabelText("November"));
    fireEvent.press(view.getByLabelText("Save months"));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("yearly", [6, 11]));
  });

  it("needs at least one month and can go back to the answers", () => {
    const onAnswer = jest.fn().mockResolvedValue(undefined);
    const view = render(<RecurrenceQuestion transactionDate="2026-06-10" onAnswer={onAnswer} />);

    fireEvent.press(view.getByLabelText("Yes, in certain months"));
    fireEvent.press(view.getByLabelText("June"));
    expect(view.getByText("Choose at least one month")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Save months"));
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText("Back to answers"));
    expect(view.getByLabelText("Yes. I will be making this frequently")).toBeTruthy();
  });

  it("shows an error when the answer cannot be saved", async () => {
    const view = render(<RecurrenceQuestion transactionDate="2026-06-10" onAnswer={jest.fn().mockRejectedValue(new Error("offline"))} />);

    fireEvent.press(view.getByLabelText("Yes. I will be making this frequently"));
    await waitFor(() => expect(view.getByText("Your answer could not be saved. Try again.")).toBeTruthy());
  });
});

describe("recurrenceAnswer", () => {
  it("names the months a yearly answer comes back in", () => {
    const { recurrenceAnswer } = jest.requireActual("../recurrenceOptions") as typeof import("../recurrenceOptions");
    expect(recurrenceAnswer("yearly", "Tuition", [6, 11])).toBe("You said this comes back in June and November. Your forecast expects it in those months.");
    expect(recurrenceAnswer("yearly", "Tuition", [3, 6, 11])).toContain("March, June, and November");
    expect(recurrenceAnswer("yearly", "Tuition", null)).toContain("same month next year");
  });
});
