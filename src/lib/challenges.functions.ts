import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { loadCreatorPostsByIds, type CreatorPostDTO } from "./creators.functions";

export type ChallengeStatus = "draft" | "published" | "closed";
export type ChallengePhase = "upcoming" | "active" | "ended";

export interface ChallengeDTO {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  category: string | null;
  requiredTools: string[];
  rules: string;
  submissionRequirements: string;
  startsAt: string;
  endsAt: string;
  prizeTitle: string | null;
  prizeDetails: string | null;
  status: ChallengeStatus;
  phase: ChallengePhase;
  submissionCount: number;
  participantCount: number;
}

export interface ChallengeSubmissionDTO {
  id: string;
  featured: boolean;
  createdAt: string;
  post: CreatorPostDTO;
}

export interface ChallengeDetailDTO {
  challenge: ChallengeDTO;
  submissions: ChallengeSubmissionDTO[];
  participants: { userId: string; name: string; slug: string | null; avatarUrl: string | null }[];
}

type Row = Database["public"]["Tables"]["creator_challenges"]["Row"];
const COLS =
  "id, title, description, cover_url, category, required_tools, rules, submission_requirements, starts_at, ends_at, prize_title, prize_details, status, created_by, created_at, updated_at";

function anon() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function phaseOf(r: Pick<Row, "status" | "starts_at" | "ends_at">): ChallengePhase {
  const now = Date.now();
  if (r.status === "closed" || new Date(r.ends_at).getTime() <= now) return "ended";
  if (new Date(r.starts_at).getTime() > now) return "upcoming";
  return "active";
}

function toDTO(r: Row, subs: { user_id: string }[] = []): ChallengeDTO {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    coverUrl: r.cover_url,
    category: r.category,
    requiredTools: r.required_tools ?? [],
    rules: r.rules,
    submissionRequirements: r.submission_requirements,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    prizeTitle: r.prize_title,
    prizeDetails: r.prize_details,
    status: r.status as ChallengeStatus,
    phase: phaseOf(r),
    submissionCount: subs.length,
    participantCount: new Set(subs.map((s) => s.user_id)).size,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function staffRoles(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = new Set<string>((data ?? []).map((r: { role: string }) => r.role));
  return { canManage: roles.has("admin") || roles.has("content"), canModerate: roles.has("admin") || roles.has("content") || roles.has("moderator") };
}

/** Public: live and past challenges with real submission counts. */
export const listChallenges = createServerFn({ method: "GET" }).handler(async (): Promise<ChallengeDTO[]> => {
  const sb = anon();
  const { data, error } = await sb.from("creator_challenges").select(COLS).in("status", ["published", "closed"]).order("ends_at", { ascending: false }).limit(60);
  if (error || !data) return [];
  const ids = data.map((r) => r.id);
  const { data: subs } = ids.length
    ? await sb.from("creator_challenge_submissions").select("challenge_id, user_id").in("challenge_id", ids)
    : { data: [] as { challenge_id: string; user_id: string }[] };
  const list = data.map((r) => toDTO(r as Row, (subs ?? []).filter((s) => s.challenge_id === r.id)));
  const order = { active: 0, upcoming: 1, ended: 2 } as const;
  return list.sort((a, b) => order[a.phase] - order[b.phase]);
});

async function buildDetail(row: Row, subs: { id: string; post_id: string; user_id: string; featured: boolean; created_at: string }[]): Promise<ChallengeDetailDTO> {
  const posts = await loadCreatorPostsByIds(subs.map((s) => s.post_id));
  const byId = new Map(posts.map((p) => [p.id, p]));
  const submissions = subs
    .map((s) => ({ id: s.id, featured: s.featured, createdAt: s.created_at, post: byId.get(s.post_id) }))
    .filter((s): s is ChallengeSubmissionDTO => !!s.post)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt));
  const seen = new Map<string, ChallengeDetailDTO["participants"][number]>();
  for (const s of submissions) {
    const a = s.post.author as unknown as { userId: string; name: string; slug?: string | null; avatarUrl?: string | null };
    if (!seen.has(a.userId)) seen.set(a.userId, { userId: a.userId, name: a.name, slug: a.slug ?? null, avatarUrl: a.avatarUrl ?? null });
  }
  const challenge = toDTO(row, submissions.map((s) => ({ user_id: s.post.author.userId })));
  return { challenge, submissions, participants: [...seen.values()] };
}

/** Public: one challenge with visible submissions and participating creators. */
export const getChallenge = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<ChallengeDetailDTO | null> => {
    const sb = anon();
    const { data: row } = await sb.from("creator_challenges").select(COLS).eq("id", data.id).maybeSingle();
    if (!row) return null;
    const { data: subs } = await sb
      .from("creator_challenge_submissions")
      .select("id, post_id, user_id, featured, created_at")
      .eq("challenge_id", data.id)
      .eq("status", "visible")
      .limit(200);
    return buildDetail(row as Row, subs ?? []);
  });

/** Signed-in: the caller's published posts they can enter, plus what's already entered. */
export const getMyChallengeEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { challengeId: string }) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [{ data: posts }, { data: mine }] = await Promise.all([
      sb.from("creator_posts").select("id, title, caption, created_at").eq("author_id", context.userId).eq("status", "published").order("created_at", { ascending: false }).limit(100),
      sb.from("creator_challenge_submissions").select("id, post_id, status").eq("challenge_id", data.challengeId).eq("user_id", context.userId),
    ]);
    return {
      posts: ((posts ?? []) as { id: string; title: string | null; caption: string | null; created_at: string }[]).map((p) => ({
        id: p.id,
        title: p.title || (p.caption ?? "").slice(0, 80) || "Untitled post",
        createdAt: p.created_at,
      })),
      entries: ((mine ?? []) as { id: string; post_id: string; status: string }[]).map((m) => ({ id: m.id, postId: m.post_id, hidden: m.status === "hidden" })),
    };
  });

