CREATE OR REPLACE FUNCTION assert_credit_card_relationships() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data jsonb := to_jsonb(NEW);
BEGIN
  IF TG_TABLE_NAME = 'credit_card_transactions' AND (
    NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id=(row_data->>'transaction_id')::uuid AND t.source_account_id=(row_data->>'account_id')::uuid AND t.user_id=(row_data->>'user_id')::uuid AND t.deleted=false)
    OR NOT EXISTS (SELECT 1 FROM credit_card_cycles c JOIN financial_accounts a ON a.id=c.account_id
      WHERE c.id=(row_data->>'cycle_id')::uuid AND c.account_id=(row_data->>'account_id')::uuid AND c.user_id=(row_data->>'user_id')::uuid AND c.deleted=false AND a.user_id=(row_data->>'user_id')::uuid AND a.kind='credit_card' AND a.deleted=false)
  ) THEN RAISE EXCEPTION 'credit-card transaction relationship is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_statements' AND NOT EXISTS (SELECT 1 FROM credit_card_cycles c WHERE c.id=(row_data->>'cycle_id')::uuid AND c.user_id=(row_data->>'user_id')::uuid AND c.deleted=false) THEN RAISE EXCEPTION 'statement cycle is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_payments' AND NOT EXISTS (SELECT 1 FROM credit_card_cycles c WHERE c.id=(row_data->>'cycle_id')::uuid AND c.user_id=(row_data->>'user_id')::uuid AND c.deleted=false) THEN RAISE EXCEPTION 'payment cycle is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_installments' AND NOT EXISTS (SELECT 1 FROM financial_accounts a WHERE a.id=(row_data->>'account_id')::uuid AND a.user_id=(row_data->>'user_id')::uuid AND a.kind='credit_card' AND a.deleted=false) THEN RAISE EXCEPTION 'installment account is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_credit_applications' AND NOT EXISTS (SELECT 1 FROM credit_card_payments p WHERE p.id=(row_data->>'payment_id')::uuid AND p.user_id=(row_data->>'user_id')::uuid AND p.deleted=false) THEN RAISE EXCEPTION 'credit application payment is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_settlements' AND NOT EXISTS (SELECT 1 FROM credit_card_installments i WHERE i.id=(row_data->>'installment_id')::uuid AND i.user_id=(row_data->>'user_id')::uuid AND i.deleted=false) THEN RAISE EXCEPTION 'settlement installment is inaccessible'; END IF;
  IF TG_TABLE_NAME = 'credit_card_statement_strategies' AND NOT EXISTS (SELECT 1 FROM credit_card_statements s WHERE s.id=(row_data->>'statement_id')::uuid AND s.user_id=(row_data->>'user_id')::uuid AND s.deleted=false) THEN RAISE EXCEPTION 'strategy statement is inaccessible'; END IF;
  RETURN NEW;
END $$;
