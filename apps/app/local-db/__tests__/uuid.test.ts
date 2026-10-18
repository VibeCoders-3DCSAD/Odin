import { uuidV5 } from "../uuid";
import { scheduledPaymentPostIds } from "../repositories/scheduledPayments";
import { recurringIncomePostIds } from "../repositories/recurringIncome";

jest.mock("../client", () => ({ initDatabase: jest.fn() }));

describe("uuidV5", () => {
  it("matches the RFC 4122 reference values", () => {
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    expect(uuidV5("https://budgie.ph/ñ/ü", "6ba7b811-9dad-11d1-80b4-00c04fd430c8")).toBe("94803247-beff-5acb-9e77-433a6fd2bed9");
  });
});

describe("scheduledPaymentPostIds", () => {
  // The same values supabase/tests/scheduled_payments_auto_post.sql expects from private.scheduled_payment_post_id.
  it("derives the ids the server's auto-post job writes", () => {
    expect(scheduledPaymentPostIds("5C000000-0000-4000-8000-0000000000B1", "2026-11-05")).toEqual({
      transactionId: "9f45b94d-fb39-5356-921b-4af15e3b7490",
      recordId: "ddd44214-650e-553f-a0a8-87ff51dd975a",
    });
  });
});

describe("recurringIncomePostIds", () => {
  // The same values supabase/tests/recurring_income_auto_post.sql expects from private.recurring_income_post_id.
  it("derives the ids the server's income job writes", () => {
    expect(recurringIncomePostIds("5c000000-0000-4000-8000-0000000000b1", "2026-11-15")).toEqual({
      transactionId: "c6ed60ac-cf57-5d72-9331-1a8a7fecbf61",
      occurrenceId: "9ba7c0c6-a15b-57f4-b4fc-5cbd0c5de261",
    });
  });
});
