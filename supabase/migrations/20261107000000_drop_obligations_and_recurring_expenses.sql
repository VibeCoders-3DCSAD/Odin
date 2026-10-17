-- Billers and Remittances replace financial obligations and standalone recurring expenses.
-- Recurring templates stay only as the automation behind income sources.
DROP FUNCTION IF EXISTS odin.create_recurring_template_from_obligation(uuid, uuid);
DROP TABLE IF EXISTS public.financial_obligations CASCADE;
DROP TYPE IF EXISTS public.odin_obligation_status;

UPDATE public.recurring_transaction_occurrences o
   SET deleted = true, updated_at = now(), version = o.version + 1
 WHERE o.deleted = false
   AND NOT EXISTS (SELECT 1 FROM public.income_sources s WHERE s.recurring_template_id = o.recurring_template_id);

UPDATE public.recurring_transaction_templates t
   SET deleted = true, status = 'deleted', updated_at = now(), version = t.version + 1
 WHERE t.deleted = false
   AND NOT EXISTS (SELECT 1 FROM public.income_sources s WHERE s.recurring_template_id = t.id);
