import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoryItem = {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  posterUrl: string | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
};


export type StoryGroup = {
  userId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  isMe: boolean;
  allViewed: boolean;
  items: StoryItem[];
};

/** Signed upload slot for one story media file (private story-media bucket). */
export const getStoryUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ filename: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
    const path = `${context.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("story-media")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token as string, signedUrl: signed.signedUrl as string };
  });

/** Signed upload slot for a video's poster frame (`<videoPath>.poster.jpg`). */
export const getStoryPosterUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoPath: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.videoPath.startsWith(`${context.userId}/`)) throw new Error("Forbidden");
    const path = `${data.videoPath}.poster.jpg`;
    const { data: signed, error } = await context.supabase.storage
      .from("story-media")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token as string };
  });


/** Persist uploaded story media (max 10 per publish). Auto-expires in 24h. */
export const publishStories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        items: z
          .array(
            z.object({
              path: z.string().min(1).max(500),
              mediaType: z.enum(["image", "video"]),
            }),
          )
          .min(1)
          .max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.items.map((i) => ({
      user_id: context.userId,
      media_path: i.path,
      media_type: i.mediaType,
    }));
    const { error } = await context.supabase.from("stories").insert(rows as never);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

/**
 * Stories disappear from the 24h circle rail but survive as **reels** — they
 * keep collecting views in Discover and on the author's profile, so nothing is
 * purged here anymore.
 */

/** Live story rail: my stories first, then people I follow / who follow me. */
export const listStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ groups: StoryGroup[] }> => {
    const { supabase, userId } = context;


    const [followingRes, followersRes] = await Promise.all([
      supabase.from("follows").select("followee_id").eq("follower_id", userId),
      supabase.from("follows").select("follower_id").eq("followee_id", userId),
    ]);
    const circle = new Set<string>([userId]);
    (followingRes.data ?? []).forEach((r: any) => circle.add(r.followee_id));
    (followersRes.data ?? []).forEach((r: any) => circle.add(r.follower_id));

    const { data: rows } = await supabase
      .from("stories")
      .select("id, user_id, media_path, media_type, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .in("user_id", Array.from(circle))
      .order("created_at", { ascending: true })
      .limit(300);
    if (!rows || rows.length === 0) return { groups: [] };

    const ids = rows.map((r: any) => r.id);
    const [{ data: views }, { data: profiles }] = await Promise.all([
      supabase.from("story_views").select("story_id").eq("viewer_id", userId).in("story_id", ids),
      supabase
        .from("profiles")
        .select("user_id, display_name, username, slug, avatar_path")
        .in("user_id", Array.from(new Set(rows.map((r: any) => r.user_id)))),
    ]);
    const viewed = new Set((views ?? []).map((v: any) => v.story_id));

    const avatarPaths = (profiles ?? []).map((p: any) => p.avatar_path).filter(Boolean);
    const avatarByPath = new Map<string, string>();
    if (avatarPaths.length) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrls(avatarPaths, 60 * 60 * 6);
      (signed ?? []).forEach((s: any) => {
        if (s.path && s.signedUrl) avatarByPath.set(s.path, s.signedUrl);
      });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mediaByPath = new Map<string, string>();
    const posterPaths = rows
      .filter((r: any) => r.media_type === "video")
      .map((r: any) => `${r.media_path}.poster.jpg`);
    const { data: mediaSigned } = await supabaseAdmin.storage
      .from("story-media")
      .createSignedUrls(
        [...rows.map((r: any) => r.media_path), ...posterPaths],
        60 * 60 * 6,
      );
    (mediaSigned ?? []).forEach((s: any) => {
      if (s.path && s.signedUrl) mediaByPath.set(s.path, s.signedUrl);
    });

    const profById = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const groups = new Map<string, StoryGroup>();
    rows.forEach((r: any) => {
      const url = mediaByPath.get(r.media_path);
      if (!url) return;
      let g = groups.get(r.user_id);
      if (!g) {
        const p: any = profById.get(r.user_id) ?? {};
        g = {
          userId: r.user_id,
          slug: p.slug ?? r.user_id,
          displayName: p.display_name ?? p.username ?? "Member",
          avatarUrl: p.avatar_path ? (avatarByPath.get(p.avatar_path) ?? null) : null,
          isMe: r.user_id === userId,
          allViewed: true,
          items: [],
        };
        groups.set(r.user_id, g);
      }
      const isViewed = viewed.has(r.id);
      if (!isViewed) g.allViewed = false;
      g.items.push({
        id: r.id,
        mediaUrl: url,
        mediaType: r.media_type === "video" ? "video" : "image",
        posterUrl:
          r.media_type === "video" ? (mediaByPath.get(`${r.media_path}.poster.jpg`) ?? null) : null,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        viewed: isViewed,
      });
    });


    const list = Array.from(groups.values());
    list.sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
      return 0;
    });
    return { groups: list };
  });

export const markStoryViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("story_views")
      .upsert({ story_id: data.storyId, viewer_id: context.userId } as never, {
        onConflict: "story_id,viewer_id",
      });
    return { ok: true };
  });

/**
 * React to a story: copies a snippet of the media into the DM bucket and opens
 * a direct message thread with the story owner carrying that snippet.
 */
export const reactToStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storyId: z.string().uuid(),
        emoji: z.string().min(1).max(8).optional(),
        body: z.string().trim().max(1000).optional(),
        /** Send only the media clip (no text) so the viewer can comment in chat. */
        clipOnly: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: story, error } = await supabase
      .from("stories")
      .select("id, user_id, media_path, media_type")
      .eq("id", data.storyId)
      .maybeSingle();
    if (error || !story) throw new Error("Story unavailable");
    const s: any = story;
    if (s.user_id === userId) return { ok: true, peerId: userId, skipped: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (s.media_path.split(".").pop() ?? "jpg").slice(0, 6);
    const dmPath = `dm/${userId}/${Date.now()}-story-${s.id.slice(0, 8)}.${ext}`;
    const { data: file } = await supabaseAdmin.storage.from("story-media").download(s.media_path);
    if (file) {
      await supabaseAdmin.storage.from("post-media").upload(dmPath, file, { upsert: true });
    }

    const joined = [data.emoji, data.body].filter(Boolean).join(" ").trim();
    // Clip-only: attach the story media with no text so the viewer writes their
    // own comment in the thread. Fall back to text when there's no media.
    const text = data.clipOnly ? (file ? null : "Shared your story") : joined || "Reacted to your story";
    const { error: dmErr } = await supabase.from("direct_messages").insert({
      sender_id: userId,
      recipient_id: s.user_id,
      body: text,
      media_path: file ? dmPath : null,
      media_type: file ? (s.media_type === "video" ? "video" : "image") : null,
    } as never);
    if (dmErr) throw new Error(dmErr.message);
    return { ok: true, peerId: s.user_id as string };
  });
