UPDATE recurring_transaction_templates
SET next_occurrence_date = odin.next_occurrence_date(
    starts_on, last_generated_date,
    frequency::text, interval_count,
    day_of_month, second_day_of_month, day_of_week,
    ends_on
)
WHERE status = 'active'
  AND deleted = false
  AND next_occurrence_date IS NULL
  AND starts_on <= CURRENT_DATE;

CREATE OR REPLACE FUNCTION odin.recurring_transaction_templates_next_occurrence_bump()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (
        OLD.frequency IS NOT DISTINCT FROM NEW.frequency
        AND OLD.interval_count IS NOT DISTINCT FROM NEW.interval_count
        AND OLD.day_of_month IS NOT DISTINCT FROM NEW.day_of_month
        AND OLD.second_day_of_month IS NOT DISTINCT FROM NEW.second_day_of_month
        AND OLD.day_of_week IS NOT DISTINCT FROM NEW.day_of_week
        AND OLD.starts_on IS NOT DISTINCT FROM NEW.starts_on
        AND OLD.ends_on IS NOT DISTINCT FROM NEW.ends_on
        AND OLD.last_generated_date IS NOT DISTINCT FROM NEW.last_generated_date
    ) THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'deleted' OR NEW.deleted = true THEN
        RETURN NEW;
    END IF;

    NEW.next_occurrence_date := odin.next_occurrence_date(
        NEW.starts_on, NEW.last_generated_date,
        NEW.frequency::text, NEW.interval_count,
        NEW.day_of_month, NEW.second_day_of_month, NEW.day_of_week,
        NEW.ends_on,
        COALESCE(NEW.last_generated_date, NEW.starts_on)
    );

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER recurring_transaction_templates_next_occurrence_bump
    BEFORE INSERT OR UPDATE ON recurring_transaction_templates
    FOR EACH ROW
    EXECUTE FUNCTION odin.recurring_transaction_templates_next_occurrence_bump();
