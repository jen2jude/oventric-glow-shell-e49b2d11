import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertLegacyFeatureDisabled } from "@/lib/mvp-features";

export type CircleRole = "owner" | "admin" | "member";
export type JoinStatus = "none" | "pending" | "awaiting_coc" | "member";

const CircleIdInput = z.object({ circleId: z.string().uuid() });
const SlugInput = z.object({ slug: z.string().min(1).max(80) });
const UserInput = z.object({ userId: z.string().uuid() });

const CoCQuestionSchema = z.object({ id: z.string(), text: z.string().trim().min(1).max(500) });
const CoCSchema = z.object({
  pledge: z.string().max(2000),
  questions: z.array(CoCQuestionSchema).max(30),
});

const CreateCircleInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional(),
  isPrivate: z.boolean().optional(),
  category: z.string().trim().max(60).optional(),
  emoji: z.string().trim().max(8).optional(),
  avatarUrl: z.string().max(1000).optional(),
  coverUrl: z.string().max(1000).optional(),
  codeOfConduct: CoCSchema.optional(),
});

const UpdateCircleInput = z.object({
  circleId: z.string().uuid(),
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  isPrivate: z.boolean().optional(),
  avatarUrl: z.string().max(1000).nullable().optional(),
  coverUrl: z.string().max(1000).nullable().optional(),
  category: z.string().trim().max(60).optional(),
  emoji: z.string().trim().max(8).optional(),
  codeOfConduct: CoCSchema.optional(),
});

const RequestActionInput = z.object({ requestId: z.string().uuid() });

const CreatePostInput = z.object({
  circleId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
  mediaPath: z.string().max(600).optional(),
  mediaType: z.enum(["image", "video"]).optional(),
});

const CoCInput = z.object({
  circleId: z.string().uuid(),
  answers: z.array(z.object({ id: z.string(), text: z.string().max(1000) })).max(30),
  agreedPledge: z.literal(true),
});


const ResourceInput = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  url: z.string().url().max(1000),
  kind: z.string().trim().max(40).optional(),
});

export interface CoCQuestion {
  id: string;
  text: string;
}
export interface CodeOfConduct {
  pledge: string;
  questions: CoCQuestion[];
}

export interface CircleSummary {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  isPrivate: boolean;
  category: string;
  emoji: string;
  bannerHue: string;
  avatarHue: string;
  memberCount: number;
  myRole: CircleRole | null;
  myStatus: JoinStatus;
  codeOfConduct: CodeOfConduct;
  createdAt: string;
}


export interface CircleJoinRequestRow {
  id: string;
  circleId: string;
  circleName: string;
  circleSlug: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar: string | null;
  requesterSlug: string | null;
  status: "pending" | "awaiting_coc" | "accepted" | "declined";
  createdAt: string;
}

export interface CirclePostRow {
  id: string;
  circleId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorSlug: string | null;
  text: string;
  mediaPath: string | null;
  mediaType: string | null;
  createdAt: string;
}

export interface CircleMemberRow {
  userId: string;
  role: CircleRole;
  joinedAt: string;
  name: string;
  avatar: string | null;
  slug: string | null;
}

export interface CircleResourceRow {
  id: string;
  title: string;
  url: string;
  kind: string;
  pinned: boolean;
  addedBy: string;
  createdAt: string;
}

