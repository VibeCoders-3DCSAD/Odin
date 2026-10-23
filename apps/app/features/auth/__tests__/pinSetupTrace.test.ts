import { tracePinStep } from "../../../lib/helpers/pinSetupTrace";

describe("PIN setup diagnostics", () => {
  let info: jest.SpyInstance;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    info = jest.spyOn(console, "info").mockImplementation(() => {});
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it("logs stages without logging results or raw exception contents", async () => {
    const secret = "SECRET_PIN_TOKEN_OR_DATABASE_KEY";
    expect(await tracePinStep("test.success", async () => secret)).toBe(secret);
    await expect(tracePinStep("test.failure", async () => { throw new Error(secret); })).rejects.toThrow(secret);
    const logged = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
    expect(logged).not.toContain(secret);
    expect(logged).toContain("started");
    expect(logged).toContain("completed");
    expect(logged).toContain("failed");
  });

  it("emits a waiting heartbeat and stops it after completion", async () => {
    jest.useFakeTimers();
    let resolve: () => void = () => {};
    const pending = tracePinStep("test.pending", () => new Promise<void>((done) => { resolve = done; }));
    await jest.advanceTimersByTimeAsync(5000);
    expect(info).toHaveBeenCalledWith("[PIN-SETUP]", expect.objectContaining({ stage: "test.pending", status: "waiting" }));
    resolve();
    await pending;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("classifies encrypted database errors without including SQL or key material", async () => {
    await expect(tracePinStep("test.database", async () => {
      throw new Error("file is not a database; PRAGMA key = SECRET_KEY");
    })).rejects.toThrow();
    expect(warn).toHaveBeenCalledWith("[PIN-SETUP]", expect.objectContaining({ category: "database-key-or-format" }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("SECRET_KEY");
  });
});
