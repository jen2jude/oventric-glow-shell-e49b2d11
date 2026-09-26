CREATE OR REPLACE FUNCTION public.notify_all_on_product_available()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _visible_new boolean;
  _visible_old boolean;
  _title text;
  _body text;
BEGIN
  _visible_new := NEW.status = 'active' AND COALESCE(NEW.in_stock, true) AND NOT COALESCE(NEW.creator_asset, false);
  IF NOT _visible_new THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    _title := 'New product available';
    _body := COALESCE(NEW.name, 'A new product') || ' is now available on Oventric. Tap to view it.';
  ELSE
    _visible_old := OLD.status = 'active' AND COALESCE(OLD.in_stock, true) AND NOT COALESCE(OLD.creator_asset, false);
    IF _visible_old THEN RETURN NEW; END IF;
    IF OLD.status = 'active' AND NOT COALESCE(OLD.in_stock, true) THEN
      _title := 'Back in stock';
      _body := COALESCE(NEW.name, 'A product') || ' is back in stock. Tap to view it.';
    ELSE
      _title := 'New product available';
      _body := COALESCE(NEW.name, 'A new product') || ' is now available on Oventric. Tap to view it.';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
  SELECT u.id, CASE WHEN _title = 'Back in stock' THEN 'product_restock' ELSE 'new_product' END,
         _title, _body, '/product/' || NEW.id, NEW.seller_id
  FROM auth.users u
  WHERE u.id <> NEW.seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_all_on_product_available ON public.products;
CREATE TRIGGER trg_notify_all_on_product_available
AFTER INSERT OR UPDATE OF status, in_stock, creator_asset ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_all_on_product_available();