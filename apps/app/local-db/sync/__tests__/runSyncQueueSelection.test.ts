import { syncQueueEligibleStatusesClause } from "../queueOrder";

describe("runSync queue selection", () => {
  it("keeps failed creates eligible for later sync runs", async () => {
    expect(syncQueueEligibleStatusesClause).toBe("status IN ('pending', 'failed')");
    expect(syncQueueEligibleStatusesClause).not.toContain("attempts");
  });
});
