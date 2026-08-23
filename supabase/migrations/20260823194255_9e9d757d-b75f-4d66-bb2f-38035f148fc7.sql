ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auto_refund_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text;

CREATE INDEX IF NOT EXISTS orders_escrow_timers_idx
  ON public.orders (escrow_status, dispute_status, auto_refund_at, auto_release_at, payout_release_at);