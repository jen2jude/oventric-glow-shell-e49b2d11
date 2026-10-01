CREATE OR REPLACE FUNCTION public.creator_posts_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF NEW.visibility NOT IN ('public','unlisted') THEN RAISE EXCEPTION 'Invalid visibility'; END IF;
  IF NEW.content_type NOT IN ('showcase','tutorial','tip','educational','behind_the_scenes','resource','product_showcase') THEN
    RAISE EXCEPTION 'Invalid content type';
  END IF;
  -- Rights confirmation is required when a resource post is first published.
  IF NEW.status = 'published' AND NEW.product_id IS NOT NULL AND NEW.rights_confirmed_at IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published' OR OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
    RAISE EXCEPTION 'Confirm you own the rights to this resource before publishing';
  END IF;
  RETURN NEW;
END $$;