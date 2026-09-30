-- Preserve legacy identifiers for historical records after retiring their tables.
ALTER TABLE public.overspending_evaluations
  DROP CONSTRAINT IF EXISTS overspending_evaluations_budget_allocation_id_fkey,
  DROP CONSTRAINT IF EXISTS overspending_evaluations_budget_id_fkey,
  DROP CONSTRAINT IF EXISTS overspending_evaluations_budget_owner_fk;

ALTER TABLE public.alerts
  DROP CONSTRAINT IF EXISTS alerts_budget_id_fkey,
  DROP CONSTRAINT IF EXISTS alerts_budget_owner_fk;

DROP TABLE IF EXISTS public.budget_allocations;
DROP TABLE IF EXISTS public.budgets;
