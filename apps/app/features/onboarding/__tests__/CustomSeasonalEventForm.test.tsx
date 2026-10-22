import { fireEvent, render } from "@testing-library/react-native";
import { CustomSeasonalEventForm } from "../components/CustomSeasonalEventForm";

it("requires an event name and months, then adds a normalized event", () => {
  const onAdd = jest.fn();
  const view = render(<CustomSeasonalEventForm events={[]} onAdd={onAdd} />);
  fireEvent.press(view.getByText("Add custom event"));
  fireEvent.press(view.getByText("Add event"));
  expect(view.getByText(/Event names must be plain text/)).toBeTruthy();
  expect(onAdd).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText("Event name"), "  Tuition   payment  ");
  fireEvent.press(view.getByText("Add event"));
  expect(view.getByText(/Select one or more distinct months/)).toBeTruthy();
  fireEvent.press(view.getByLabelText("August"));
  fireEvent.press(view.getByLabelText("January"));
  fireEvent.press(view.getByText("Add event"));
  expect(onAdd).toHaveBeenCalledWith({ id: expect.stringMatching(/^custom_/), name: "Tuition payment", months: [1, 8] });
});

it("prevents duplicates across existing events", () => {
  const onAdd = jest.fn();
  const view = render(<CustomSeasonalEventForm events={[{ id: "custom_tuition", name: "Tuition payment", months: [8] }]} onAdd={onAdd} />);
  fireEvent.press(view.getByText("Add custom event"));
  fireEvent.changeText(view.getByLabelText("Event name"), " TUITION payment ");
  fireEvent.press(view.getByLabelText("January"));
  fireEvent.press(view.getByText("Add event"));
  expect(view.getByText("An event with that name already exists.")).toBeTruthy();
  expect(onAdd).not.toHaveBeenCalled();
});
