CREATE OR REPLACE FUNCTION public.notify_all_on_creator_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _name text;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'A creator') INTO _name FROM public.profiles WHERE user_id = NEW.author_id;
  INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
  SELECT u.id, 'new_creator_post', 'New creator content',
         COALESCE(_name, 'A creator') || ' just shared "' || COALESCE(NULLIF(NEW.title, ''), 'new work') || '" in Creators. Tap to watch.',
         '/feed?creatorPost=' || NEW.id::text, NEW.author_id
  FROM auth.users u WHERE u.id <> NEW.author_id;
  RETURN NEW;
END; $function$;