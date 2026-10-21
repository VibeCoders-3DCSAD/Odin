BEGIN;

INSERT INTO auth.users (id) VALUES ('7d000000-0000-4000-8000-000000000001');
INSERT INTO public.financial_accounts (id, user_id, name, kind) VALUES
  ('7d000000-0000-4000-8000-0000000000a1', '7d000000-0000-4000-8000-000000000001', 'Repayment test bank', 'bank'),
  ('7d000000-0000-4000-8000-0000000000a2', '7d000000-0000-4000-8000-000000000001', 'Contribution test savings', 'savings');

-- These are the shapes written by seed.ts before the linked payment/activity rows.
INSERT INTO public.transactions (
  user_id, transaction_type, status, entry_source, transaction_date,
  amount_centavos, source_account_id, destination_account_id,
  category_id, subcategory_id, client_mutation_id
) VALUES
  ('7d000000-0000-4000-8000-000000000001', 'expense', 'posted', 'manual', '2026-10-19', 10000,
   '7d000000-0000-4000-8000-0000000000a1', NULL, NULL, NULL,
   'debt-payment:7d000000-0000-4000-8000-0000000000b1'),
  ('7d000000-0000-4000-8000-000000000001', 'expense', 'posted', 'manual', '2026-10-19', 20000,
   '7d000000-0000-4000-8000-0000000000a1', NULL, NULL, NULL,
   'credit-card-payment:7d000000-0000-4000-8000-0000000000b2'),
  ('7d000000-0000-4000-8000-000000000001', 'transfer', 'posted', 'manual', '2026-10-19', 30000,
   '7d000000-0000-4000-8000-0000000000a1', '7d000000-0000-4000-8000-0000000000a2', NULL, NULL,
   'savings-contribution-test');

DO $$
DECLARE
  v_marker text;
  v_constraint text;
BEGIN
  FOREACH v_marker IN ARRAY ARRAY['ordinary-expense-test', 'debt-payment:invalid', 'credit-card-payment:invalid'] LOOP
    BEGIN
      INSERT INTO public.transactions (
        user_id, transaction_type, status, entry_source, transaction_date,
        amount_centavos, source_account_id, client_mutation_id
      ) VALUES (
        '7d000000-0000-4000-8000-000000000001', 'expense', 'posted', 'manual', '2026-10-19',
        10000, '7d000000-0000-4000-8000-0000000000a1', v_marker
      );
      RAISE EXCEPTION 'uncategorized ordinary or malformed expense must be rejected: %', v_marker;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint <> 'transactions_shape_chk' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

ROLLBACK;
