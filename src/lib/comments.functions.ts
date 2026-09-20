import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { REACTION_TYPES, type ReactionType } from "@/lib/posts.functions";
import { imageStorage } from "@/lib/storage/images.server";

const CreateInput = z.object({
  postId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
  authorName: z.string().trim().min(1).max(80).default("Guest"),
  initials: z.string().trim().min(1).max(4).default("OV"),
  parentId: z.string().uuid().nullable().optional(),
});

export interface FeedComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_username: string | null;
  author_slug: string | null;
  author_avatar_url: string | null;
  initials: string;
  text: string;
  created_at: string;
  parent_id: string | null;
  reactions: Record<ReactionType, number>;
  viewer_reaction: ReactionType | null;
}


function zero(): Record<ReactionType, number> {
  return { love: 0, like: 0, dislike: 0, laugh: 0, crown: 0 };
}

async function getViewerClient(): Promise<{ sb: SupabaseClient<Database>; userId: string | null }> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const req = getRequest();
  const authHeader = req?.headers?.get?.("authorization") ?? null;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (token && token.split(".").length === 3) {
    const sb = createClient<Database>(SUPABASE_URL, KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    try {
      const { data } = await sb.auth.getClaims(token);
      const userId = (data?.claims?.sub as string | undefined) ?? null;
      return { sb, userId };
    } catch { /* fallthrough */ }
  }
  const sb = createClient<Database>(SUPABASE_URL, KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return { sb, userId: null };
}

export const listComments = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { sb, userId } = await getViewerClient();
    const { data: rows, error } = await sb
      .from("post_comments")
      .select("id, post_id, author_id, author_name, initials, text, created_at, parent_id" as any)
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[listComments] failed", error);
      throw new Error("Failed to load comments");
    }
    const commentRows = (rows ?? []) as any[];
    const commentIds = commentRows.map((c) => c.id as string);
    let reactionsByComment = new Map<string, Record<ReactionType, number>>();
    let viewerByComment = new Map<string, ReactionType>();
    if (commentIds.length) {
      const { data: rxs } = await sb
        .from("comment_reactions" as any)
        .select("comment_id, user_id, reaction")
        .in("comment_id", commentIds);
      ((rxs ?? []) as any[]).forEach((r) => {
        const kind = (REACTION_TYPES as string[]).includes(r.reaction) ? (r.reaction as ReactionType) : "love";
        const b = reactionsByComment.get(r.comment_id) ?? zero();
        b[kind] += 1;
        reactionsByComment.set(r.comment_id, b);
        if (userId && r.user_id === userId) viewerByComment.set(r.comment_id, kind);
      });
    }
    // Live profile data (avatar, username, slug) for each commenter.
    const authorIds = Array.from(new Set(commentRows.map((c) => c.author_id).filter(Boolean)));
    const profById = new Map<string, any>();
    const avatarByPath = new Map<string, string>();
    if (authorIds.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id, display_name, username, slug, avatar_path")
        .in("user_id", authorIds);
      (profs ?? []).forEach((p: any) => profById.set(p.user_id, p));
      const paths = Array.from(
        new Set((profs ?? []).map((p: any) => p.avatar_path).filter((p: any): p is string => !!p)),
      );
      if (paths.length) {
        const { data: signed } = await (await imageStorage()).from("avatars").createSignedUrls(paths, 60 * 60 * 6);
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) avatarByPath.set(s.path, s.signedUrl);
        });
      }
    }

    const comments: FeedComment[] = commentRows.map((c) => {
      const prof = profById.get(c.author_id);
      return {
        id: c.id,
        post_id: c.post_id,
        author_id: c.author_id,
        author_name: prof?.display_name || c.author_name,
        author_username: prof?.username ?? null,
        author_slug: prof?.slug ?? null,
        author_avatar_url: prof?.avatar_path ? (avatarByPath.get(prof.avatar_path) ?? null) : null,
        initials: c.initials,
        text: c.text,
        created_at: c.created_at,
        parent_id: (c.parent_id ?? null) as string | null,
        reactions: reactionsByComment.get(c.id) ?? zero(),
        viewer_reaction: viewerByComment.get(c.id) ?? null,
      };
    });

    return { comments };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("post_comments")
      .insert({
        post_id: data.postId,
        author_id: context.userId,
        author_name: data.authorName,
        initials: data.initials,
        text: data.text,
        parent_id: data.parentId ?? null,
      } as any)
      .select("id, post_id, author_id, author_name, initials, text, created_at, parent_id" as any)
      .single();
    if (error) {
      console.error("[addComment] insert failed", error);
      throw new Error("Failed to post comment");
    }
    const r = row as any;
    const out: FeedComment = {
      id: r.id,
      post_id: r.post_id,
      author_id: r.author_id,
      author_name: r.author_name,
      author_username: null,
      author_slug: null,
      author_avatar_url: null,
      initials: r.initials,
      text: r.text,
      created_at: r.created_at,
      parent_id: (r.parent_id ?? null) as string | null,
      reactions: zero(),
      viewer_reaction: null,
    };
    return { comment: out };
  });

export const updateComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), text: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("post_comments")
      .update({ text: data.text })
      .eq("id", data.id)
      .eq("author_id", context.userId)
      .select("id, post_id, author_id, author_name, initials, text, created_at, parent_id" as any)
      .single();
    if (error || !row) {
      console.error("[updateComment] failed", error);
      throw new Error("Failed to update comment");
    }
    const r = row as any;
    const out: FeedComment = {
      id: r.id,
      post_id: r.post_id,
      author_id: r.author_id,
      author_name: r.author_name,
      author_username: null,
      author_slug: null,
      author_avatar_url: null,
      initials: r.initials,
      text: r.text,
      created_at: r.created_at,
      parent_id: (r.parent_id ?? null) as string | null,
      reactions: zero(),
      viewer_reaction: null,
    };
    return { comment: out };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("post_comments")
      .delete()
      .eq("id", data.id)
      .eq("author_id", context.userId);
    if (error) {
      console.error("[deleteComment] failed", error);
      throw new Error("Failed to delete comment");
    }
    return { id: data.id };
  });

// Set (or clear) the viewer's reaction on a comment. null removes.
export const setCommentReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      commentId: z.string().uuid(),
      reaction: z.enum(["love", "like", "dislike", "laugh", "crown"]).nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.reaction === null) {
      const { error } = await context.supabase
        .from("comment_reactions" as any)
        .delete()
        .eq("comment_id", data.commentId)
        .eq("user_id", context.userId);
      if (error) {
        console.error("[setCommentReaction] delete failed", error);
        throw new Error("Failed to remove reaction");
      }
    } else {
      const { error } = await context.supabase
        .from("comment_reactions" as any)
        .upsert(
          { comment_id: data.commentId, user_id: context.userId, reaction: data.reaction },
          { onConflict: "comment_id,user_id" },
        );
      if (error) {
        console.error("[setCommentReaction] upsert failed", error);
        throw new Error("Failed to react");
      }
    }
    return { commentId: data.commentId, reaction: data.reaction };
  });
