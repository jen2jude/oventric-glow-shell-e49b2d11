-- Stage 1 hardening: stop the browser from writing privileged identity columns.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name, username, bio, avatar_path, cover_path, phone, country,
  address, address_public, date_of_birth, dob_public, social_links,
  skills, interests, skill_levels, tools, notification_preferences,
  shop_name, shop_about, shop_logo_path, shop_cover_path,
  education, certifications, languages, has_seen_feature_carousel,
  kyc_selfie_path, kyc_id_path,
  deleted_at, deletion_reason, deletion_liveness_path, updated_at
) ON public.profiles TO authenticated;

-- Wallet rows may be seeded by the owner, but never with a starting balance.
REVOKE INSERT ON public.wallets FROM authenticated;
GRANT INSERT (user_id, currency) ON public.wallets TO authenticated;

-- A user may only create a follow edge as the follower, or when accepting a
-- pending request addressed to them.
DROP POLICY IF EXISTS follows_insert_participant ON public.follows;
CREATE POLICY follows_insert_participant ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND (
      auth.uid() = follower_id
      OR (
        auth.uid() = followee_id
        AND EXISTS (
          SELECT 1 FROM public.follow_requests fr
          WHERE fr.requester_id = follows.follower_id
            AND fr.target_id = auth.uid()
        )
      )
    )
  );