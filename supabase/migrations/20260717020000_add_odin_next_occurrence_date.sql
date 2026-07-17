CREATE SCHEMA IF NOT EXISTS odin;

CREATE OR REPLACE FUNCTION odin._clamp_day(target_date date, day_of_month int)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
    SELECT date_trunc('month', target_date)::date
         + LEAST(day_of_month, EXTRACT(DAY FROM date_trunc('month', target_date) + interval '1 month - 1 day')::int)
         - 1;
$$;

CREATE OR REPLACE FUNCTION odin.next_occurrence_date(
    starts_on date,
    last_generated date,
    frequency text,
    interval_count int DEFAULT 1,
    day_of_month int DEFAULT NULL,
    second_day_of_month int DEFAULT NULL,
    day_of_week int DEFAULT NULL,
    ends_on date DEFAULT NULL,
    as_of date DEFAULT CURRENT_DATE
) RETURNS date
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    base_date date;
    candidate date;
    iter int := 0;
BEGIN
    base_date := COALESCE(last_generated, starts_on);

    IF base_date > as_of THEN
        RETURN NULL;
    END IF;

    candidate := base_date;

    LOOP
        iter := iter + 1;
        IF iter > 1000 THEN
            RETURN NULL;
        END IF;

        CASE frequency
            WHEN 'daily' THEN
                candidate := candidate + interval_count;
            WHEN 'weekly' THEN
                IF day_of_week IS NOT NULL THEN
                    DECLARE
                        delta int := (day_of_week - EXTRACT(DOW FROM candidate)::int + 7) % 7;
                    BEGIN
                        IF delta = 0 THEN
                            delta := 7 * interval_count;
                        END IF;
                        candidate := candidate + delta;
                    END;
                ELSE
                    candidate := candidate + 7 * interval_count;
                END IF;
            WHEN 'biweekly' THEN
                IF day_of_week IS NOT NULL THEN
                    DECLARE
                        delta int := (day_of_week - EXTRACT(DOW FROM candidate)::int + 7) % 7;
                    BEGIN
                        IF delta = 0 THEN
                            delta := 14 * interval_count;
                        END IF;
                        candidate := candidate + delta;
                    END;
                ELSE
                    candidate := candidate + 14 * interval_count;
                END IF;
            WHEN 'semi_monthly' THEN
                IF day_of_month IS NOT NULL AND second_day_of_month IS NOT NULL THEN
                    DECLARE
                        month_start date := date_trunc('month', candidate)::date;
                        m_days int := EXTRACT(DAY FROM month_start + interval '1 month - 1 day')::int;
                        dom_date date := month_start + LEAST(day_of_month, m_days) - 1;
                        sdom_date date := month_start + LEAST(second_day_of_month, m_days) - 1;
                    BEGIN
                        IF candidate < dom_date THEN
                            candidate := dom_date;
                        ELSIF candidate < sdom_date THEN
                            candidate := sdom_date;
                        ELSE
                            candidate := odin._clamp_day((month_start + interval '1 month')::date, day_of_month);
                        END IF;
                    END;
                ELSE
                    RETURN NULL;
                END IF;
            WHEN 'monthly' THEN
                IF day_of_month IS NOT NULL THEN
                    DECLARE
                        month_start date := date_trunc('month', candidate)::date;
                        this_month_day date := odin._clamp_day(candidate, day_of_month);
                    BEGIN
                        IF candidate < this_month_day THEN
                            candidate := this_month_day;
                        ELSE
                            candidate := odin._clamp_day(
                                (month_start + make_interval(months => interval_count))::date,
                                day_of_month
                            );
                        END IF;
                    END;
                ELSE
                    candidate := candidate + make_interval(months => interval_count);
                END IF;
            WHEN 'quarterly' THEN
                IF day_of_month IS NOT NULL THEN
                    DECLARE
                        month_start date := date_trunc('month', candidate)::date;
                        this_month_day date := odin._clamp_day(candidate, day_of_month);
                    BEGIN
                        IF candidate < this_month_day THEN
                            candidate := this_month_day;
                        ELSE
                            candidate := odin._clamp_day(
                                (month_start + make_interval(months => 3 * interval_count))::date,
                                day_of_month
                            );
                        END IF;
                    END;
                ELSE
                    candidate := candidate + make_interval(months => 3 * interval_count);
                END IF;
            WHEN 'yearly' THEN
                IF day_of_month IS NOT NULL THEN
                    DECLARE
                        month_start date := date_trunc('month', candidate)::date;
                        this_month_day date := odin._clamp_day(candidate, day_of_month);
                    BEGIN
                        IF candidate < this_month_day THEN
                            candidate := this_month_day;
                        ELSE
                            candidate := odin._clamp_day(
                                (month_start + make_interval(years => interval_count))::date,
                                day_of_month
                            );
                        END IF;
                    END;
                ELSE
                    candidate := candidate + make_interval(years => interval_count);
                END IF;
            ELSE
                RETURN NULL;
        END CASE;

        IF ends_on IS NOT NULL AND candidate > ends_on THEN
            RETURN NULL;
        END IF;

        IF candidate >= as_of THEN
            RETURN candidate;
        END IF;
    END LOOP;
