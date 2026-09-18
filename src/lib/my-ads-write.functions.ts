/**
 * Owner-facing (advertiser) write endpoints for the Tier 2 (banner / image)
 * sponsored ad placeholder. Every mutation is ownership-checked and only a
 * strict whitelist of creative fields can be written — budgets, escrow, spend
 * and priority stay admin-only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertLegacyFeatureDisabled } from "@/lib/mvp-features";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySB = any;

export const TIER2 = "image" as const;

const PLACEMENTS = ["feed", "marketplace", "academy", "bounties"] as const;

const BannerFields = z.object({
  title: z.string().trim().min(2).max(80),
  header: z.string().trim().max(80).default(""),
  body: z.string().trim().max(240).default(""),
  media_url: z.string().trim().max(600).default(""),
  cta_type: z.string().default("url"),
  cta_url: z.string().trim().max(600).default(""),
  cta_label: z.string().trim().max(40).default("Learn more"),
  placements: z.array(z.string()).default(["feed"]),
});

function normalize(input: z.infer<typeof BannerFields>) {
  const placements = input.placements.filter((p) =>
    (PLACEMENTS as readonly string[]).includes(p),
  );
  const ctaType = ["url", "whatsapp", "lead_form"].includes(input.cta_type) ? input.cta_type : "url";
  return {
    title: input.title,
    header: input.header,
    body: input.body,
    media_url: input.media_url || null,
    cta_type: ctaType,
    cta_url: input.cta_url,
    cta_label: input.cta_label || "Learn more",
    placements: placements.length > 0 ? placements : ["feed"],
  };
}

/* ---------- create ---------- */

export const createMyBannerAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BannerFields.parse(i))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("adsManager");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as AnySB;

    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: row, error } = await sb
      .from("ad_campaigns")
      .insert({
        ...normalize(data),
        advertiser: profile?.display_name || profile?.username || "Advertiser",
        advertiser_user_id: context.userId,
        created_by: context.userId,
        tier: TIER2,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/* ---------- update ---------- */

export const updateMyBannerAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BannerFields.extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("adsManager");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as AnySB;
    const { id, ...fields } = data;

    const { error } = await sb
      .from("ad_campaigns")
      .update({ ...normalize(fields), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("advertiser_user_id", context.userId)
      .eq("tier", TIER2);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- visibility toggle ---------- */

export const setMyBannerAdVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), visible: z.boolean() }).parse(i))
  .handler(async ({ data, context }): Promise<{ status: "active" | "paused" }> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("adsManager");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as AnySB;

    const { data: current } = await sb
      .from("ad_campaigns")
      .select("id,status")
      .eq("id", data.id)
      .eq("advertiser_user_id", context.userId)
      .eq("tier", TIER2)
      .maybeSingle();
    if (!current) throw new Error("Ad not found");
    if (current.status === "ended") throw new Error("This campaign has ended");

    const status = data.visible ? "active" : "paused";
    const { error } = await sb
      .from("ad_campaigns")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("advertiser_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { status };
  });
