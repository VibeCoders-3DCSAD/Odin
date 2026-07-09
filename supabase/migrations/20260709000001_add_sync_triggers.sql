CREATE OR REPLACE FUNCTION bump_sync_columns()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER category_groups_sync_bump
  BEFORE UPDATE ON category_groups
  FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();

CREATE TRIGGER categories_sync_bump
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();

CREATE TRIGGER subcategories_sync_bump
  BEFORE UPDATE ON subcategories
  FOR EACH ROW EXECUTE FUNCTION bump_sync_columns();
