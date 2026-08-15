import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type BlogStatus = "draft" | "published" | "scheduled";
export type BlogReaction = "love" | "like" | "laugh" | "crown";

export interface BlogListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_url: string | null;
  category_slug: string | null;
  category_name: string | null;
  author_name: string;
  published_at: string | null;
  reactions_count: number;
  comments_count: number;
}

export interface BlogDetail extends BlogListItem {
  body_html: string;
  cover_path?: string | null;
  tags: { slug: string; name: string }[];
  viewer_reaction: BlogReaction | null;
}

export interface BlogAdminRow {
  id: string;
  slug: string;
  title: string;
  status: BlogStatus;
  category_id: string | null;
  category_name: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  cover_url: string | null;
  updated_at: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `post-${Math.random().toString(36).slice(2, 8)}`;
}

// Very small sanitiser: strip <script>, on* handlers, javascript: urls.
function sanitiseHtml(html: string): string {
  let out = html;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/ on[a-z]+="[^"]*"/gi, "");
  out = out.replace(/ on[a-z]+='[^']*'/gi, "");
  out = out.replace(/javascript:/gi, "");
  // Allow iframes only when they embed a YouTube video; drop everything else.
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>|<iframe\b[^>]*\/?>/gi, (tag) => {
    const src = /\ssrc=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    const id = parseYouTubeId(src);
    if (!id) return "";
    return `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`;
  });
  return out.slice(0, 200_000);
}

function excerptFrom(html: string, maxLen = 220): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
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
    } catch { /* fall through */ }
  }
  const sb = createClient<Database>(SUPABASE_URL, KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return { sb, userId: null };
}

async function signCovers(sb: SupabaseClient<Database>, paths: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const map = new Map<string, string>();
  if (!uniq.length) return map;
  const { data } = await sb.storage.from("blog-covers").createSignedUrls(uniq, 60 * 60 * 6);
  (data ?? []).forEach((s) => { if (s.path && s.signedUrl) map.set(s.path, s.signedUrl); });
  return map;
}

async function ensureAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

// ─── Public list ──────────────────────────────────────────────────────────────

export const listBlogPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { sb } = await getViewerClient();
  const { data: rows, error } = await sb
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_path, author_id, published_at, category_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  const list = rows ?? [];
  if (!list.length) return { posts: [] as BlogListItem[] };

  const catIds = Array.from(new Set(list.map((r) => r.category_id).filter((x): x is string => !!x)));
  const authorIds = Array.from(new Set(list.map((r) => r.author_id)));
  const postIds = list.map((r) => r.id);

  const [{ data: cats }, { data: profs }, { data: reactRows }, { data: commentRows }] = await Promise.all([
    catIds.length ? sb.from("blog_categories").select("id, slug, name").in("id", catIds) : Promise.resolve({ data: [] as any }),
    sb.from("profiles").select("user_id, display_name, username").in("user_id", authorIds),
    sb.from("blog_reactions").select("post_id").in("post_id", postIds),
    sb.from("blog_comments").select("post_id").in("post_id", postIds),
  ]);
  const covers = await signCovers(sb, list.map((r) => r.cover_path).filter((p): p is string => !!p));
  const catById = new Map((cats ?? []).map((c: any) => [c.id, c]));
  const authorById = new Map((profs ?? []).map((p) => [p.user_id, p]));
  const reactCount = new Map<string, number>();
  (reactRows ?? []).forEach((r: any) => reactCount.set(r.post_id, (reactCount.get(r.post_id) ?? 0) + 1));
  const commentCount = new Map<string, number>();
  (commentRows ?? []).forEach((r: any) => commentCount.set(r.post_id, (commentCount.get(r.post_id) ?? 0) + 1));

  const posts: BlogListItem[] = list.map((r) => {
    const cat = r.category_id ? catById.get(r.category_id) : null;
    const p = authorById.get(r.author_id);
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      cover_url: r.cover_path ? covers.get(r.cover_path) ?? null : null,
      category_slug: (cat as any)?.slug ?? null,
      category_name: (cat as any)?.name ?? null,
      author_name: p?.display_name || p?.username || "Oventric",
      published_at: r.published_at,
      reactions_count: reactCount.get(r.id) ?? 0,
      comments_count: commentCount.get(r.id) ?? 0,
    };
  });
  return { posts };
});

