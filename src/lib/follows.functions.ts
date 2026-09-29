import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageStorage } from "@/lib/storage/images.server";
import { isStableBucket, stableImageUrl, stableImageUrls } from "@/lib/storage/stable-image";

export type FollowStatus = "none" | "requested" | "following" | "follows_you" | "mutual";

const TargetInput = z.object({ targetId: z.string().uuid() });
const RequesterInput = z.object({ requesterId: z.string().uuid() });
const UserInput = z.object({ userId: z.string().uuid() });

export interface FollowStatusResult {
  status: FollowStatus;
  /** True if the OTHER side already follows you (so a re-follow is instant / mutual). */
  followsYou: boolean;
}

export interface PersonSummary {
  userId: string;
  displayName: string;
  username: string | null;
  slug: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export interface SuggestedPerson extends PersonSummary {
  reputation: number;
}

export interface PeopleLeaderboardPerson extends PersonSummary {
  followersCount: number;
  followingCount: number;
  verified: boolean;
}

async function signAvatarPaths(supabase: any, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const map = new Map<string, string>();
  for (const p of unique) {
    const url = stableImageUrl("avatars", p);
    if (url) map.set(p, url);
  }
  return map;
}

async function loadPeople(supabase: any, ids: string[]): Promise<Map<string, PersonSummary>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, username, slug, avatar_path, bio")
    .in("user_id", ids);
  const signed = await signAvatarPaths(supabase, (data ?? []).map((p: any) => p.avatar_path));
  return new Map(
    (data ?? []).map((p: any) => [
      p.user_id,
      {
        userId: p.user_id,
        displayName: p.display_name || p.username || "Unnamed member",
        username: p.username ?? null,
        slug: p.slug ?? null,
        avatarUrl: p.avatar_path ? signed.get(p.avatar_path) ?? null : null,
        bio: p.bio ?? null,
      } satisfies PersonSummary,
    ]),
  );
}

export const getFollowStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TargetInput.parse(d))
  .handler(async ({ data, context }): Promise<FollowStatusResult> => {
    const me = context.userId;
    if (me === data.targetId) return { status: "none", followsYou: false };

    const [meFollows, theyFollow, pendingReq] = await Promise.all([
      context.supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", me)
        .eq("followee_id", data.targetId)
        .maybeSingle(),
      context.supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", data.targetId)
        .eq("followee_id", me)
        .maybeSingle(),
      context.supabase
        .from("follow_requests")
        .select("id, status")
        .eq("requester_id", me)
        .eq("target_id", data.targetId)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

    const followsYou = !!theyFollow.data;
    if (meFollows.data) return { status: followsYou ? "mutual" : "following", followsYou };
    if (pendingReq.data) return { status: "requested", followsYou };
    if (followsYou) return { status: "follows_you", followsYou };
    return { status: "none", followsYou };
  });

export const sendFollowRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TargetInput.parse(d))
  .handler(async ({ data, context }): Promise<FollowStatusResult> => {
    const me = context.userId;
    if (me === data.targetId) throw new Error("You can't follow yourself");
    // Idempotent upsert of a pending request
    const { error } = await context.supabase
      .from("follow_requests")
      .upsert(
        { requester_id: me, target_id: data.targetId, status: "pending" },
        { onConflict: "requester_id,target_id", ignoreDuplicates: false },
      );
    if (error) {
      console.error("[sendFollowRequest]", error);
      throw new Error("Failed to send follow request");
    }
    // Fire a notification for the target so they see the request in their bell.
    try {
      const { data: meProfile } = await context.supabase
        .from("profiles")
        .select("display_name, username, slug")
        .eq("user_id", me)
        .maybeSingle();
      const name = meProfile?.display_name || meProfile?.username || "Someone";
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("notifications").insert({
        user_id: data.targetId,
        from_user_id: me,
        kind: "follow_request",
        title: `${name} wants to follow you`,
        body: "Open your profile to accept or decline.",
        link: meProfile?.slug ? `/profile/${meProfile.slug}` : null,
      });
    } catch (nErr) {
      console.error("[sendFollowRequest] notify", nErr);
    }
    const { data: theyFollow } = await context.supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", data.targetId)
      .eq("followee_id", me)
      .maybeSingle();
    return { status: "requested", followsYou: !!theyFollow };
  });

export const cancelFollowRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TargetInput.parse(d))
  .handler(async ({ data, context }): Promise<FollowStatusResult> => {
    const me = context.userId;
    const { error } = await context.supabase
      .from("follow_requests")
      .delete()
      .eq("requester_id", me)
      .eq("target_id", data.targetId);
    if (error) throw new Error("Failed to cancel request");
    const { data: theyFollow } = await context.supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", data.targetId)
      .eq("followee_id", me)
      .maybeSingle();
    return { status: theyFollow ? "follows_you" : "none", followsYou: !!theyFollow };
  });

