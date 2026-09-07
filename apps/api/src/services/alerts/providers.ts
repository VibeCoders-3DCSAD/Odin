import { RuleBasedAnomalyProvider } from "./ruleBasedAnomalyProvider.js";
import { RuleBasedOverspendingProvider } from "./ruleBasedOverspendingProvider.js";
import type { AlertIntelligenceProvider } from "./types.js";

export function createRuleBasedProvider(): AlertIntelligenceProvider {
  return {
    name: "rules",
    anomaly: new RuleBasedAnomalyProvider(),
    overspending: new RuleBasedOverspendingProvider(),
  };
}
