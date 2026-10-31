import React from "react";
import { Bank, CreditCard, DeviceMobile, Money, PiggyBank, Question } from "phosphor-react-native";
import type { FinancialAccountKind } from "../../../local-db/repositories/foundations/financialFoundations";

export function kindIcon(kind: FinancialAccountKind, size: number, color: string) {
  const props = { size, color, weight: "fill" as const };
  switch (kind) {
    case "cash": return <Money {...props} />;
    case "bank": return <Bank {...props} />;
    case "e_wallet": return <DeviceMobile {...props} />;
    case "savings": return <PiggyBank {...props} />;
    case "credit_card": return <CreditCard {...props} />;
    default: return <Question {...props} />;
  }
}
