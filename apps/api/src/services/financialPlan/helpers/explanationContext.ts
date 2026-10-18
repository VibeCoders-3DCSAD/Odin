import type { FinancialPlanEvidence } from "../explanationService.js";
import { HFCE_CATEGORY_SLUGS } from "../spendingReasonCatalog.js";

type Amount = { amountCentavos: number };
type ContextInput = {
  planMonth: string;
  plannedAmountCentavos: number;
  categoryBudgetCentavos: number;
  debtReservations: Amount[];
  savingsReservations: Amount[];
  obligations: Array<Amount & { scheduledPaymentId: string; dueDate: string }>;
  scheduledPayments: Array<{ id: string; subcategory_id: string | null }>;
  subcategories: Array<{ id: string; category_id: string | null }>;
  categories: Array<{ id: string; slug: string }>;
};

export function buildFinancialPlanExplanationContext(input: ContextInput): Pick<FinancialPlanEvidence, "planMonth" | "forecastComparisonBasis" | "confirmedExpenses" | "financialConstraints"> {
  const categoryById = new Map(input.categories.map((category) => [category.id, category.slug]));
  const categoryBySubcategory = new Map(input.subcategories.map((subcategory) => [subcategory.id, subcategory.category_id ? categoryById.get(subcategory.category_id) : undefined]));
  const categoryByPayment = new Map(input.scheduledPayments.map((payment) => [payment.id, payment.subcategory_id ? categoryBySubcategory.get(payment.subcategory_id) : undefined]));
  const total = (amounts: Amount[]) => amounts.reduce((sum, item) => sum + item.amountCentavos, 0);
  return {
    planMonth: input.planMonth,
    forecastComparisonBasis: "usual_category_spending",
    confirmedExpenses: input.obligations.flatMap((obligation) => {
      const categorySlug = categoryByPayment.get(obligation.scheduledPaymentId);
      return HFCE_CATEGORY_SLUGS.some((slug) => slug === categorySlug)
        ? [{ scheduledPaymentId: obligation.scheduledPaymentId, categorySlug: categorySlug!, dueDate: obligation.dueDate, amountCentavos: obligation.amountCentavos }] : [];
    }),
    financialConstraints: {
      plannedAmountCentavos: input.plannedAmountCentavos,
      categoryBudgetCentavos: input.categoryBudgetCentavos,
      debtReservationsCentavos: total(input.debtReservations),
      savingsReservationsCentavos: total(input.savingsReservations),
      scheduledPaymentsCentavos: total(input.obligations),
    },
  };
}
