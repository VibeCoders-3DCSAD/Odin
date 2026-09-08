import { jest } from "@jest/globals";

jest.mock("../../client", () => ({ initDatabase: jest.fn() }));

describe("credit-card payment calculations", () => {
  const balance = 100_000;
  const minimum = 20_000;

  test("derives partially paid below the minimum", async () => {
    const { calculateCreditCardPaymentStatus } = await import("../creditCardPayments");
    expect(calculateCreditCardPaymentStatus(19_999, balance, minimum)).toBe("partially_paid");
  });

  test("derives minimum satisfied at the minimum", async () => {
    const { calculateCreditCardPaymentStatus } = await import("../creditCardPayments");
    expect(calculateCreditCardPaymentStatus(minimum, balance, minimum)).toBe("minimum_satisfied");
  });

  test("derives fully paid at and above the balance", async () => {
    const { calculateCreditCardPaymentStatus } = await import("../creditCardPayments");
    expect(calculateCreditCardPaymentStatus(balance, balance, minimum)).toBe("fully_paid");
    expect(calculateCreditCardPaymentStatus(120_000, balance, minimum)).toBe("fully_paid");
  });

  test("retains overpayment as an unapplied credit balance", async () => {
    const { creditBalanceCentavos } = await import("../creditCardPayments");
    expect(creditBalanceCentavos(120_000, balance)).toBe(20_000);
    expect(creditBalanceCentavos(balance, balance)).toBe(0);
  });
});
