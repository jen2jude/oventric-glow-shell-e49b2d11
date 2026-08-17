create or replace function public.public_circle_directory()
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  avatar_url text,
  cover_url text,
  category text,
  emoji text,
  banner_hue text,
  avatar_hue text,
  created_at timestamptz,
  member_count bigint,
  post_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.slug, c.description, c.avatar_url, c.cover_url,
         c.category, c.emoji, c.banner_hue, c.avatar_hue, c.created_at,
         (select count(*) from public.circle_members m where m.circle_id = c.id) as member_count,
         (select count(*) from public.posts p where p.circle_id = c.id) as post_count
  from public.circles c
  where c.is_private = false
  order by member_count desc, c.created_at desc
  limit 200
$$;

grant execute on function public.public_circle_directory() to anon, authenticated, service_role;