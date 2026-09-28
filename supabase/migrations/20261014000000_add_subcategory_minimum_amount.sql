ALTER TABLE subcategories
  ADD COLUMN IF NOT EXISTS minimum_amount_centavos bigint;

ALTER TABLE subcategories
  ADD CONSTRAINT subcategories_minimum_amount_nonnegative_chk
  CHECK (minimum_amount_centavos IS NULL OR minimum_amount_centavos >= 0);
