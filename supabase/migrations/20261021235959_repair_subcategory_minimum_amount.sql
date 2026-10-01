-- The original migration is recorded remotely, but its schema change is absent.
ALTER TABLE subcategories
  ADD COLUMN IF NOT EXISTS minimum_amount_centavos bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.subcategories'::regclass
      AND conname = 'subcategories_minimum_amount_nonnegative_chk'
  ) THEN
    ALTER TABLE subcategories
      ADD CONSTRAINT subcategories_minimum_amount_nonnegative_chk
      CHECK (minimum_amount_centavos IS NULL OR minimum_amount_centavos >= 0);
  END IF;
END;
$$;
