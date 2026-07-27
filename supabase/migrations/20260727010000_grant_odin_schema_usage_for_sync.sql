GRANT USAGE ON SCHEMA odin TO authenticated;

DO $$
DECLARE
  type_record record;
BEGIN
  FOR type_record IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'odin'
      AND t.typtype = 'e'
  LOOP
    EXECUTE format('GRANT USAGE ON TYPE odin.%I TO authenticated', type_record.typname);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
