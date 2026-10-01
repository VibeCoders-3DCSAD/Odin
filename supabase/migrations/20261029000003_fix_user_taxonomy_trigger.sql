CREATE OR REPLACE FUNCTION public.enforce_user_owned_taxonomy_references()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'subcategories' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM categories
      WHERE id = NEW.category_id AND user_id = NEW.user_id AND deleted = false
    ) THEN
      RAISE EXCEPTION 'subcategory category must belong to the same user';
    END IF;
  ELSIF TG_TABLE_NAME = 'transactions' THEN
    IF NEW.subcategory_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM subcategories
      WHERE id = NEW.subcategory_id AND user_id = NEW.user_id AND deleted = false
    ) THEN
      RAISE EXCEPTION 'transaction subcategory must belong to the same user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
