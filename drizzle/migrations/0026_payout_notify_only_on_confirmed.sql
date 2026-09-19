CREATE OR REPLACE FUNCTION public.notify_on_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Live provider rails (paystack/flutterwave) may fail immediately at the
    -- transfer step and be rolled back; the app notifies only after the
    -- transfer is actually accepted. Manual rails notify right away.
    IF COALESCE(NEW.provider, '') NOT IN ('paystack', 'flutterwave') THEN
      INSERT INTO public.notifications (user_id, kind, title, body)
      VALUES (NEW.user_id, 'payout_request',
        'Payout request submitted',
        NEW.currency || ' ' || NEW.amount::TEXT || ' pending review');
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.user_id, 'payout_' || NEW.status,
      CASE WHEN NEW.status = 'rejected' THEN 'Withdrawal could not be sent' ELSE 'Payout ' || NEW.status END,
      CASE
        WHEN NEW.status = 'paid' THEN NEW.currency || ' ' || NEW.amount::TEXT || ' has been paid.'
        WHEN NEW.status = 'rejected' THEN COALESCE(NEW.reject_reason,'—') || ' Your wallet was not charged.'
        ELSE 'Status updated to ' || NEW.status
      END);
  END IF;
  RETURN NEW;
END;
$$;