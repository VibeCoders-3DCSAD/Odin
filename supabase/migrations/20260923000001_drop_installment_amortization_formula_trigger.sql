-- Drop obsolete formula-based installment amortization validation.
-- Monthly amortization is issuer-provided/user-confirmed and must not be
-- derived from principal, term, or interest rate.

DROP TRIGGER IF EXISTS credit_card_installment_amortization_guard ON public.credit_card_installments;
DROP FUNCTION IF EXISTS public.assert_credit_card_installment_amortization();
