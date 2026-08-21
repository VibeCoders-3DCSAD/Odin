-- Keep the newest live budget for each user and tombstone older duplicates
-- before adding the invariant required by concurrent sync operations.
WITH ranked_live_budgets AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS budget_rank
  FROM budgets
  WHERE deleted = false AND status <> 'deleted'
)
UPDATE budgets
SET status = 'deleted',
    deleted = true,
    deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
WHERE id IN (
  SELECT id FROM ranked_live_budgets WHERE budget_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS budgets_one_live_per_user_idx
  ON budgets (user_id)
  WHERE deleted = false AND status <> 'deleted';
