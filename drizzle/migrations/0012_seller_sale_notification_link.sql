CREATE OR REPLACE FUNCTION public.notify_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _fire BOOLEAN := FALSE;
  _cur TEXT;
  _amt NUMERIC;
  _sym TEXT;
  _amt_txt TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status IN ('paid','completed') THEN _fire := TRUE;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('paid','completed') AND OLD.status IS DISTINCT FROM NEW.status THEN _fire := TRUE;
  END IF;
  IF _fire THEN
    _cur := COALESCE(NULLIF(NEW.display_currency::text,''), 'USD');
    _amt := COALESCE(NEW.display_total, NEW.total_usd);
    _sym := CASE _cur WHEN 'USD' THEN '$' WHEN 'NGN' THEN '₦' WHEN 'GHS' THEN 'GH₵' ELSE _cur || ' ' END;
    _amt_txt := _sym || to_char(_amt, 'FM999,999,990.00');

    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.buyer_id, 'order_payment',
      'Order confirmed',
      'Your payment was received. Total ' || _amt_txt,
      '/order/' || NEW.id);
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.seller_id, 'order_sale',
      'New sale',
      'You received a new order. Total ' || _amt_txt,
      '/dashboard?tab=sales');
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_on_order() FROM anon, PUBLIC;

UPDATE public.notifications
   SET link = '/dashboard?tab=sales'
 WHERE kind = 'order_sale'
   AND link LIKE '/order/%';