/** Enter an existing published post. Ownership, open dates and status are enforced by the database. */
export const submitToChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { challengeId: string; postId: string }) => z.object({ challengeId: z.string().uuid(), postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("creator_challenge_submissions").insert({ challenge_id: data.challengeId, post_id: data.postId, user_id: context.userId });
    if (error) {
      if (error.code === "23505") throw new Error("That post is already entered.");
      throw new Error("This challenge isn't accepting that entry. It may be closed, or the post isn't yours and published.");
    }
    return { ok: true };
  });

export const withdrawChallengeSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("creator_challenge_submissions").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error("Couldn't withdraw this entry.");
    return { ok: true };
  });

/* ---------------------------- Admin ---------------------------- */

export interface AdminSubmissionDTO {
  id: string;
  postId: string;
  postTitle: string;
  authorName: string;
  status: "visible" | "hidden";
  featured: boolean;
  note: string | null;
  createdAt: string;
}

export const adminListChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const perms = await staffRoles(context);
    if (!perms.canModerate) throw new Error("Forbidden");
    const sb = context.supabase as any;
    const { data } = await sb.from("creator_challenges").select(COLS).order("created_at", { ascending: false }).limit(200);
    const rows = (data ?? []) as Row[];
    const ids = rows.map((r) => r.id);
    const { data: subs } = ids.length ? await sb.from("creator_challenge_submissions").select("challenge_id, user_id").in("challenge_id", ids) : { data: [] };
    return {
      perms,
      challenges: rows.map((r) => toDTO(r, ((subs ?? []) as { challenge_id: string; user_id: string }[]).filter((s) => s.challenge_id === r.id))),
    };
  });

const saveSchema = z.object({
  id: z.string().uuid().nullable(),
  title: z.string().trim().min(2).max(120),
  description: z.string().max(4000),
  coverUrl: z.string().trim().url().startsWith("https://").max(1000).nullable().or(z.literal("").transform(() => null)),
  category: z.string().max(60).nullable(),
  requiredTools: z.array(z.string().trim().min(1).max(40)).max(12),
  rules: z.string().max(4000),
  submissionRequirements: z.string().max(2000),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  prizeTitle: z.string().max(120).nullable(),
  prizeDetails: z.string().max(2000).nullable(),
});

export const adminSaveChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof saveSchema>) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const perms = await staffRoles(context);
    if (!perms.canManage) throw new Error("Forbidden");
    if (new Date(data.endsAt) <= new Date(data.startsAt)) throw new Error("End date must be after the start date.");
    const sb = context.supabase as any;
    const payload = {
      title: data.title,
      description: data.description,
      cover_url: data.coverUrl,
      category: data.category || null,
      required_tools: data.requiredTools,
      rules: data.rules,
      submission_requirements: data.submissionRequirements,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      prize_title: data.prizeTitle || null,
      prize_details: data.prizeDetails || null,
    };
    if (data.id) {
      const { error } = await sb.from("creator_challenges").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await sb.from("creator_challenges").insert({ ...payload, created_by: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminSetChallengeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: ChallengeStatus }) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "closed"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const perms = await staffRoles(context);
    if (!perms.canManage) throw new Error("Forbidden");
    const { error } = await (context.supabase as any).from("creator_challenges").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const perms = await staffRoles(context);
    if (!perms.canManage) throw new Error("Forbidden");
    const { error } = await (context.supabase as any).from("creator_challenges").delete().eq("id", data.id).eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListChallengeSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { challengeId: string }) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AdminSubmissionDTO[]> => {
    const perms = await staffRoles(context);
    if (!perms.canModerate) throw new Error("Forbidden");
    const sb = context.supabase as any;
    const { data: subs } = await sb
      .from("creator_challenge_submissions")
      .select("id, post_id, user_id, status, featured, moderation_note, created_at")
      .eq("challenge_id", data.challengeId)
      .order("created_at", { ascending: false })
      .limit(300);
    const list = (subs ?? []) as { id: string; post_id: string; user_id: string; status: "visible" | "hidden"; featured: boolean; moderation_note: string | null; created_at: string }[];
    if (!list.length) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: posts }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("creator_posts").select("id, title, caption").in("id", list.map((s) => s.post_id)),
      supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", list.map((s) => s.user_id)),
    ]);
    const pm = new Map((posts ?? []).map((p) => [p.id, p.title || (p.caption ?? "").slice(0, 80) || "Untitled post"]));
    const am = new Map((profs ?? []).map((p) => [p.user_id, p.display_name ?? "Creator"]));
    return list.map((s) => ({
      id: s.id,
      postId: s.post_id,
      postTitle: pm.get(s.post_id) ?? "Post removed",
      authorName: am.get(s.user_id) ?? "Creator",
      status: s.status,
      featured: s.featured,
      note: s.moderation_note,
      createdAt: s.created_at,
    }));
  });

export const adminModerateSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: "visible" | "hidden"; featured?: boolean; note?: string | null }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["visible", "hidden"]).optional(), featured: z.boolean().optional(), note: z.string().max(500).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const perms = await staffRoles(context);
    if (!perms.canModerate) throw new Error("Forbidden");
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.featured !== undefined) patch.featured = data.featured;
    if (data.note !== undefined) patch.moderation_note = data.note;
    if (data.status === "hidden") patch.featured = false;
    const { error } = await (context.supabase as any).from("creator_challenge_submissions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
