ALTER TABLE public.creator_posts
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'showcase',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tools text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS resource_license text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resource_license_note text,
  ADD COLUMN IF NOT EXISTS rights_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS showcase_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.creator_posts_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF NEW.visibility NOT IN ('public','unlisted') THEN RAISE EXCEPTION 'Invalid visibility'; END IF;
  IF NEW.content_type NOT IN ('showcase','tutorial','tip','educational','behind_the_scenes','resource','product_showcase') THEN
    RAISE EXCEPTION 'Invalid content type';
  END IF;
  IF NEW.status = 'published' AND NEW.product_id IS NOT NULL AND NEW.rights_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirm you own the rights to this resource before publishing';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS creator_posts_validate ON public.creator_posts;
CREATE TRIGGER creator_posts_validate BEFORE INSERT OR UPDATE ON public.creator_posts
FOR EACH ROW EXECUTE FUNCTION public.creator_posts_validate();

CREATE OR REPLACE FUNCTION public.notify_all_on_creator_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF NEW.visibility <> 'public' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'A creator') INTO _name FROM public.profiles WHERE user_id = NEW.author_id;
  INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
  SELECT u.id, 'new_creator_post', 'New creator content',
         COALESCE(_name, 'A creator') || ' just shared "' || COALESCE(NULLIF(NEW.title, ''), 'new work') || '" in Creators. Tap to watch.',
         '/feed?creatorPost=' || NEW.id::text, NEW.author_id
  FROM auth.users u WHERE u.id <> NEW.author_id;
  RETURN NEW;
END $$;