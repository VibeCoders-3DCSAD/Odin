import type { FinancialAccount } from "../../../local-db/repositories/foundations/financialFoundations";
import { formatPeso as formatPesoBase } from "../../../lib/format/money";
import { P } from "./accountsTheme";

export function formatPeso(centavos: number): string {
  return formatPesoBase(centavos, { truncateAfter: 23 });
}

export function isNegativeAccount(account: FinancialAccount): boolean {
  if (account.kind === "credit_card") {
    return (account.creditCardDetails?.availableCreditCentavos ?? 0) < 0;
  }
  return account.currentBalanceCentavos < 0;
}

export function accountDisplayAmount(account: FinancialAccount): number {
  if (account.kind === "credit_card" && account.creditCardDetails) {
    return account.creditCardDetails.availableCreditCentavos ?? account.creditCardDetails.creditLimitCentavos;
  }
  return account.currentBalanceCentavos;
}

export function accountIconPalette(account: FinancialAccount, negative: boolean) {
  if (negative) return { backgroundColor: "#FBE5E8", color: P.error };
  if (account.kind === "savings") return { backgroundColor: "#E3F2EA", color: "#068751" };
  if (account.kind === "e_wallet") return { backgroundColor: "#E2F0EA", color: "#0B8753" };
  if (account.kind === "bank") return { backgroundColor: "#EAEAE7", color: P.ink2 };
  return { backgroundColor: "#E4EDE8", color: P.brand };
}

export function totalCashPosition(accounts: FinancialAccount[]): number {
  return accounts
    .filter((a) => a.status === "active" && a.includeInDashboardBalance)
    .reduce((sum, a) => sum + a.currentBalanceCentavos, 0);
}

// Editing the opening balance shifts the current balance by the same delta.
export function rebasedCurrentBalance(account: FinancialAccount, openingBalanceCentavos: number): number {
  return account.currentBalanceCentavos - account.openingBalanceCentavos + openingBalanceCentavos;
}