END;
$$;

DO $$
BEGIN
    -- daily +2: starts Jan 1, as_of Jan 1, expect Jan 3
    ASSERT odin.next_occurrence_date('2024-01-01', NULL, 'daily', 2, NULL, NULL, NULL, NULL, '2024-01-01') = '2024-01-03',
        'daily +2 failed: expected 2024-01-03';

    -- monthly day 31 month-end clamp: Jan 31 + 1 month → Feb 29 (2024 leap)
    ASSERT odin.next_occurrence_date('2024-01-15', NULL, 'monthly', 1, 31, NULL, NULL, NULL, '2024-01-20') = '2024-01-31',
        'monthly day 31 clamp failed: expected 2024-01-31';

    -- weekly day_of_week: from Wednesday, next Monday
    ASSERT odin.next_occurrence_date('2024-07-17', NULL, 'weekly', 1, NULL, NULL, 1, NULL, '2024-07-17') = '2024-07-22',
        'weekly day_of_week failed: expected 2024-07-22';

    -- yearly Feb 29 leap year: 2024 leap → 2025 non-leap, expect Feb 28
    ASSERT odin.next_occurrence_date('2024-02-29', NULL, 'yearly', 1, NULL, NULL, NULL, NULL, '2025-02-01') = '2025-02-28',
        'yearly Feb 29 leap year fallback failed: expected 2025-02-28';

    -- ends_on cutoff: daily, ends Jan 5, as_of Jan 1, expect Jan 3 (last valid)
    ASSERT odin.next_occurrence_date('2024-01-01', NULL, 'daily', 2, NULL, NULL, NULL, '2024-01-04', '2024-01-05') IS NULL,
        'ends_on cutoff failed: expected NULL';

    -- biweekly day_of_week: starts on Wednesday, next Monday in 2 weeks
    ASSERT odin.next_occurrence_date('2024-07-17', NULL, 'biweekly', 1, NULL, NULL, 1, NULL, '2024-07-18') = '2024-07-22',
        'biweekly day_of_week failed: expected 2024-07-22';

    -- quarterly day_of_month: from Feb 29 (already on day 31 clamped), next quarter → May 31
    ASSERT odin.next_occurrence_date('2024-02-29', NULL, 'quarterly', 1, 31, NULL, NULL, NULL, '2024-02-29') = '2024-05-31',
        'quarterly day_of_month failed: expected 2024-05-31';

    -- custom frequency returns NULL
    ASSERT odin.next_occurrence_date('2024-01-01', NULL, 'custom', 1, NULL, NULL, NULL, NULL, '2024-01-01') IS NULL,
        'custom frequency failed: expected NULL';

    -- last_generated overrides starts_on: from Jan 15, daily, first candidate >= Jan 20 is Jan 20
    ASSERT odin.next_occurrence_date('2024-01-01', '2024-01-15', 'daily', 1, NULL, NULL, NULL, NULL, '2024-01-20') = '2024-01-20',
        'last_generated override failed: expected 2024-01-20';

    -- ends_on with exact boundary
    ASSERT odin.next_occurrence_date('2024-01-01', NULL, 'daily', 1, NULL, NULL, NULL, '2024-01-05', '2024-01-05') = '2024-01-05',
        'ends_on boundary failed: expected 2024-01-05';

    -- semi_monthly: from Jan 10, next is 15th
    ASSERT odin.next_occurrence_date('2024-01-10', NULL, 'semi_monthly', 1, 1, 15, NULL, NULL, '2024-01-10') = '2024-01-15',
        'semi_monthly failed: expected 2024-01-15';

    -- semi_monthly: from Jan 16, past both days in month, next is Feb 1
    ASSERT odin.next_occurrence_date('2024-01-16', NULL, 'semi_monthly', 1, 1, 15, NULL, NULL, '2024-01-16') = '2024-02-01',
        'semi_monthly next month failed: expected 2024-02-01';

    -- as_of before base_date returns NULL
    ASSERT odin.next_occurrence_date('2024-06-01', NULL, 'daily', 1, NULL, NULL, NULL, NULL, '2024-01-01') IS NULL,
        'as_of before base failed: expected NULL';

    -- monthly interval_count > 1: from Jan 15, every 2 months, day_of_month=31 → Jan 31
    ASSERT odin.next_occurrence_date('2024-01-15', NULL, 'monthly', 2, 31, NULL, NULL, NULL, '2024-01-20') = '2024-01-31',
        'monthly interval2 day31 failed: expected 2024-01-31';
    -- monthly interval_count > 1, already on day_of_month: from Apr 30 (+2 months → Jun 30)
    ASSERT odin.next_occurrence_date('2024-04-30', NULL, 'monthly', 2, 31, NULL, NULL, NULL, '2024-04-30') = '2024-06-30',
        'monthly interval2 day31 next failed: expected 2024-06-30';
END;
$$;
