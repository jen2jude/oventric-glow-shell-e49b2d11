-- 1. manual_payments: owner may only cancel
DROP POLICY IF EXISTS "manual_payments_update_own_cancel" ON public.manual_payments;
CREATE POLICY "manual_payments_update_own_cancel"
ON public.manual_payments FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- 2. promo_events: admin read must exclude anonymous sessions
DROP POLICY IF EXISTS "Admins can read promo events" ON public.promo_events;
CREATE POLICY "Admins can read promo events"
ON public.promo_events FOR SELECT TO authenticated
USING (
  COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3. orders: buyers cannot tamper with financial/escrow/delivery fields
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
     OR NEW.seller_share_usd IS DISTINCT FROM OLD.seller_share_usd
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
     OR NEW.download_token IS DISTINCT FROM OLD.download_token
  THEN
    RAISE EXCEPTION 'Buyers cannot modify payment, escrow or delivery fields on an order';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_guard_buyer_update ON public.orders;
CREATE TRIGGER orders_guard_buyer_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_guard_buyer_update();

-- 4. bounty_applications: applicants cannot change their own decision status
CREATE OR REPLACE FUNCTION public.bounty_applications_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _poster uuid;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT b.poster_id INTO _poster FROM public.bounties b WHERE b.id = OLD.bounty_id;
  IF auth.uid() = _poster OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Only the bounty poster or an admin can change an application status';
END;
$$;

DROP TRIGGER IF EXISTS bounty_applications_guard_status ON public.bounty_applications;
CREATE TRIGGER bounty_applications_guard_status
BEFORE UPDATE ON public.bounty_applications
FOR EACH ROW EXECUTE FUNCTION public.bounty_applications_guard_status();

-- 5. course_enrollments: students cannot change financial fields
CREATE OR REPLACE FUNCTION public.course_enrollments_guard_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.amount_paid_usd IS DISTINCT FROM OLD.amount_paid_usd
     OR NEW.discount_usd IS DISTINCT FROM OLD.discount_usd
     OR NEW.cashback_usd IS DISTINCT FROM OLD.cashback_usd
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.course_id IS DISTINCT FROM OLD.course_id
  THEN
    RAISE EXCEPTION 'Enrolment payment details cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS course_enrollments_guard_financials ON public.course_enrollments;
CREATE TRIGGER course_enrollments_guard_financials
BEFORE UPDATE ON public.course_enrollments
FOR EACH ROW EXECUTE FUNCTION public.course_enrollments_guard_financials();