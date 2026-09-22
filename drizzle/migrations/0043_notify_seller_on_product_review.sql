CREATE OR REPLACE FUNCTION public.notify_on_product_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seller UUID;
  _pname TEXT;
  _reviewer TEXT;
BEGIN
  SELECT p.seller_id, p.name INTO _seller, _pname
  FROM public.products p WHERE p.id = NEW.product_id;

  IF _seller IS NULL OR _seller = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pr.display_name, pr.username, 'A buyer') INTO _reviewer
  FROM public.profiles pr WHERE pr.user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
  VALUES (
    _seller,
    'product_review',
    CASE WHEN TG_OP = 'INSERT' THEN 'New review on your product' ELSE 'A review was updated' END,
    COALESCE(_reviewer, 'A buyer') || ' rated ' || COALESCE(_pname, 'your product') || ' ' || NEW.rating || '★'
      || CASE WHEN COALESCE(NULLIF(btrim(NEW.comment), ''), '') <> ''
              THEN ': "' || left(btrim(NEW.comment), 120) || '"' ELSE '' END,
    '/product/' || NEW.product_id || '?tab=reviews',
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_product_review ON public.product_reviews;
CREATE TRIGGER trg_notify_on_product_review
AFTER INSERT OR UPDATE OF rating, comment ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_on_product_review();