-- Sellers could not be recorded as "delivered": the status check rejected the
-- value, so the whole delivery update was discarded.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['pending','paid','delivered','completed','failed','refunded']));

-- Notification kinds were a fixed allow-list that had fallen behind the app,
-- so whole batches (including "buyer confirmed delivery") were rejected.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind ~ '^[a-z0-9_]{3,64}$');