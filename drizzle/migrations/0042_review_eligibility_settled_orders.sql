CREATE OR REPLACE FUNCTION public.has_purchased_product(_user_id uuid, _product_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.buyer_id = _user_id
      AND o.product_id = _product_id
      AND o.status IN ('paid', 'delivered', 'completed', 'released', 'fulfilled')
  )
$function$;