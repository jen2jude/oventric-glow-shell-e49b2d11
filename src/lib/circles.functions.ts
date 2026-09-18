import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertLegacyFeatureDisabled } from "@/lib/mvp-features";

const SlugInput = z.object({
  targetSlug: z.string().trim().min(1).max(120),
});

const RequesterInput = z.object({
  requesterId: z.string().uuid(),
});

export type CircleStatus = "none" | "pending" | "accepted";

export interface CircleStatusResult {
  status: CircleStatus;
  /** When the current request was originally sent (null when status === "none"). */
  sentAt: string | null;
  /** When the row was last updated — accept time when status === "accepted". */
  updatedAt: string | null;
}

export interface IncomingCircleRequest {
  requesterId: string;
  requesterSlug: string | null;
  requesterName: string | null;
  createdAt: string;
}

/** Ensure the signed-in user has a public profile row. Idempotent. */
export const ensureMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ slug: string }> => {
    const { userId, claims } = context;
    // Use the admin client for provisioning: caller identity is already
    // verified via requireSupabaseAuth, and RLS blocks anonymous JWTs from
    // reading/writing profiles directly.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("slug")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.slug) return { slug: existing.slug };

    const email = (claims as { email?: string } | null)?.email ?? "";
    const meta = (claims as { user_metadata?: { full_name?: string; preferred_username?: string } } | null)?.user_metadata ?? {};
    const seed = meta.preferred_username || (email ? email.split("@")[0] : "") || `user-${userId.slice(0, 8)}`;
    const base =
      seed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `user-${userId.slice(0, 8)}`;

    for (let i = 0; i < 6; i++) {
      const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .insert({ user_id: userId, slug: candidate, display_name: meta.full_name ?? null })
        .select("slug")
        .single();
      if (!error && data) return { slug: data.slug };
      const code = (error as { code?: string } | null)?.code;
      const msg = error?.message?.toLowerCase() ?? "";
      if (code === "23505" || msg.includes("duplicate")) {
        const { data: found } = await supabaseAdmin
          .from("profiles")
          .select("slug")
          .eq("user_id", userId)
          .maybeSingle();
        if (found?.slug) return { slug: found.slug };
        continue;
      }
      if (error) {
        console.error("[ensureMyProfile] insert failed", error);
        throw new Error("Failed to provision profile");
      }
    }
    throw new Error("Could not allocate a unique profile slug");
  });


export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ slug: string | null; displayName: string | null }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("slug, display_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[getMyProfile] failed", error);
      throw new Error("Failed to load profile");
    }
    return { slug: data?.slug ?? null, displayName: data?.display_name ?? null };
  });

export const getCircleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<CircleStatusResult> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("circle_requests")
      .select("status, created_at, updated_at")
      .eq("requester_id", userId)
      .eq("target_slug", data.targetSlug)
      .maybeSingle();
    if (error) {
      console.error("[getCircleStatus] failed", error);
      throw new Error("Failed to load circle status");
    }
    if (!row) return { status: "none", sentAt: null, updatedAt: null };
    return {
      status: row.status as CircleStatus,
      sentAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

export const sendCircleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<CircleStatusResult> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("circle_requests")
      .upsert(
        { requester_id: userId, target_slug: data.targetSlug, status: "pending" },
        { onConflict: "requester_id,target_slug", ignoreDuplicates: false },
      )
      .select("status, created_at, updated_at")
      .single();
    if (error) {
      console.error("[sendCircleRequest] failed", error);
      throw new Error("Failed to send request");
    }
    return {
      status: row.status as CircleStatus,
      sentAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

export const cancelCircleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<CircleStatusResult & { canceledAt: string }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("circle_requests")
      .delete()
      .eq("requester_id", userId)
      .eq("target_slug", data.targetSlug);
    if (error) {
      console.error("[cancelCircleRequest] failed", error);
      throw new Error("Failed to cancel request");
    }
    return { status: "none", sentAt: null, updatedAt: null, canceledAt: new Date().toISOString() };
  });

/** List pending requests addressed to the signed-in user (via their profile slug). */
export const listIncomingCircleRequests = createServerFn({ method: "GET" }).handler(
  async (): Promise<IncomingCircleRequest[]> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { createClient } = await import("@supabase/supabase-js");
    const req = getRequest();
    const authHeader = req?.headers?.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || token.split(".").length !== 3) return [];

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      },
    );
    const { data: claims } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return [];

    const { data: me } = await supabase
      .from("profiles")
      .select("slug")
      .eq("user_id", userId)
      .maybeSingle();
    if (!me?.slug) return [];

    const { data: rows, error } = await supabase
      .from("circle_requests")
      .select("requester_id, created_at")
      .eq("target_slug", me.slug)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listIncomingCircleRequests] failed", error);
      return [];
    }
    if (!rows || rows.length === 0) return [];

    const ids = Array.from(new Set(rows.map((r) => r.requester_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, slug, display_name")
      .in("user_id", ids);
    const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    return rows.map((r) => ({
      requesterId: r.requester_id,
      requesterSlug: map.get(r.requester_id)?.slug ?? null,
      requesterName: map.get(r.requester_id)?.display_name ?? null,
      createdAt: r.created_at,
    }));
  },
);

/** Accept a pending request from `requesterId` addressed to the signed-in user. */
export const acceptIncomingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequesterInput.parse(input))
  .handler(async ({ data, context }): Promise<{ status: CircleStatus }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("circles");
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("slug")
      .eq("user_id", userId)
      .maybeSingle();
    if (!me?.slug) throw new Error("Set up your profile first");

    const { data: row, error } = await supabase
      .from("circle_requests")
      .update({ status: "accepted" })
      .eq("requester_id", data.requesterId)
      .eq("target_slug", me.slug)
      .select("status")
      .single();
    if (error || !row) {
      console.error("[acceptIncomingRequest] failed", error);
      throw new Error("Failed to accept request");
    }
    return { status: row.status as CircleStatus };
  });

/** Decline (delete) a pending request from `requesterId` addressed to the signed-in user. */
export const declineIncomingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequesterInput.parse(input))
  .handler(async ({ data, context }): Promise<{ status: CircleStatus }> => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("slug")
      .eq("user_id", userId)
      .maybeSingle();
    if (!me?.slug) throw new Error("Set up your profile first");

    const { error } = await supabase
      .from("circle_requests")
      .delete()
      .eq("requester_id", data.requesterId)
      .eq("target_slug", me.slug);
    if (error) {
      console.error("[declineIncomingRequest] failed", error);
      throw new Error("Failed to decline request");
    }
    return { status: "none" };
  });