export const acceptFollowRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequesterInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const me = context.userId;
    // Verify the request is addressed to me
    const { data: req, error: rErr } = await context.supabase
      .from("follow_requests")
      .select("id")
      .eq("requester_id", data.requesterId)
      .eq("target_id", me)
      .eq("status", "pending")
      .maybeSingle();
    if (rErr) throw new Error("Failed to load request");
    if (!req) throw new Error("Request not found");

    const { error: fErr } = await context.supabase
      .from("follows")
      .insert({ follower_id: data.requesterId, followee_id: me });
    if (fErr && (fErr as any).code !== "23505") {
      console.error("[acceptFollowRequest] insert follow", fErr);
      throw new Error("Failed to accept");
    }
    await context.supabase.from("follow_requests").delete().eq("id", req.id);

    // Tell the requester their request was accepted.
    try {
      const { data: meProfile } = await context.supabase
        .from("profiles")
        .select("display_name, username, slug")
        .eq("user_id", me)
        .maybeSingle();
      const name = meProfile?.display_name || meProfile?.username || "Someone";
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("notifications").insert({
        user_id: data.requesterId,
        from_user_id: me,
        kind: "follow_accepted",
        title: `${name} accepted your follow request`,
        body: `You're now following ${name}.`,
        link: meProfile?.slug ? `/profile/${meProfile.slug}` : null,
      });
    } catch (nErr) {
      console.error("[acceptFollowRequest] notify", nErr);
    }
    return { ok: true };
  });

export const declineFollowRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequesterInput.parse(d))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const { error } = await context.supabase
      .from("follow_requests")
      .delete()
      .eq("requester_id", data.requesterId)
      .eq("target_id", me);
    if (error) throw new Error("Failed to decline");
    return { ok: true } as const;
  });

export const unfollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TargetInput.parse(d))
  .handler(async ({ data, context }): Promise<FollowStatusResult> => {
    const me = context.userId;
    const { error } = await context.supabase
      .from("follows")
      .delete()
      .eq("follower_id", me)
      .eq("followee_id", data.targetId);
    if (error) throw new Error("Failed to unfollow");
    const { data: theyFollow } = await context.supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", data.targetId)
      .eq("followee_id", me)
      .maybeSingle();
    return { status: theyFollow ? "follows_you" : "none", followsYou: !!theyFollow };
  });

