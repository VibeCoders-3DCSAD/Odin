ALTER TABLE public.financial_plan_allocations
  ADD CONSTRAINT financial_plan_allocations_weight_bps_chk
  CHECK (subcategory_weight_bps IS NULL OR subcategory_weight_bps BETWEEN 0 AND 10000) NOT VALID;

CREATE OR REPLACE FUNCTION public.assert_financial_plan_allocation_target()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent_category_id uuid;
BEGIN
  IF NEW.category_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM financial_plan_allocations allocation
      JOIN subcategories subcategory ON subcategory.id = allocation.subcategory_id
     WHERE allocation.plan_id = NEW.plan_id
       AND subcategory.category_id = NEW.category_id
  ) THEN
    RAISE EXCEPTION 'Financial Plan cannot allocate both a category and one of its subcategories';
  END IF;

  IF NEW.subcategory_id IS NOT NULL THEN
    SELECT category_id INTO v_parent_category_id FROM subcategories WHERE id = NEW.subcategory_id;
    IF EXISTS (
      SELECT 1 FROM financial_plan_allocations
       WHERE plan_id = NEW.plan_id AND category_id = v_parent_category_id
    ) THEN
      RAISE EXCEPTION 'Financial Plan cannot allocate both a category and one of its subcategories';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS financial_plan_allocation_target_guard ON public.financial_plan_allocations;
CREATE TRIGGER financial_plan_allocation_target_guard
  BEFORE INSERT OR UPDATE OF category_id, subcategory_id ON public.financial_plan_allocations
  FOR EACH ROW EXECUTE FUNCTION public.assert_financial_plan_allocation_target();
