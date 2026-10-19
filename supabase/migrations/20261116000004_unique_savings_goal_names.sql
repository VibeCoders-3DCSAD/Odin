-- Include archived goals, which can still be restored. Deleted goals release
-- their names. Existing duplicates must be renamed before applying this index;
-- this migration deliberately does not rename or delete user records.
CREATE UNIQUE INDEX savings_goals_user_name_live_idx
  ON public.savings_goals (user_id, lower(btrim(name)))
  WHERE deleted = false;
