-- Preserve the authoritative balance: a paid-off row with an outstanding
-- balance is active again rather than silently written down to zero.
UPDATE public.debt_accounts
   SET status = 'active',
       paid_off_at = NULL,
       version = version + 1,
       updated_at = now()
 WHERE status = 'paid_off'
   AND current_balance_centavos <> 0;

ALTER TABLE public.debt_accounts
  VALIDATE CONSTRAINT debt_accounts_paid_off_balance_chk;
