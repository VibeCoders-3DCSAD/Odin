jest.mock("expo", () => ({ requireOptionalNativeModule: jest.fn() }));

describe("native PIN derivation failures", () => {
  afterEach(() => { jest.useRealTimers(); jest.resetModules(); });

  it("reports an outdated native build without crashing startup", async () => {
    jest.doMock("expo", () => ({ requireOptionalNativeModule: () => null }));
    const { derivePinKey } = require("../services/nativePinKey");
    await expect(derivePinKey("001234", "a".repeat(64), "b".repeat(32))).rejects.toThrow("updated app build");
  });

  it("settles with a recoverable error if native derivation stops responding", async () => {
    jest.useFakeTimers();
    jest.doMock("expo", () => ({ requireOptionalNativeModule: () => ({ deriveKeyAsync: () => new Promise(() => {}) }) }));
    const { derivePinKey } = require("../services/nativePinKey");
    const pending = derivePinKey("001234", "a".repeat(64), "b".repeat(32));
    const assertion = expect(pending).rejects.toThrow("took too long");
    await jest.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it("rejects malformed native output", async () => {
    jest.doMock("expo", () => ({ requireOptionalNativeModule: () => ({ deriveKeyAsync: async () => "invalid" }) }));
    const { derivePinKey } = require("../services/nativePinKey");
    await expect(derivePinKey("001234", "a".repeat(64), "b".repeat(32))).rejects.toThrow("could not be completed");
  });
});
