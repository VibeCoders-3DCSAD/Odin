CREATE UNIQUE INDEX IF NOT EXISTS budgets_one_live_per_user_idx
  ON budgets (user_id)
  WHERE deleted = false AND status <> 'deleted';
