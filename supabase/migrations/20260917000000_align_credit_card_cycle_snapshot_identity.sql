-- A changed cutoff produces a distinct cycle snapshot on the device. Keep the
-- server identity aligned so the queued create can sync after an override.
ALTER TABLE credit_card_cycles
  DROP CONSTRAINT IF EXISTS credit_card_cycles_user_id_account_id_cycle_start_date_key;

ALTER TABLE credit_card_cycles
  ADD CONSTRAINT credit_card_cycles_user_id_account_id_cycle_start_date_cutoff_date_key
  UNIQUE (user_id, account_id, cycle_start_date, cutoff_date);
