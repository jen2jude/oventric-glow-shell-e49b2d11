CREATE OR REPLACE FUNCTION public.notify_on_product_price_cashback_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _old numeric; _new numeric; _pct numeric; _name text := COALESCE(NEW.name, 'A product');
  _oc numeric := COALESCE(OLD.cashback_pct, 0); _nc numeric := COALESCE(NEW.cashback_pct, 0);
BEGIN
  IF NOT (NEW.status = 'active' AND COALESCE(NEW.in_stock, true) AND NOT COALESCE(NEW.creator_asset, false)) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.original_currency,'') = COALESCE(NEW.original_currency,'') AND OLD.original_amount IS NOT NULL AND NEW.original_amount IS NOT NULL THEN
    _old := OLD.original_amount; _new := NEW.original_amount;
  ELSE
    _old := OLD.price_usd; _new := NEW.price_usd;
  END IF;

  IF _old IS NOT NULL AND _new IS NOT NULL AND _old > 0 AND _new <> _old THEN
    _pct := round(abs(_new - _old) / _old * 100);
    IF _pct >= 1 THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
      SELECT u.id,
        CASE WHEN _new < _old THEN 'product_price_drop' ELSE 'product_price_increase' END,
        CASE WHEN _new < _old THEN 'Price reduction alert!' ELSE 'Price increase alert' END,
        CASE WHEN _new < _old
          THEN _name || ' just dropped ' || _pct || '% in price. Get it now before it goes back up!'
          ELSE _name || ' price has gone up ' || _pct || '%. Tap to view the latest price.' END,
        '/product/' || NEW.id, NEW.seller_id
      FROM auth.users u WHERE u.id <> NEW.seller_id;
    END IF;
  END IF;

  IF _nc <> _oc THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
    SELECT u.id,
      CASE WHEN _nc > _oc THEN 'product_cashback_up' ELSE 'product_cashback_down' END,
      CASE WHEN _nc > _oc THEN 'Cashback boost alert!' ELSE 'Cashback reduced' END,
      CASE WHEN _nc > _oc
        THEN _name || ' now gives ' || trim(to_char(LEAST(_nc,50),'FM990.##')) || '% cashback (was ' || trim(to_char(_oc,'FM990.##')) || '%). Grab it before it drops!'
        WHEN _nc <= 0 THEN _name || ' no longer offers cashback. Tap to view it.'
        ELSE _name || ' cashback is now ' || trim(to_char(_nc,'FM990.##')) || '% (was ' || trim(to_char(_oc,'FM990.##')) || '%). Tap to view it.' END,
      '/product/' || NEW.id, NEW.seller_id
    FROM auth.users u WHERE u.id <> NEW.seller_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_product_price_cashback ON public.products;
CREATE TRIGGER trg_notify_product_price_cashback
AFTER UPDATE OF price_usd, original_amount, original_currency, cashback_pct ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_on_product_price_cashback_change();