import { createRuleBasedProvider } from "./providers.js";
import type { AlertIntelligenceProvider } from "./types.js";

export type AlertIntelligenceProviderName = "rules" | "ml";

export function createAlertProvider(options: {
  provider?: string;
} = {}): AlertIntelligenceProvider {
  const provider = options.provider ?? process.env.ALERT_INTELLIGENCE_PROVIDER ?? "rules";

  if (provider === "rules") return createRuleBasedProvider();
  if (provider === "ml") {
    throw new Error("ALERT_INTELLIGENCE_PROVIDER=ml is reserved until the odin-ml adapter is implemented.");
  }

  throw new Error(`Unsupported alert intelligence provider: ${provider}`);
}
