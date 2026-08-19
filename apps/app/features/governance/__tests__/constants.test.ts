import { hasCurrentTermsConsent } from "../constants";

describe("hasCurrentTermsConsent", () => {
  it("requires the current granted terms version", () => {
    expect(hasCurrentTermsConsent([
      { consent_kind: "privacy", status: "granted", version: "2026-06", recorded_at: "" },
      { consent_kind: "terms", status: "withdrawn", version: "2026-06", recorded_at: "" },
      { consent_kind: "terms", status: "granted", version: "2025-01", recorded_at: "" },
    ])).toBe(false);

    expect(hasCurrentTermsConsent([
      { consent_kind: "terms", status: "granted", version: "2026-06", recorded_at: "" },
    ])).toBe(true);
  });
});
