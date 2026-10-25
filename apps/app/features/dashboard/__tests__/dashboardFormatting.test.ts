import { getGreeting } from "../dashboardFormatting";

const at = (hour: number, minute = 0) => new Date(2026, 9, 26, hour, minute);

it("greets by time of day", () => {
  expect(getGreeting(at(4, 59))).toBe("Good evening");
  expect(getGreeting(at(5))).toBe("Good morning");
  expect(getGreeting(at(11, 59))).toBe("Good morning");
  expect(getGreeting(at(12))).toBe("Good noon");
  expect(getGreeting(at(12, 59))).toBe("Good noon");
  expect(getGreeting(at(13))).toBe("Good afternoon");
  expect(getGreeting(at(17, 59))).toBe("Good afternoon");
  expect(getGreeting(at(18))).toBe("Good evening");
  expect(getGreeting(at(23, 59))).toBe("Good evening");
});
