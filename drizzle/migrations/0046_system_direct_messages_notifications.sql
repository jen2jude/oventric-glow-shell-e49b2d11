ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  is_staff boolean;
  n_kind text;
  n_title text;
  n_link text;
BEGIN
  SELECT public.has_any_management_role(NEW.sender_id) INTO is_staff;

  -- Peer-to-peer chat stays in the chat icon only; the bell is reserved for
  -- order-linked conversations and staff/system messages.
  IF NEW.order_id IS NULL AND NOT COALESCE(is_staff, false) AND NOT COALESCE(NEW.is_system, false) THEN
    RETURN NEW;
  END IF;

  n_kind := CASE WHEN NEW.order_id IS NOT NULL THEN 'order_message' ELSE 'direct_message' END;

  IF COALESCE(NEW.is_system, false) THEN
    -- Automated order updates come from Oventric, not from the counterparty.
    n_title := 'Oventric order update';
    n_link := CASE WHEN NEW.order_id IS NOT NULL
      THEN '/order/' || NEW.order_id::text
      ELSE '/?section=Messages&dm=' || NEW.sender_id::text
    END;
    INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
    VALUES (
      NEW.recipient_id,
      n_kind,
      n_title,
      LEFT(COALESCE(NEW.body, ''), 140),
      n_link,
      NULL
    );
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'Someone')
    INTO sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
  VALUES (
    NEW.recipient_id,
    n_kind,
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    LEFT(COALESCE(NEW.body, ''), 140),
    '/?section=Messages&dm=' || NEW.sender_id::text,
    NEW.sender_id
  );

  RETURN NEW;
END;
$$;