export interface CircleBountyRow {
  id: string;
  title: string;
  category: string | null;
  priceUsd: number;
  posterId: string;
  posterName: string;
  status: string;
  createdAt: string;
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `circle-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_COC: CodeOfConduct = {
  pledge:
    "Be kind, respectful, and constructive. No spam, harassment, or self-promo without value.",
  questions: [
    { id: "q1", text: "Why do you want to join this circle?" },
    { id: "q2", text: "What will you contribute to other members?" },
    { id: "q3", text: "Have you read and will you respect the pinned rules?" },
    { id: "q4", text: "Will you keep discussions on-topic and helpful?" },
    { id: "q5", text: "Will you treat every member with respect?" },
  ],
};

function normalizeCoc(v: unknown): CodeOfConduct {
  const o = (v ?? {}) as Partial<CodeOfConduct>;
  return {
    pledge: typeof o.pledge === "string" && o.pledge.trim() ? o.pledge : DEFAULT_COC.pledge,
    questions: Array.isArray(o.questions) && o.questions.length > 0 ? o.questions.slice(0, 30) : DEFAULT_COC.questions,
  };
}

const CIRCLE_AVATAR_BUCKET = "circle-avatars";
const CIRCLE_COVER_BUCKET = "circle-covers";

async function resolveCircleImage(
  supabase: any,
  bucket: "circle-avatars" | "circle-covers",
  value: string | null,
): Promise<string | null> {
  if (!value) return null;
  // Full URLs (legacy or external) are returned as-is.
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(value, 60 * 60 * 24 * 7);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl as string;
  } catch {
    return null;
  }
}


async function annotateCircles(supabase: any, meId: string | null, rows: any[]): Promise<CircleSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [allMembersRes, myMembership, myReqs] = await Promise.all([
    supabase.from("circle_members").select("circle_id").in("circle_id", ids),
    meId
      ? supabase.from("circle_members").select("circle_id, role").eq("user_id", meId).in("circle_id", ids)
      : Promise.resolve({ data: [] as any[] }),
    meId
      ? supabase
          .from("circle_join_requests")
          .select("circle_id, status")
          .eq("requester_id", meId)
          .in("circle_id", ids)
          .in("status", ["pending", "awaiting_coc"])
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, 0);
  (allMembersRes.data ?? []).forEach((m: any) =>
    counts.set(m.circle_id, (counts.get(m.circle_id) ?? 0) + 1),
  );

  const roleMap = new Map<string, CircleRole>((myMembership.data ?? []).map((r: any) => [r.circle_id, r.role]));
  const reqMap = new Map<string, string>((myReqs.data ?? []).map((r: any) => [r.circle_id, r.status]));

  const resolved = await Promise.all(
    rows.map(async (r) => ({
      avatarUrl: await resolveCircleImage(supabase, CIRCLE_AVATAR_BUCKET, r.avatar_url ?? null),
      coverUrl: await resolveCircleImage(supabase, CIRCLE_COVER_BUCKET, r.cover_url ?? null),
    })),
  );

  return rows.map((r, i) => {
    const myRole = roleMap.get(r.id) ?? null;
    const reqStatus = reqMap.get(r.id);
    const myStatus: JoinStatus = myRole
      ? "member"
      : reqStatus === "awaiting_coc"
      ? "awaiting_coc"
      : reqStatus === "pending"
      ? "pending"
      : "none";
    return {
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      avatarUrl: resolved[i].avatarUrl,
      coverUrl: resolved[i].coverUrl,
      isPrivate: r.is_private,
      category: r.category ?? "SaaS Builders",
      emoji: r.emoji ?? "🛡️",
      bannerHue: r.banner_hue ?? "from-emerald-500 via-teal-600 to-cyan-700",
      avatarHue: r.avatar_hue ?? "from-emerald-500 to-teal-700",
      memberCount: counts.get(r.id) ?? 0,
      myRole,
      myStatus,
      codeOfConduct: normalizeCoc(r.code_of_conduct),
      createdAt: r.created_at,
    } satisfies CircleSummary;
  });
}


export const createCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateCircleInput.parse(d))
  .handler(async ({ data, context }): Promise<CircleSummary> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const me = context.userId;
    const base = slugify(data.name);
    let slug = base;
    for (let i = 0; i < 6; i++) {
      const { data: row, error } = await context.supabase
        .from("circles")
        .insert({
          owner_id: me,
          name: data.name,
          slug,
          description: data.description ?? null,
          avatar_url: data.avatarUrl ?? null,
          cover_url: data.coverUrl ?? null,
          is_private: data.isPrivate ?? false,
          category: data.category ?? "SaaS Builders",
          emoji: data.emoji ?? "🛡️",
          code_of_conduct: data.codeOfConduct ?? null,
        })
        .select("*")
        .single();

      if (!error && row) {
        const [annotated] = await annotateCircles(context.supabase, me, [row]);
        return annotated;
      }
      const code = (error as any)?.code;
      if (code === "23505") {
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      console.error("[createCircle]", error);
      throw new Error("Failed to create circle");
    }
    throw new Error("Could not allocate a unique slug");
  });

export const updateCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateCircleInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.isPrivate !== undefined) patch.is_private = data.isPrivate;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;
    if (data.coverUrl !== undefined) patch.cover_url = data.coverUrl;

    if (data.category !== undefined) patch.category = data.category;
    if (data.emoji !== undefined) patch.emoji = data.emoji;
    if (data.codeOfConduct !== undefined) patch.code_of_conduct = data.codeOfConduct;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("circles").update(patch as any).eq("id", data.circleId);
    if (error) throw new Error("Failed to update circle");
    return { ok: true };
  });

export const deleteCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const { error } = await context.supabase.from("circles").delete().eq("id", data.circleId);
    if (error) throw new Error("Failed to delete circle");
    return { ok: true } as const;
  });

/** Catalog for the Circles page: trending, most active, top earners, mine, and everything visible. */
export const getCircleCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      all: CircleSummary[];
      trending: CircleSummary[];
      mostActive: CircleSummary[];
      topEarners: CircleSummary[];
      mine: CircleSummary[];
    }> => {
      const me = context.userId;
      const { data: rows, error } = await context.supabase
        .from("circles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const summaries = await annotateCircles(context.supabase, me, rows ?? []);

      // Trending = highest memberCount
      const trending = [...summaries].sort((a, b) => b.memberCount - a.memberCount).slice(0, 8);

      // Most active = most posts in last 7d
      const ids = summaries.map((s) => s.id);
      let mostActive: CircleSummary[] = [];
      let topEarners: CircleSummary[] = [];
      if (ids.length > 0) {
        const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { data: recent } = await context.supabase
          .from("posts")
          .select("circle_id")
          .in("circle_id", ids)
          .gte("created_at", since);
        const activityMap = new Map<string, number>();
        (recent ?? []).forEach((p: any) => {
          if (p.circle_id) activityMap.set(p.circle_id, (activityMap.get(p.circle_id) ?? 0) + 1);
        });
        mostActive = [...summaries]
          .filter((s) => (activityMap.get(s.id) ?? 0) > 0)
          .sort((a, b) => (activityMap.get(b.id) ?? 0) - (activityMap.get(a.id) ?? 0))
          .slice(0, 8);

        // Top earners = circles whose members have the highest bounties completed
        const { data: bountyRows } = await context.supabase
          .from("bounties")
          .select("poster_id, price_usd, status")
          .eq("status", "completed");
        const bountyByUser = new Map<string, number>();
        (bountyRows ?? []).forEach((b: any) => {
          bountyByUser.set(b.poster_id, (bountyByUser.get(b.poster_id) ?? 0) + Number(b.price_usd ?? 0));
        });
        const { data: allMembers } = await context.supabase
          .from("circle_members")
          .select("circle_id, user_id")
          .in("circle_id", ids);
        const earningsByCircle = new Map<string, number>();
        (allMembers ?? []).forEach((m: any) => {
          const v = bountyByUser.get(m.user_id) ?? 0;
          earningsByCircle.set(m.circle_id, (earningsByCircle.get(m.circle_id) ?? 0) + v);
        });
        topEarners = [...summaries]
          .filter((s) => (earningsByCircle.get(s.id) ?? 0) > 0)
          .sort((a, b) => (earningsByCircle.get(b.id) ?? 0) - (earningsByCircle.get(a.id) ?? 0))
          .slice(0, 8);
      }

      const mine = summaries.filter((s) => s.myRole !== null);
      return { all: summaries, trending, mostActive, topEarners, mine };
    },
  );

export const getCircleBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SlugInput.parse(d))
  .handler(async ({ data, context }): Promise<CircleSummary | null> => {
    const { data: row } = await context.supabase.from("circles").select("*").eq("slug", data.slug).maybeSingle();
    if (!row) return null;
    const [c] = await annotateCircles(context.supabase, context.userId, [row]);
    return c ?? null;
  });

/** My circles OR memberships. */
export const listMyCircles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CircleSummary[]> => {
    const me = context.userId;
    const { data: memberships } = await context.supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", me);
    const ids = (memberships ?? []).map((r: any) => r.circle_id);
    if (ids.length === 0) return [];
    const { data: rows, error } = await context.supabase
      .from("circles")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return annotateCircles(context.supabase, me, rows ?? []);
  });

export const listCirclesForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UserInput.parse(d))
  .handler(async ({ data, context }): Promise<CircleSummary[]> => {
    const { data: memberships } = await context.supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", data.userId);
    const ids = (memberships ?? []).map((r: any) => r.circle_id);
    if (ids.length === 0) return [];
    const { data: rows, error } = await context.supabase
      .from("circles")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return annotateCircles(context.supabase, context.userId, rows ?? []);
  });

export const requestJoinCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }): Promise<{ status: JoinStatus }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const me = context.userId;
    const { data: existing } = await context.supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", data.circleId)
      .eq("user_id", me)
      .maybeSingle();
    if (existing) return { status: "member" };
    const { error } = await context.supabase.from("circle_join_requests").upsert(
      { circle_id: data.circleId, requester_id: me, status: "pending", coc_answers: null },
      { onConflict: "circle_id,requester_id" },
    );
    if (error) {
      console.error("[requestJoinCircle]", error);
      throw new Error("Failed to send join request");
    }
    return { status: "pending" };
  });

export const cancelJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("circle_join_requests")
      .delete()
      .eq("circle_id", data.circleId)
      .eq("requester_id", context.userId);
    if (error) throw new Error("Failed to cancel");
    return { ok: true } as const;
  });

export const leaveCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: circ } = await context.supabase
      .from("circles")
      .select("owner_id")
      .eq("id", data.circleId)
      .maybeSingle();
    if (circ && circ.owner_id === context.userId) {
      throw new Error("Owner can't leave — delete the circle instead");
    }
    const { error } = await context.supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", data.circleId)
      .eq("user_id", context.userId);
    if (error) throw new Error("Failed to leave");
    return { ok: true } as const;
  });

export const listIncomingCircleJoinRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CircleJoinRequestRow[]> => {
    const me = context.userId;
    const { data: myAdmin } = await context.supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", me)
      .in("role", ["owner", "admin"]);
    const adminCircleIds = (myAdmin ?? []).map((r: any) => r.circle_id);
    if (adminCircleIds.length === 0) return [];

    const { data: reqs, error } = await context.supabase
      .from("circle_join_requests")
      .select("id, circle_id, requester_id, status, created_at")
      .in("circle_id", adminCircleIds)
      .in("status", ["pending", "awaiting_coc"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!reqs || reqs.length === 0) return [];

    const [circlesRes, profilesRes] = await Promise.all([
      context.supabase.from("circles").select("id, name, slug").in("id", adminCircleIds),
      context.supabase
        .from("profiles")
        .select("user_id, display_name, username, slug, avatar_path")
        .in(
          "user_id",
          reqs.map((r: any) => r.requester_id),
        ),
    ]);
    const cMap = new Map((circlesRes.data ?? []).map((c: any) => [c.id, c]));
    const pMap = new Map((profilesRes.data ?? []).map((p: any) => [p.user_id, p]));

    return reqs.map((r: any) => {
      const c = cMap.get(r.circle_id) as any;
      const p = pMap.get(r.requester_id) as any;
      return {
        id: r.id,
        circleId: r.circle_id,
        circleName: c?.name ?? "Circle",
        circleSlug: c?.slug ?? "",
        requesterId: r.requester_id,
        requesterName: p?.display_name || p?.username || "Someone",
        requesterAvatar: p?.avatar_path ?? null,
        requesterSlug: p?.slug ?? null,
        status: r.status,
        createdAt: r.created_at,
      };
    });
  });

/** Admin approves a request; if the circle has a code of conduct, the requester must
 *  answer questions & agree to the pledge before being added as a member. */
export const acceptJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequestActionInput.parse(d))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const { data: req, error: rErr } = await context.supabase
      .from("circle_join_requests")
      .select("id, circle_id, requester_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (rErr || !req) throw new Error("Request not found");
    if (!["pending", "awaiting_coc"].includes(req.status)) throw new Error("Request already handled");

    // Fetch CoC
    const { data: circle } = await context.supabase
      .from("circles")
      .select("code_of_conduct")
      .eq("id", req.circle_id)
      .maybeSingle();
    const coc = normalizeCoc(circle?.code_of_conduct);

    if (coc.questions.length > 0) {
      // Move to awaiting_coc — trigger will notify requester
      const { error: uErr } = await context.supabase
        .from("circle_join_requests")
        .update({ status: "awaiting_coc" })
        .eq("id", data.requestId);
      if (uErr) throw new Error("Failed to update request");
      return { status: "awaiting_coc" as const };
    }
    // No CoC → add member immediately
    const { error: mErr } = await context.supabase
      .from("circle_members")
      .insert({ circle_id: req.circle_id, user_id: req.requester_id, role: "member" });
    if (mErr && (mErr as any).code !== "23505") throw new Error("Failed to add member");
    const { error: uErr } = await context.supabase
      .from("circle_join_requests")
      .update({ status: "accepted" })
      .eq("id", data.requestId);
    if (uErr) throw new Error("Failed to update request");
    return { status: "accepted" as const };
  });

export const declineJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequestActionInput.parse(d))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const { error } = await context.supabase
      .from("circle_join_requests")
      .update({ status: "declined" })
      .eq("id", data.requestId);
    if (error) throw new Error("Failed to decline");
    return { ok: true } as const;
  });

/** Requester submits their CoC answers → they become a full member. */
export const submitCircleCoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CoCInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const me = context.userId;
    const { data: req } = await context.supabase
      .from("circle_join_requests")
      .select("id, status")
      .eq("circle_id", data.circleId)
      .eq("requester_id", me)
      .maybeSingle();
    if (!req || req.status !== "awaiting_coc") throw new Error("No approval waiting on you");

    const { error: mErr } = await context.supabase
      .from("circle_members")
      .insert({ circle_id: data.circleId, user_id: me, role: "member", coc_accepted_at: new Date().toISOString() });
    if (mErr && (mErr as any).code !== "23505") {
      console.error("[submitCircleCoc]", mErr);
      throw new Error("Failed to join circle");
    }
    const { error: uErr } = await context.supabase
      .from("circle_join_requests")
      .update({ status: "accepted", coc_answers: data.answers })
      .eq("id", req.id);
    if (uErr) throw new Error("Failed to finalize");
    return { ok: true };
  });

/* ---------------------------- Posts ---------------------------- */

export const listCirclePosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }): Promise<CirclePostRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("posts")
      .select("id, author_id, text, media_path, media_type, created_at, circle_id")
      .eq("circle_id", data.circleId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    if (!rows || rows.length === 0) return [];
    const authors = Array.from(new Set(rows.map((r: any) => r.author_id)));
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug, avatar_path")
      .in("user_id", authors);
    const pMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    return rows.map((r: any) => {
      const p = pMap.get(r.author_id) as any;
      return {
        id: r.id,
        circleId: r.circle_id,
        authorId: r.author_id,
        authorName: p?.display_name || p?.username || "Member",
        authorAvatar: p?.avatar_path ?? null,
        authorSlug: p?.slug ?? null,
        text: r.text,
        mediaPath: r.media_path,
        mediaType: r.media_type,
        createdAt: r.created_at,
      };
    });
  });

export const createCirclePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreatePostInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; sharedToFeed: boolean }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    // Every 5th post to a given circle also lands on the main news feed as a
    // preview so non-members discover the circle. RLS still hides the other 4.
    const { count } = await context.supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", data.circleId);
    const nextIndex = (count ?? 0) + 1;
    const sharedToFeed = nextIndex % 5 === 0;

    const { data: row, error } = await (context.supabase as any)
      .from("posts")
      .insert({
        author_id: context.userId,
        circle_id: data.circleId,
        text: data.text,
        media_path: data.mediaPath ?? null,
        media_type: data.mediaType ?? null,
        audience: "circle",
        shared_to_feed: sharedToFeed,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[createCirclePost]", error);
      throw new Error("Failed to post — are you a member?");
    }
    return { id: row.id, sharedToFeed };
  });

/* ---------------------------- Members ---------------------------- */

export const listCircleMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }): Promise<CircleMemberRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("circle_members")
      .select("user_id, role, joined_at")
      .eq("circle_id", data.circleId)
      .order("joined_at", { ascending: true });
    if (error) throw error;
    if (!rows || rows.length === 0) return [];
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug, avatar_path")
      .in("user_id", rows.map((r: any) => r.user_id));
    const pMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    return rows.map((r: any) => {
      const p = pMap.get(r.user_id) as any;
      return {
        userId: r.user_id,
        role: r.role,
        joinedAt: r.joined_at,
        name: p?.display_name || p?.username || "Member",
        avatar: p?.avatar_path ?? null,
        slug: p?.slug ?? null,
      };
    });
  });

/* ---------------------------- Resources ---------------------------- */

export const listCircleResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }): Promise<CircleResourceRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("circle_resources")
      .select("id, title, url, kind, pinned, added_by, created_at")
      .eq("circle_id", data.circleId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      kind: r.kind,
      pinned: r.pinned,
      addedBy: r.added_by,
      createdAt: r.created_at,
    }));
  });

export const addCircleResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResourceInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const { data: row, error } = await context.supabase
      .from("circle_resources")
      .insert({
        circle_id: data.circleId,
        added_by: context.userId,
        title: data.title,
        url: data.url,
        kind: data.kind ?? "Link",
      })
      .select("id")
      .single();
    if (error) throw new Error("Failed to add resource — are you a member?");
    return { id: row.id };
  });

export const removeCircleResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const { error } = await context.supabase.from("circle_resources").delete().eq("id", data.id);
    if (error) throw new Error("Failed to remove");
    return { ok: true } as const;
  });

/* ---------------------------- Bounties from members ---------------------------- */

export const listCircleBounties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }): Promise<CircleBountyRow[]> => {
    const { data: members } = await context.supabase
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", data.circleId);
    const ids = (members ?? []).map((m: any) => m.user_id);
    if (ids.length === 0) return [];
    const { data: rows, error } = await context.supabase
      .from("bounties")
      .select("id, title, category, price_usd, poster_id, status, created_at")
      .in("poster_id", ids)
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!rows || rows.length === 0) return [];
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username")
      .in("user_id", ids);
    const pMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      category: r.category ?? null,
      priceUsd: Number(r.price_usd ?? 0),
      posterId: r.poster_id,
      posterName:
        (pMap.get(r.poster_id) as any)?.display_name ||
        (pMap.get(r.poster_id) as any)?.username ||
        "Member",
      status: r.status,
      createdAt: r.created_at,
    }));
  });

/* ============================ Categories ============================ */

export interface CircleCategoryRow {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
}

const CategoryUpsertInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  enabled: z.boolean().optional(),
});

const CategoryIdInput = z.object({ id: z.string().uuid() });

/** Public list of enabled circle categories (used by the Forge form). */
export const listCircleCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<CircleCategoryRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("circle_categories")
      .select("id, slug, name, sort_order, enabled")
      .eq("enabled", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      console.error("[listCircleCategories]", error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      sortOrder: r.sort_order,
      enabled: r.enabled,
    }));
  },
);

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListCircleCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CircleCategoryRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("circle_categories")
      .select("id, slug, name, sort_order, enabled")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error("Failed to load categories");
    return (data ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      sortOrder: r.sort_order,
      enabled: r.enabled,
    }));
  });

export const adminUpsertCircleCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CategoryUpsertInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = {
      slug: data.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      name: data.name,
      sort_order: data.sortOrder ?? 0,
      enabled: data.enabled ?? true,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("circle_categories").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("circle_categories").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteCircleCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CategoryIdInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("circle_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
