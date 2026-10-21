-- Repayment transactions are cash outflows, not categorized consumption.
-- Explicit payment markers allow the transaction to be inserted before its
-- owned debt/card payment row. Ordinary expenses still require a subcategory.
ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_shape_chk,
  ADD CONSTRAINT transactions_shape_chk CHECK (
    (
      transaction_type = 'income'
      AND destination_account_id IS NOT NULL
      AND source_account_id IS NULL
      AND subcategory_id IS NOT NULL
    )
    OR (
      transaction_type = 'expense'
      AND source_account_id IS NOT NULL
      AND destination_account_id IS NULL
      AND (
        subcategory_id IS NOT NULL
        OR COALESCE(client_mutation_id LIKE 'scheduled-payment:%', false)
        OR (
          category_id IS NULL
          AND COALESCE(client_mutation_id ~ '^(debt-payment|credit-card-payment):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', false)
        )
      )
    )
    OR (
      transaction_type = 'transfer'
      AND source_account_id IS NOT NULL
      AND destination_account_id IS NOT NULL
      AND source_account_id <> destination_account_id
      AND subcategory_id IS NULL
    )
  );
