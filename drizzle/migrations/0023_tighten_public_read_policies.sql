-- Pin search_path on SECURITY DEFINER email-queue helpers
ALTER FUNCTION public.move_to_dlq(text,text,int8,jsonb) SET search_path = 'public, pgmq, extensions';
ALTER FUNCTION public.read_email_batch(text,int4,int4) SET search_path = 'public, pgmq, extensions';
ALTER FUNCTION public.enqueue_email(text,jsonb) SET search_path = 'public, pgmq, extensions';
ALTER FUNCTION public.delete_email(text,int8) SET search_path = 'public, pgmq, extensions';

-- platform_settings: admin-only reads (server code uses the service role)
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Admins read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.platform_settings FROM anon;

-- feature_flags: admin-only reads
DROP POLICY IF EXISTS "Anyone can read feature flags" ON public.feature_flags;
CREATE POLICY "Admins read feature flags" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.feature_flags FROM anon;

-- referral_settings: admin-only reads (app reads it with the service role)
DROP POLICY IF EXISTS "referral settings readable" ON public.referral_settings;
CREATE POLICY "Admins read referral settings" ON public.referral_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.referral_settings FROM anon;

-- marketplace_categories: keep only the enabled-scoped public read
DROP POLICY IF EXISTS "Anyone can read categories" ON public.marketplace_categories;

-- product_reviews: only reviews of active products, or your own
DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.product_reviews;
CREATE POLICY "Reviews of active products are readable" ON public.product_reviews
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_reviews.product_id AND p.status = 'active')
    OR auth.uid() = user_id
  );

-- post tags / attachments: only for posts the caller may see
DROP POLICY IF EXISTS "Anyone can view product tags" ON public.post_media_tags;
CREATE POLICY "Visible post media tags" ON public.post_media_tags
  FOR SELECT TO anon, authenticated
  USING (public.post_visible_to_me(post_id));

DROP POLICY IF EXISTS "Anyone can view attachments" ON public.post_product_attachments;
CREATE POLICY "Visible post attachments" ON public.post_product_attachments
  FOR SELECT TO anon, authenticated
  USING (public.post_visible_to_me(post_id));

-- blog taxonomy / reactions: scoped to published posts
DROP POLICY IF EXISTS "blog_post_tags read" ON public.blog_post_tags;
CREATE POLICY "blog_post_tags read published" ON public.blog_post_tags
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.blog_posts b WHERE b.id = blog_post_tags.post_id AND b.status = 'published'));

DROP POLICY IF EXISTS "blog_categories read" ON public.blog_categories;
CREATE POLICY "blog_categories read in use" ON public.blog_categories
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.blog_posts b WHERE b.category_id = blog_categories.id AND b.status = 'published'));

DROP POLICY IF EXISTS "blog_tags read" ON public.blog_tags;
CREATE POLICY "blog_tags read in use" ON public.blog_tags
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.blog_post_tags t
    JOIN public.blog_posts b ON b.id = t.post_id
    WHERE t.tag_id = blog_tags.id AND b.status = 'published'
  ));

DROP POLICY IF EXISTS "blog_reactions read" ON public.blog_reactions;
CREATE POLICY "blog_reactions read published" ON public.blog_reactions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.blog_posts b WHERE b.id = blog_reactions.post_id AND b.status = 'published'));

-- bounties (legacy, inaccessible): owner or admin reads only
DROP POLICY IF EXISTS "Bounties are viewable by anyone" ON public.bounties;
CREATE POLICY "Bounty owners and admins read" ON public.bounties
  FOR SELECT TO authenticated
  USING (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.bounties FROM anon;

-- legacy storage read policies (blog/bounty/course/circle assets are served
-- server-side through the image proxy with the service role)
DROP POLICY IF EXISTS "blog-covers public read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read bounty covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view course covers" ON storage.objects;
DROP POLICY IF EXISTS "circle_images_authenticated_read" ON storage.objects;