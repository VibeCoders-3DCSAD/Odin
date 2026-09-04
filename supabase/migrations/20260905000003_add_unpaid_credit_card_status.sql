CREATE OR REPLACE FUNCTION public.credit_card_statement_payment_status(
  p_statement_balance_centavos bigint,
  p_minimum_due_centavos bigint,
  p_paid_centavos bigint
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN p_paid_centavos = 0 THEN 'unpaid'
    WHEN p_paid_centavos > p_statement_balance_centavos THEN 'overpaid'
    WHEN p_paid_centavos = p_statement_balance_centavos THEN 'fully_paid'
    WHEN p_paid_centavos >= p_minimum_due_centavos THEN 'minimum_satisfied'
    ELSE 'partially_paid'
  END
$$;
