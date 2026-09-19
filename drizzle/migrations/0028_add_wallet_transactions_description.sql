ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.wallet_transactions.description IS 'Human-readable note about the transaction, e.g. withdrawal method or order context.';

-- Keep existing grants intact and ensure authenticated/service_role can read the new column.
GRANT SELECT, INSERT, UPDATE ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;