// ─── Public detail ────────────────────────────────────────────────────────────

export const getBlogPost = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(i))
  .handler(async ({ data }) => {
    const { sb, userId } = await getViewerClient();
    const { data: row, error } = await sb
      .from("blog_posts")
      .select("id, slug, title, excerpt, body_html, cover_path, author_id, published_at, category_id")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { post: null as BlogDetail | null };

    const [{ data: cat }, { data: prof }, { data: tagRows }, { data: reactRows }, { data: commentRows }] = await Promise.all([
      row.category_id ? sb.from("blog_categories").select("slug, name").eq("id", row.category_id).maybeSingle() : Promise.resolve({ data: null as any }),
      sb.from("profiles").select("display_name, username").eq("user_id", row.author_id).maybeSingle(),
      sb.from("blog_post_tags").select("tag_id, blog_tags(slug, name)").eq("post_id", row.id),
      sb.from("blog_reactions").select("post_id, user_id, reaction").eq("post_id", row.id),
      sb.from("blog_comments").select("id").eq("post_id", row.id),
    ]);
    const covers = row.cover_path ? await signCovers(sb, [row.cover_path]) : new Map<string, string>();
    const tags = (tagRows ?? []).map((t: any) => t.blog_tags).filter(Boolean).map((t: any) => ({ slug: t.slug, name: t.name }));
    const viewer = userId ? (reactRows ?? []).find((r: any) => r.user_id === userId) : null;

    const post: BlogDetail = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      body_html: row.body_html,
      cover_url: row.cover_path ? covers.get(row.cover_path) ?? null : null,
      cover_path: row.cover_path ?? null,
      category_slug: (cat as any)?.slug ?? null,
      category_name: (cat as any)?.name ?? null,
      author_name: (prof as any)?.display_name || (prof as any)?.username || "Oventric",
      published_at: row.published_at,
      reactions_count: (reactRows ?? []).length,
      comments_count: (commentRows ?? []).length,
      tags,
      viewer_reaction: (viewer as any)?.reaction ?? null,
    };
    return { post };
  });

// ─── Public categories/tags (for filter chips) ────────────────────────────────

export const listBlogCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { sb } = await getViewerClient();
  const { data, error } = await sb.from("blog_categories").select("id, slug, name, sort_order").order("sort_order").order("name");
  if (error) throw new Error(error.message);
  return { categories: data ?? [] };
});

export const listBlogTags = createServerFn({ method: "GET" }).handler(async () => {
  const { sb } = await getViewerClient();
  const { data, error } = await sb.from("blog_tags").select("id, slug, name").order("name");
  if (error) throw new Error(error.message);
  return { tags: data ?? [] };
});

// ─── Public comments ──────────────────────────────────────────────────────────

export const listBlogComments = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { sb } = await getViewerClient();
    const { data: rows, error } = await sb
      .from("blog_comments")
      .select("id, post_id, user_id, author_name, initials, text, created_at, is_hidden")
      .eq("post_id", data.postId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { comments: rows ?? [] };
  });

export const addBlogComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      postId: z.string().uuid(),
      text: z.string().trim().min(1).max(2000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase.from("profiles").select("display_name, username").eq("user_id", context.userId).maybeSingle();
    const name = (prof as any)?.display_name || (prof as any)?.username || "Member";
    const initials = name.split(/\s+/).filter(Boolean).map((s: string) => s[0]).slice(0, 2).join("").toUpperCase() || "OV";
    const { data: row, error } = await context.supabase.from("blog_comments").insert({
      post_id: data.postId,
      user_id: context.userId,
      author_name: name,
      initials,
      text: data.text,
    }).select("id, post_id, user_id, author_name, initials, text, created_at").single();
    if (error) throw new Error(error.message);
    return { comment: row };
  });

// ─── Public reactions ─────────────────────────────────────────────────────────

