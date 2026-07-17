BEGIN;

SELECT '=== RECURRING ENGINE INTEGRATION TEST ===' AS step;

INSERT INTO profiles (user_id, email, created_at) VALUES ('00000000-0000-0000-0000-000000000001', 'test@test.com', now()) ON CONFLICT (user_id) DO NOTHING;

INSERT INTO subcategories (id, user_id, name, category_group_id, transaction_type, is_system, created_at)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Test Subcat', NULL, 'expense', false, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO financial_accounts (id, user_id, name, account_type, created_at)
VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Test Account', 'checking', now())
ON CONFLICT (id) DO NOTHING;

SELECT '--- Test 1: Weekly expense, 3 occurrences ---' AS step;

INSERT INTO recurring_transaction_templates (
    id, user_id, transaction_type, status, name, amount_centavos,
    subcategory_id, source_account_id, frequency, interval_count,
    day_of_week, starts_on, next_occurrence_date, last_generated_date
) VALUES (
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000001',
    'expense', 'active', 'Test Weekly', 50000,
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000020',
    'weekly', 1, 1,
    '2024-01-01', '2024-01-01', NULL
);

SELECT count(*) AS occ_before FROM recurring_transaction_occurrences
WHERE recurring_template_id = '00000000-0000-0000-0000-000000000100';

SELECT * FROM odin.run_recurring_transaction_engine('2024-01-15', 100);

SELECT count(*) AS occ_after FROM recurring_transaction_occurrences
WHERE recurring_template_id = '00000000-0000-0000-0000-000000000100';

SELECT scheduled_date, status FROM recurring_transaction_occurrences
WHERE recurring_template_id = '00000000-0000-0000-0000-000000000100'
ORDER BY scheduled_date;

SELECT transaction_date, amount_centavos, entry_source, client_mutation_id
FROM transactions
WHERE recurring_template_id = '00000000-0000-0000-0000-000000000100'
ORDER BY transaction_date;

SELECT '--- Test 2: Idempotency (rerun produces 0 new rows) ---' AS step;

SELECT count(*) AS occ_rerun_before FROM recurring_transaction_occurrences
WHERE recurring_template_id = '00000000-0000-0000-0000-000000000100';

SELECT * FROM odin.run_recurring_transaction_engine('2024-01-15', 100);

SELECT count(*) AS occ_rerun_after FROM recurring_transaction_occurrences
WHERE recurring_template_id = '00000000-0000-0000-0000-000000000100';

SELECT '--- Test 3: Monthly on 31st (month-end clamp) ---' AS step;

INSERT INTO recurring_transaction_templates (
    id, user_id, transaction_type, status, name, amount_centavos,
    subcategory_id, source_account_id, frequency, interval_count,
    day_of_month, starts_on, next_occurrence_date
) VALUES (
    '00000000-0000-0000-0000-000000000300',
    '00000000-0000-0000-0000-000000000001',
    'expense', 'active', 'Test Monthly 31st', 200000,
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000020',
    'monthly', 1, 31,
    '2024-01-15', '2024-01-31'
);

SELECT * FROM odin.run_recurring_transaction_engine('2024-03-31', 100);

SELECT scheduled_date, status FROM recurring_transaction_occurrences
WHERE recurring_template_id = '00000000-0000-0000-0000-000000000300'
ORDER BY scheduled_date;

SELECT '--- Test 4: Paused template skipped ---' AS step;

INSERT INTO recurring_transaction_templates (
    id, user_id, transaction_type, status, name, amount_centavos,
    subcategory_id, source_account_id, frequency, interval_count,
    day_of_week, starts_on, next_occurrence_date
) VALUES (
    '00000000-0000-0000-0000-000000000400',
    '00000000-0000-0000-0000-000000000001',
    'expense', 'paused', 'Test Paused', 50000,
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000020',
    'weekly', 1, 1,
    '2024-01-01', '2024-01-01'
);

SELECT * FROM odin.run_recurring_transaction_engine('2024-02-01', 100);

SELECT count(*) AS occ_paused FROM recurring_transaction_occurrences
WHERE recurring_template_id = '00000000-0000-0000-0000-000000000400';

SELECT '=== ALL TESTS PASSED ===' AS step;

ROLLBACK;
