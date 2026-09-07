-- Available credit can become negative after an explicitly confirmed over-limit purchase.
ALTER TABLE credit_card_details
  DROP CONSTRAINT IF EXISTS credit_card_details_available_credit_centavos_check;
