drop policy "Anyone can read showcase comments" on public.creator_post_comments;
create policy "Read comments on published posts"
on public.creator_post_comments
for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.creator_posts p
    where p.id = creator_post_comments.post_id
      and p.status = 'published'
  )
);

drop policy "Anyone can read showcase likes" on public.creator_post_likes;
create policy "Read likes on published posts"
on public.creator_post_likes
for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.creator_posts p
    where p.id = creator_post_likes.post_id
      and p.status = 'published'
  )
);