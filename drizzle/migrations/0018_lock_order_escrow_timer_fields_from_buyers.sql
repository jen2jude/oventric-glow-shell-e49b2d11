CREATE OR REPLACE FUNCTION public.orders_guard_buyer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only guard direct end-user (PostgREST authenticated role) writes.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> OLD.buyer_id THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = OLD.seller_id OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.escrow_status IS DISTINCT FROM OLD.escrow_status
     OR NEW.total_usd IS DISTINCT FROM OLD.total_usd
     OR NEW.display_total IS DISTINCT FROM OLD.display_total
     OR NEW.seller_share_usd IS DISTINCT FROM OLD.seller_share_usd
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
     OR NEW.download_token IS DISTINCT FROM OLD.download_token
     -- Escrow timers and settlement markers are owned by the backend only:
     -- a buyer must never be able to bring forward an auto-release, an
     -- auto-refund or a payout, or self-confirm outside the server flow.
     OR NEW.buyer_confirmed_at IS DISTINCT FROM OLD.buyer_confirmed_at
     OR NEW.auto_release_at IS DISTINCT FROM OLD.auto_release_at
     OR NEW.auto_refund_at IS DISTINCT FROM OLD.auto_refund_at
     OR NEW.payout_release_at IS DISTINCT FROM OLD.payout_release_at
     OR NEW.released_at IS DISTINCT FROM OLD.released_at
     OR NEW.released_by IS DISTINCT FROM OLD.released_by
     OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at
     OR NEW.refund_reason IS DISTINCT FROM OLD.refund_reason
     OR NEW.dispute_status IS DISTINCT FROM OLD.dispute_status
  THEN
    RAISE EXCEPTION 'Buyers cannot modify payment, escrow or delivery fields on an order';
  END IF;

  RETURN NEW;
END;
$$;