export const listFollowers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UserInput.parse(d))
  .handler(async ({ data, context }): Promise<PersonSummary[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("follows")
      .select("follower_id, created_at")
      .eq("followee_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const map = await loadPeople(context.supabase, (rows ?? []).map((r: any) => r.follower_id));
    return (rows ?? []).map((r: any) => map.get(r.follower_id)!).filter(Boolean);
  });

export const listFollowing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UserInput.parse(d))
  .handler(async ({ data, context }): Promise<PersonSummary[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("follows")
      .select("followee_id, created_at")
      .eq("follower_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const map = await loadPeople(context.supabase, (rows ?? []).map((r: any) => r.followee_id));
    return (rows ?? []).map((r: any) => map.get(r.followee_id)!).filter(Boolean);
  });

/** Public people leaderboard ranked by live follower count. */
export const getPeopleLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<PeopleLeaderboardPerson[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profileRows, error: profileError }, { data: followRows, error: followError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select(
            "user_id, display_name, username, slug, avatar_path, bio, verification_tier, profile_completed_at, banned_at, deleted_at",
          )
          .not("profile_completed_at", "is", null)
          .limit(500),
        supabaseAdmin.from("follows").select("follower_id, followee_id").limit(20000),
      ]);

    if (profileError) throw profileError;
    if (followError) throw followError;

    const followers = new Map<string, number>();
    const following = new Map<string, number>();
    (followRows ?? []).forEach((row: any) => {
      const followerId = row.follower_id as string;
      const followeeId = row.followee_id as string;
      if (followeeId) followers.set(followeeId, (followers.get(followeeId) ?? 0) + 1);
      if (followerId) following.set(followerId, (following.get(followerId) ?? 0) + 1);
    });

    const visible = (profileRows ?? []).filter(
      (profile: any) =>
        profile.user_id &&
        profile.slug &&
        !profile.banned_at &&
        !profile.deleted_at &&
        !/^user-[a-f0-9]+$/i.test(profile.slug as string),
    );
    const signed = await signAvatarPaths(supabaseAdmin, visible.map((profile: any) => profile.avatar_path));

    return visible
      .map((profile: any) => {
        const userId = profile.user_id as string;
        const tier = String(profile.verification_tier ?? "").toLowerCase();
        return {
          userId,
          displayName: profile.display_name || profile.username || "Oventric member",
          username: profile.username ?? null,
          slug: profile.slug ?? null,
          avatarUrl: profile.avatar_path ? signed.get(profile.avatar_path) ?? null : null,
          bio: profile.bio ?? null,
          followersCount: followers.get(userId) ?? 0,
          followingCount: following.get(userId) ?? 0,
          verified: !!tier && tier !== "none",
        } satisfies PeopleLeaderboardPerson;
      })
      .sort(
        (a, b) =>
          b.followersCount - a.followersCount ||
          b.followingCount - a.followingCount ||
          a.displayName.localeCompare(b.displayName),
      );
  },
);


export interface IncomingFollowRequest {
  requesterId: string;
  requesterName: string;
  requesterSlug: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export const listIncomingFollowRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IncomingFollowRequest[]> => {
    const me = context.userId;
    const { data: rows, error } = await context.supabase
      .from("follow_requests")
      .select("requester_id, created_at")
      .eq("target_id", me)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const map = await loadPeople(context.supabase, (rows ?? []).map((r: any) => r.requester_id));
    return (rows ?? []).map((r: any) => {
      const p = map.get(r.requester_id);
      return {
        requesterId: r.requester_id,
        requesterName: p?.displayName ?? "Someone",
        requesterSlug: p?.slug ?? null,
        avatarUrl: p?.avatarUrl ?? null,
        createdAt: r.created_at,
      };
    });
  });

/** Suggested people to follow — active users you don't follow / haven't requested. */
export const listSuggestedFollows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(30).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SuggestedPerson[]> => {
    const me = context.userId;
    const limit = data.limit ?? 12;

    const [{ data: following }, { data: requested }] = await Promise.all([
      context.supabase.from("follows").select("followee_id").eq("follower_id", me),
      context.supabase.from("follow_requests").select("target_id").eq("requester_id", me),
    ]);
    const exclude = new Set<string>([me]);
    (following ?? []).forEach((r: any) => exclude.add(r.followee_id));
    (requested ?? []).forEach((r: any) => exclude.add(r.target_id));

    const { data: rows, error } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug, avatar_path, bio, reputation_stars")
      .not("user_id", "in", `(${[...exclude].map((v) => `"${v}"`).join(",") || '""'})`)
      .order("reputation_stars", { ascending: false, nullsFirst: false })
      .limit(limit * 3);
    if (error) throw error;

    const filtered = (rows ?? []).filter((p: any) => !exclude.has(p.user_id)).slice(0, limit);
    const signed = await signAvatarPaths(context.supabase, filtered.map((p: any) => p.avatar_path));
    const scored: SuggestedPerson[] = filtered.map((p: any) => ({
      userId: p.user_id,
      displayName: p.display_name || p.username || "Unnamed member",
      username: p.username ?? null,
      slug: p.slug ?? null,
      avatarUrl: p.avatar_path ? signed.get(p.avatar_path) ?? null : null,
      bio: p.bio ?? null,
      reputation: Number(p.reputation_stars ?? 0),
    }));
    return scored;
  });