export const setBlogReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      postId: z.string().uuid(),
      reaction: z.enum(["love", "like", "laugh", "crown"]).nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.reaction === null) {
      await context.supabase.from("blog_reactions").delete().eq("post_id", data.postId).eq("user_id", context.userId);
    } else {
      await context.supabase.from("blog_reactions").upsert(
        { post_id: data.postId, user_id: context.userId, reaction: data.reaction } as any,
        { onConflict: "post_id,user_id" },
      );
    }
    return { ok: true };
  });

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export const listBlogAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("blog_posts")
      .select("id, slug, title, status, category_id, published_at, scheduled_at, cover_path, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const catIds = Array.from(new Set((rows ?? []).map((r: any) => r.category_id).filter(Boolean)));
    const { data: cats } = catIds.length
      ? await context.supabase.from("blog_categories").select("id, name").in("id", catIds)
      : { data: [] as any };
    const catName = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
    const covers = await signCovers(context.supabase, (rows ?? []).map((r: any) => r.cover_path).filter(Boolean));
    const out: BlogAdminRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status,
      category_id: r.category_id,
      category_name: r.category_id ? ((catName.get(r.category_id) as string | undefined) ?? null) : null,
      published_at: r.published_at,
      scheduled_at: r.scheduled_at,
      cover_url: r.cover_path ? covers.get(r.cover_path) ?? null : null,
      updated_at: r.updated_at,
    }));
    return { rows: out };
  });

export const getBlogAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, body_html, cover_path, status, category_id, published_at, scheduled_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error(error?.message ?? "Not found");
    const { data: tagRows } = await context.supabase.from("blog_post_tags").select("tag_id").eq("post_id", row.id);
    const covers = row.cover_path ? await signCovers(context.supabase, [row.cover_path]) : new Map<string, string>();
    return {
      post: {
        ...row,
        cover_url: row.cover_path ? covers.get(row.cover_path) ?? null : null,
        tag_ids: (tagRows ?? []).map((t: any) => t.tag_id),
      },
    };
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(120).optional(),
  excerpt: z.string().max(500).optional(),
  body_html: z.string().max(200_000),
  cover_path: z.string().max(500).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "published", "scheduled"]),
  scheduled_at: z.string().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).max(20).optional(),
});

export const upsertBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertInput.parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const body_html = sanitiseHtml(data.body_html);
    const excerpt = (data.excerpt && data.excerpt.trim()) || excerptFrom(body_html);
    const slug = (data.slug && data.slug.trim()) ? slugify(data.slug) : slugify(data.title);
    const now = new Date().toISOString();
    const published_at = data.status === "published" ? now : null;
    const scheduled_at = data.status === "scheduled" ? (data.scheduled_at ?? null) : null;
    const payload: any = {
      title: data.title,
      slug,
      excerpt,
      body_html,
      cover_path: data.cover_path ?? null,
      category_id: data.category_id ?? null,
      status: data.status,
      published_at,
      scheduled_at,
    };
    let id = data.id;
    if (id) {
      const { error } = await context.supabase.from("blog_posts").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      payload.author_id = context.userId;
      const { data: row, error } = await context.supabase.from("blog_posts").insert(payload).select("id").single();
      if (error || !row) throw new Error(error?.message ?? "Insert failed");
      id = row.id;
    }
    // Refresh tag set
    if (data.tag_ids) {
      await context.supabase.from("blog_post_tags").delete().eq("post_id", id!);
      if (data.tag_ids.length) {
        await context.supabase.from("blog_post_tags").insert(data.tag_ids.map((t) => ({ post_id: id!, tag_id: t })));
      }
    }
    return { id: id!, slug };
  });

export const deleteBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertBlogCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const slug = slugify(data.name);
    if (data.id) {
      const { error } = await context.supabase.from("blog_categories").update({ name: data.name, slug }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, slug, name: data.name };
    }
    const { data: row, error } = await context.supabase.from("blog_categories").insert({ name: data.name, slug }).select("id, slug, name").single();
    if (error || !row) throw new Error(error?.message ?? "Insert failed");
    return row;
  });

export const upsertBlogTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: z.string().trim().min(1).max(60) }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const slug = slugify(data.name);
    // Return existing on conflict
    const { data: existing } = await context.supabase.from("blog_tags").select("id, slug, name").eq("slug", slug).maybeSingle();
    if (existing) return existing;
    const { data: row, error } = await context.supabase.from("blog_tags").insert({ name: data.name, slug }).select("id, slug, name").single();
    if (error || !row) throw new Error(error?.message ?? "Insert failed");
    return row;
  });
