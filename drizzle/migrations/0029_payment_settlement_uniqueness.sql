-- Database-level exactly-once settlement guards.
-- A gateway reference may settle at most one order and at most one wallet top-up,
-- no matter how many concurrent webhook / return-page verifications arrive.

CREATE UNIQUE INDEX IF NOT EXISTS orders_paystack_ref_unique
  ON public.orders (paystack_ref)
  WHERE paystack_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_topup_ref_unique
  ON public.wallet_transactions (paystack_ref)
  WHERE paystack_ref IS NOT NULL AND type = 'Wallet Top-Up';
