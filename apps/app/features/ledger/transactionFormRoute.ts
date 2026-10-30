import type { Href } from "expo-router";
import { ROUTE_ID_PATTERN } from "../../lib/routeParams";
import { ROUTES } from "../../routes";

// What /activity/new opens. Links carry only these primitive ids; the route loads and verifies the rest.
export type TransactionFormTarget =
  | { kind: "new" }
  | { kind: "edit"; transactionId: string }
  | { kind: "pay-statement"; statementId: string; cycleId: string }
  | { kind: "edit-statement-payment"; transactionId: string; statementId: string; cycleId: string }
  | { kind: "record-debt-payment"; debtAccountId: string }
  | { kind: "edit-debt-payment"; transactionId: string; debtPaymentId: string; debtAccountId: string }
  | { kind: "savings-activity"; savingsGoalId: string; activity: SavingsActivityKind; amountCentavos?: number };

export type SavingsActivityKind = "contribution" | "withdrawal";

type FormParams = {
  transactionId?: string;
  statementId?: string;
  cycleId?: string;
  debtAccountId?: string;
  debtPaymentId?: string;
  savingsGoalId?: string;
  kind?: SavingsActivityKind;
  amountCentavos?: string;
};

const PARAM_NAMES = ["transactionId", "statementId", "cycleId", "debtAccountId", "debtPaymentId", "savingsGoalId", "kind", "amountCentavos"] as const;
const CENTAVOS_PATTERN = /^[1-9][0-9]{0,14}$/;

function paramsFor(target: TransactionFormTarget): FormParams {
  switch (target.kind) {
    case "new": return {};
    case "edit": return { transactionId: target.transactionId };
    case "pay-statement": return { statementId: target.statementId, cycleId: target.cycleId };
    case "edit-statement-payment": return { transactionId: target.transactionId, statementId: target.statementId, cycleId: target.cycleId };
    case "record-debt-payment": return { debtAccountId: target.debtAccountId };
    case "edit-debt-payment": return { transactionId: target.transactionId, debtPaymentId: target.debtPaymentId, debtAccountId: target.debtAccountId };
    case "savings-activity": {
      const params: FormParams = { savingsGoalId: target.savingsGoalId, kind: target.activity };
      if (target.amountCentavos !== undefined) params.amountCentavos = String(target.amountCentavos);
      return params;
    }
  }
}

// The only way to link to the transaction form: router.push(transactionFormHref({ kind: "record-debt-payment", debtAccountId })).
export function transactionFormHref(target: TransactionFormTarget = { kind: "new" }): Href {
  return { pathname: ROUTES.transactionForm, params: paramsFor(target) };
}

type RawParams = Record<string, string | string[] | undefined>;

// Route params are untrusted: unknown keys are ignored, and a malformed value or a combination that
// matches no target yields null (the route then refuses to open a form).
export function parseTransactionFormParams(raw: RawParams): TransactionFormTarget | null {
  const values: Partial<Record<(typeof PARAM_NAMES)[number], string>> = {};
  for (const name of PARAM_NAMES) {
    const value = raw[name];
    if (value === undefined || value === "") continue;
    if (typeof value !== "string") return null;
    values[name] = value;
  }

  const { transactionId, statementId, cycleId, debtAccountId, debtPaymentId, savingsGoalId, kind, amountCentavos } = values;
  for (const id of [transactionId, statementId, cycleId, debtAccountId, debtPaymentId, savingsGoalId]) {
    if (id !== undefined && !ROUTE_ID_PATTERN.test(id)) return null;
  }
  if (amountCentavos !== undefined && !CENTAVOS_PATTERN.test(amountCentavos)) return null;
  const present = Object.keys(values).sort().join(",");

  if (present === "") return { kind: "new" };
  if (present === "transactionId") return { kind: "edit", transactionId: transactionId! };
  if (present === "cycleId,statementId") return { kind: "pay-statement", statementId: statementId!, cycleId: cycleId! };
  if (present === "cycleId,statementId,transactionId") {
    return { kind: "edit-statement-payment", transactionId: transactionId!, statementId: statementId!, cycleId: cycleId! };
  }
  if (present === "debtAccountId") return { kind: "record-debt-payment", debtAccountId: debtAccountId! };
  if (present === "debtAccountId,debtPaymentId,transactionId") {
    return { kind: "edit-debt-payment", transactionId: transactionId!, debtPaymentId: debtPaymentId!, debtAccountId: debtAccountId! };
  }
  if (present === "kind,savingsGoalId" || present === "amountCentavos,kind,savingsGoalId") {
    if (kind !== "contribution" && kind !== "withdrawal") return null;
    const target: TransactionFormTarget = { kind: "savings-activity", savingsGoalId: savingsGoalId!, activity: kind };
    if (amountCentavos !== undefined) target.amountCentavos = Number(amountCentavos);
    return target;
  }
  return null;
}
