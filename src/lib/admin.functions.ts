import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupportedCurrency } from "@/lib/currency/africa";

async function assertAdmin(ctx: { supabase: ReturnType<typeof Object>; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function writeAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _sb: any,
  actorId: string,
  action: string,
  targetKind: string | null,
  targetId: string | null,
  meta: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_kind: targetKind,
    target_id: targetId,
    meta,
  });
}

/** Check if the current user has management access. Returns roles for sidebar gating. */
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: isSuper } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roleRows } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const VALID = ["admin", "moderator", "finance", "content", "support"] as const;
    const roles = ((roleRows ?? []) as { role: string }[])
      .map((r) => r.role)
      .filter((r): r is (typeof VALID)[number] => (VALID as readonly string[]).includes(r));
    return { isAdmin: Boolean(isSuper) || roles.length > 0, roles };
  });

/** Live count of products awaiting admin approval. Drives the pulsing badge in the admin nav. */
export const adminGetPendingProductsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { count: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await (supabaseAdmin as any)
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return { count: count ?? 0 };
  });

/** Aggregate stats for the admin overview page. Uses service-role so RLS
 * on `profiles`/`wallet_transactions` never zeroes out the KPIs. */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    const [users, products, orders, activeCampaigns, pendingReports, bounties] = await Promise.all([
      sb.from("profiles").select("*", { count: "exact", head: true }).is("deleted_at", null),
      sb.from("products").select("*", { count: "exact", head: true }),
      sb.from("orders").select("total_usd, status", { count: "exact" }),
      sb.from("ad_campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb.from("post_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("wallet_transactions").select("*", { count: "exact", head: true }),
    ]);

    const paid = ((orders.data ?? []) as Array<{ total_usd: number; status: string }>).filter(
      (o) => o.status === "paid",
    );
    const revenueUsd = paid.reduce((s, o) => s + Number(o.total_usd ?? 0), 0);

    return {
      users: users.count ?? 0,
      products: products.count ?? 0,
      orders: orders.count ?? 0,
      revenueUsd,
      activeCampaigns: activeCampaigns.count ?? 0,
      pendingReports: pendingReports.count ?? 0,
      transactions: bounties.count ?? 0,
    };
  });


/** Recent activity across the platform. */
export const getRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [orders, users, products, audit] = await Promise.all([
      sb.from("orders").select("id, total_usd, status, created_at, product_id").order("created_at", { ascending: false }).limit(8),
      sb.from("profiles").select("user_id, username, created_at").order("created_at", { ascending: false }).limit(8),
      sb.from("products").select("id, name, price_usd, created_at").order("created_at", { ascending: false }).limit(8),
      sb.from("audit_logs").select("id, action, target_kind, target_id, created_at").order("created_at", { ascending: false }).limit(15),
    ]);
    return {
      orders: orders.data ?? [],
      users: users.data ?? [],
      products: products.data ?? [],
      audit: audit.data ?? [],
    };
  });

/** ------- Users ------- */
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Admin verified — use service-role client so we're not blocked by
    // per-user RLS policies on `profiles` / `user_roles`.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data: profiles, error } = await sb
      .from("profiles")
      .select("user_id, username, display_name, country, verification_tier, reputation_stars, kyc_completed_at, flagged, banned_at, profile_completed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const { data: roles } = await sb.from("user_roles").select("user_id, role");
    const rmap = new Map<string, string[]>();
    ((roles ?? []) as Array<{ user_id: string; role: string }>).forEach((r) => {
      const arr = rmap.get(r.user_id) ?? [];
      arr.push(r.role);
      rmap.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      roles: rmap.get(p.user_id as string) ?? [],
    }));
  });

/** Verify a seller (admin only). Sets verification_tier and records verification_at. */
export const verifySeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; tier: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { error } = await sb.from("profiles")
      .update({ 
        verification_tier: data.tier, 
        kyc_completed_at: new Date().toISOString() 
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "seller.verify", "user", data.userId, { tier: data.tier });
    return { ok: true };
  });

/** Suspend a seller (admin only). Revokes staff roles and sets banned_at. */
export const suspendSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; reason: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    // Revoke all roles first
    await sb.from("user_roles").delete().eq("user_id", data.userId);
    // Set banned status
    const { error } = await sb.from("profiles")
      .update({ 
        banned_at: new Date().toISOString(), 
        flagged: true, 
        flag_reason: data.reason 
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "seller.suspend", "user", data.userId, { reason: data.reason });
    return { ok: true };
  });





export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; role: "admin" | "moderator" | "user"; grant: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    if (data.grant) {
      await sb.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await sb.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    await writeAudit(sb, context.userId, `role.${data.grant ? "grant" : "revoke"}`, "user", data.userId, { role: data.role });
    return { ok: true };
  });

/** ------- Products moderation ------- */
export const listAllProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("products")
      .select("id, name, category, subcategory, vendor, price_usd, original_currency, original_amount, fx_snapshot, promoted, seller_id, created_at, kind, status, reject_reason, in_stock, description, cover_path, image_paths, seller_phone, whatsapp_number, location, brand, condition, negotiable, delivery, social_link")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });


/** Approve a pending product (admin only). Sends a system notification to the seller. */
export const approveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("products")
      .update({ status: "active", reject_reason: null })
      .eq("id", data.id)
      .select("id, name, seller_id")
      .single();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("notifications").insert({
      user_id: row.seller_id,
      kind: "system",
      title: "Your product is live",
      body: `"${row.name}" has been approved and is now visible in the marketplace.`,
      link: `/product/${row.id}`,
    });
    await writeAudit(sb, context.userId, "product.approve", "product", data.id);
    return { ok: true };
  });

/** Reject a pending product with a reason (admin only). Sends a system message to the seller. */
export const rejectProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; reason: string; recommendation?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const reason = String(data.reason ?? "").trim();
    if (!reason) throw new Error("Rejection reason is required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const combined = data.recommendation
      ? `${reason}\n\nRecommendation: ${data.recommendation}`
      : reason;
    const { data: row, error } = await sb
      .from("products")
      .update({ status: "rejected", reject_reason: combined })
      .eq("id", data.id)
      .select("id, name, seller_id")
      .single();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("notifications").insert({
      user_id: row.seller_id,
      kind: "system",
      title: "Product needs changes",
      body: `Your submission "${row.name}" was not approved.\n\nReason: ${reason}${data.recommendation ? `\n\nRecommendation: ${data.recommendation}` : ""}\n\nUpdate and resubmit any time.`,
    });
    await writeAudit(sb, context.userId, "product.reject", "product", data.id, { reason });
    return { ok: true };
  });

export const deleteProductAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "product.delete", "product", data.id);
    return { ok: true };
  });

export const setProductPromoted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; promoted: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("products").update({ promoted: data.promoted }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, `product.${data.promoted ? "promote" : "unpromote"}`, "product", data.id);
    return { ok: true };
  });

/** Admin creates a marketplace product. Ownership defaults to the admin unless overridden. */
export const adminCreateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    name: string;
    category: string;
    description?: string;
    price_usd: number;
    vendor: string;
    hue?: string;
    external_url?: string | null;
    file_path?: string | null;
    cover_path?: string | null;
    promoted?: boolean;
    seller_id?: string | null;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    if (!data.name?.trim()) throw new Error("Name required");
    if (!(Number(data.price_usd) > 0)) throw new Error("Price must be > 0");
    const { data: row, error } = await sb
      .from("products")
      .insert({
        seller_id: data.seller_id || context.userId,
        name: data.name.trim(),
        category: data.category,
        description: data.description ?? "",
        price_usd: Number(data.price_usd),
        vendor: data.vendor.trim(),
        hue: data.hue ?? "from-emerald-500 to-teal-700",
        external_url: data.external_url ?? null,
        file_path: data.file_path ?? null,
        cover_path: data.cover_path ?? null,
        promoted: data.promoted ?? false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "product.create", "product", row.id as string);
    return { id: row.id as string };
  });

/** Admin marks any product in/out of stock. */
export const adminSetProductStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; inStock: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("products").update({ in_stock: data.inStock }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "product.stock", "product", data.id, { in_stock: data.inStock });
    return { ok: true };
  });

/** Admin updates any product (works for products owned by other users via admin RLS). */
export const adminUpdateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id: string;
    name?: string;
    category?: string;
    subcategory?: string | null;
    description?: string;
    price_usd?: number;
    vendor?: string;
    hue?: string;
    external_url?: string | null;
    cover_path?: string | null;
    file_path?: string | null;
    promoted?: boolean;
    brand?: string | null;
    condition?: string | null;
    location?: string | null;
    negotiable?: string | null;
    delivery?: string | null;
    seller_phone?: string | null;
    whatsapp_number?: string | null;
    social_link?: string | null;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.category !== undefined) patch.category = data.category;
    if (data.subcategory !== undefined) patch.subcategory = data.subcategory;
    if (data.description !== undefined) patch.description = data.description;
    if (data.price_usd !== undefined) patch.price_usd = Number(data.price_usd);
    if (data.vendor !== undefined) patch.vendor = data.vendor.trim();
    if (data.hue !== undefined) patch.hue = data.hue;
    if (data.external_url !== undefined) patch.external_url = data.external_url;
    if (data.cover_path !== undefined) patch.cover_path = data.cover_path;
    if (data.file_path !== undefined) patch.file_path = data.file_path;
    if (data.promoted !== undefined) patch.promoted = data.promoted;
    if (data.brand !== undefined) patch.brand = data.brand;
    if (data.condition !== undefined) patch.condition = data.condition;
    if (data.location !== undefined) patch.location = data.location;
    if (data.negotiable !== undefined) patch.negotiable = data.negotiable;
    if (data.delivery !== undefined) patch.delivery = data.delivery;
    if (data.seller_phone !== undefined) patch.seller_phone = data.seller_phone;
    if (data.whatsapp_number !== undefined) patch.whatsapp_number = data.whatsapp_number;
    if (data.social_link !== undefined) patch.social_link = data.social_link;
    const { error } = await sb.from("products").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "product.update", "product", data.id, patch);
    return { ok: true };
  });

/** ------- Campaigns ------- */
export interface AdCampaignRow {
  id: string;
  title: string;
  advertiser: string;
  description: string;
  status: "active" | "paused" | "ended" | "draft";
  tier: "text" | "image" | "video";
  header: string;
  body: string;
  media_path: string | null;
  media_url: string | null;
  placements: string[];
  cta_type: string;
  cta_url: string;
  cta_label: string;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
}

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Advertiser contact columns are admin-only at the grant level.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data, error } = await sb.from("ad_campaigns").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AdCampaignRow[];
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Partial<AdCampaignRow> & { id?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { error } = await sb.from("ad_campaigns").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeAudit(sb, context.userId, "campaign.update", "campaign", data.id);
      return { id: data.id };
    }
    const { data: row, error } = await sb.from("ad_campaigns").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "campaign.create", "campaign", row.id as string);
    return { id: row.id as string };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("ad_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "campaign.delete", "campaign", data.id);
    return { ok: true };
  });

/** ------- Categories ------- */
export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Use service-role so disabled rows are also listed for admin management.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("marketplace_categories")
      .select("id, slug, name, description, sort_order, enabled, kind, parent_id, created_at, updated_at")
      .order("kind", { ascending: true })
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    slug: string;
    name: string;
    description?: string;
    sort_order?: number;
    enabled?: boolean;
    kind?: "digital" | "physical";
    parent_id?: string | null;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const payload = {
      slug: data.slug,
      name: data.name,
      description: data.description ?? "",
      sort_order: data.sort_order ?? 0,
      enabled: data.enabled ?? true,
      kind: data.kind ?? "digital",
      parent_id: data.parent_id ?? null,
    };
    if (data.id) {
      const { error } = await sb.from("marketplace_categories").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeAudit(sb, context.userId, "category.update", "category", data.id);
      return { id: data.id };
    }
    const { data: row, error } = await sb.from("marketplace_categories").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "category.create", "category", row.id as string);
    return { id: row.id as string };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("marketplace_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "category.delete", "category", data.id);
    return { ok: true };
  });

/** ------- Feature flags ------- */
export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.from("feature_flags").select("*").order("key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("feature_flags").update({ enabled: data.enabled, updated_by: context.userId }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, `feature.${data.enabled ? "enable" : "disable"}`, "feature_flag", data.id);
    return { ok: true };
  });

/** ------- Audit logs ------- */
export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** ------- Platform settings ------- */
export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { base_currency?: string; live_fx_enabled?: boolean; fx_rates?: Record<string, number> }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const patch: Record<string, unknown> = {};
    if (data.base_currency !== undefined) patch.base_currency = data.base_currency;
    if (data.live_fx_enabled !== undefined) patch.live_fx_enabled = data.live_fx_enabled;
    if (data.fx_rates !== undefined) {
      patch.fx_rates = data.fx_rates;
      patch.fx_updated_at = new Date().toISOString();
    }
    const { error } = await sb.from("platform_settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "settings.update", "platform_settings", "1", patch);
    return { ok: true };
  });

/** ------- User detail / moderation ------- */
export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    const { data: profile, error } = await sb
      .from("profiles").select("*").eq("user_id", data.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("User not found");

    const { data: authUser } = await sb.auth.admin.getUserById(data.userId);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", data.userId);
    const { data: wallets } = await sb.from("wallets").select("currency, available_balance, escrow_balance, accumulated_cashback, bounty_balance").eq("user_id", data.userId);

    const [
      postsCount, productsCount, ordersCount, followersCount,
      bountiesPostedCount, bountiesWonCount, bountyAppsCount,
      productsListed, ordersAsBuyer, bountiesPosted, bountyApps,
      contactedSellers, walletTxns,
    ] = await Promise.all([
      sb.from("posts").select("id", { count: "exact", head: true }).eq("author_id", data.userId),
      sb.from("products").select("id", { count: "exact", head: true }).eq("seller_id", data.userId),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", data.userId),
      sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", data.userId),
      sb.from("bounties").select("id", { count: "exact", head: true }).eq("poster_id", data.userId),
      sb.from("bounties").select("id", { count: "exact", head: true }).eq("accepted_applicant_id", data.userId),
      sb.from("bounty_applications").select("id", { count: "exact", head: true }).eq("applicant_id", data.userId),
      sb.from("products")
        .select("id, name, kind, status, price_usd, created_at, cover_path")
        .eq("seller_id", data.userId).order("created_at", { ascending: false }).limit(50),
      sb.from("orders")
        .select("id, product_id, total_usd, status, created_at, paid_at, seller_id")
        .eq("buyer_id", data.userId).order("created_at", { ascending: false }).limit(50),
      sb.from("bounties")
        .select("id, title, price_usd, status, created_at, accepted_applicant_id")
        .eq("poster_id", data.userId).order("created_at", { ascending: false }).limit(50),
      sb.from("bounty_applications")
        .select("id, bounty_id, status, created_at, bounties(id,title,price_usd,status,accepted_applicant_id)")
        .eq("applicant_id", data.userId).order("created_at", { ascending: false }).limit(50),
      sb.from("direct_messages")
        .select("recipient_id, created_at")
        .eq("sender_id", data.userId).order("created_at", { ascending: false }).limit(200),
      sb.from("wallet_transactions")
        .select("id, tx_hash, type, amount, currency, inflow, status, occurred_at")
        .eq("user_id", data.userId).order("occurred_at", { ascending: false }).limit(100),
    ]);

    // Deduplicate contacted sellers (recipients of direct messages) and hydrate profile info.
    const recipientIds = Array.from(new Set(((contactedSellers.data ?? []) as Array<{ recipient_id: string }>).map((r) => r.recipient_id)));
    let contacts: Array<{ user_id: string; username: string | null; display_name: string | null; avatar_path: string | null; last_at: string }> = [];
    if (recipientIds.length) {
      const { data: contactProfiles } = await sb
        .from("profiles").select("user_id, username, display_name, avatar_path").in("user_id", recipientIds);
      const lastAt = new Map<string, string>();
      ((contactedSellers.data ?? []) as Array<{ recipient_id: string; created_at: string }>).forEach((r) => {
        if (!lastAt.has(r.recipient_id)) lastAt.set(r.recipient_id, r.created_at);
      });
      contacts = ((contactProfiles ?? []) as Array<Record<string, unknown>>).map((p) => ({
        user_id: p.user_id as string,
        username: (p.username as string) ?? null,
        display_name: (p.display_name as string) ?? null,
        avatar_path: (p.avatar_path as string) ?? null,
        last_at: lastAt.get(p.user_id as string) ?? "",
      })).sort((a, b) => (b.last_at ?? "").localeCompare(a.last_at ?? ""));
    }

    return {
      profile,
      email: authUser?.user?.email ?? null,
      email_confirmed_at: authUser?.user?.email_confirmed_at ?? null,
      last_sign_in_at: authUser?.user?.last_sign_in_at ?? null,
      auth_created_at: authUser?.user?.created_at ?? null,
      roles: (roles ?? []).map((r: { role: string }) => r.role),
      wallets: wallets ?? [],
      counts: {
        posts: postsCount.count ?? 0,
        products: productsCount.count ?? 0,
        orders: ordersCount.count ?? 0,
        followers: followersCount.count ?? 0,
        bountiesPosted: bountiesPostedCount.count ?? 0,
        bountiesWon: bountiesWonCount.count ?? 0,
        bountyApplications: bountyAppsCount.count ?? 0,
        contactedSellers: recipientIds.length,
      },
      productsListed: productsListed.data ?? [],
      downloads: ordersAsBuyer.data ?? [],
      bountiesPosted: bountiesPosted.data ?? [],
      bountyApplications: bountyApps.data ?? [],
      contactedSellers: contacts,
      walletTransactions: walletTxns.data ?? [],
    };
  });


export const updateUserProfileAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    userId: string;
    display_name?: string;
    username?: string;
    country?: string;
    bio?: string;
    phone?: string;
    verification_tier?: string;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const patch: Record<string, unknown> = {};
    (["display_name", "username", "country", "bio", "phone", "verification_tier"] as const).forEach((k) => {
      if (data[k] !== undefined) patch[k] = data[k];
    });
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await sb.from("profiles").update(patch).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "user.update", "user", data.userId, patch);
    return { ok: true };
  });

export const sendUserPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data: u } = await sb.auth.admin.getUserById(data.userId);
    const email = u?.user?.email;
    if (!email) throw new Error("User has no email");
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "user.password_reset", "user", data.userId);
    return { ok: true, email };
  });

export const setUserFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; flagged: boolean; reason?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { error } = await sb.from("profiles")
      .update({ flagged: data.flagged, flag_reason: data.flagged ? (data.reason ?? null) : null })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, `user.${data.flagged ? "flag" : "unflag"}`, "user", data.userId, { reason: data.reason });
    return { ok: true };
  });

export const setUserBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; banned: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Cannot ban yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    // Ban via Supabase Auth (rejects tokens); mirror on profile for UI.
    const { error: authErr } = await sb.auth.admin.updateUserById(data.userId, {
      ban_duration: data.banned ? "876000h" : "none", // ~100 years
    });
    if (authErr) throw new Error(authErr.message);
    await sb.from("profiles")
      .update({ banned_at: data.banned ? new Date().toISOString() : null })
      .eq("user_id", data.userId);
    await writeAudit(sb, context.userId, `user.${data.banned ? "ban" : "unban"}`, "user", data.userId);
    return { ok: true };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { error } = await sb.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    // profiles.user_id has ON DELETE CASCADE to auth.users, so profile row is removed.
    await writeAudit(sb, context.userId, "user.delete", "user", data.userId);
    return { ok: true };
  });

/** Bulk-delete users (admin only). Skips self. Returns per-id result. */
export const deleteUsersBulkAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userIds: string[] }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const results: Array<{ userId: string; ok: boolean; error?: string }> = [];
    for (const uid of data.userIds) {
      if (uid === context.userId) { results.push({ userId: uid, ok: false, error: "cannot delete self" }); continue; }
      try {
        const { error } = await sb.auth.admin.deleteUser(uid);
        if (error) throw new Error(error.message);
        await writeAudit(sb, context.userId, "user.delete", "user", uid, { bulk: true });
        results.push({ userId: uid, ok: true });
      } catch (e) {
        results.push({ userId: uid, ok: false, error: (e as Error).message });
      }
    }
    return { results, deleted: results.filter((r) => r.ok).length };
  });

/** Reset all platform system wallets to $0. Admin only. */
export const resetSystemWallets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { error } = await sb.from("system_wallets").update({ balance_usd: 0, updated_at: new Date().toISOString() }).gte("balance_usd", 0);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "system_wallets.reset", "system_wallets", null);
    return { ok: true };
  });

/** Admin: reset a specific user wallet balance component (available/escrow/cashback/bounty/all) for a currency. */
export const adminResetWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; currency: string; which: "available" | "escrow" | "cashback" | "bounty" | "all" }) => {
    if (!i?.userId) throw new Error("userId required");
    if (!isSupportedCurrency(i.currency)) throw new Error("invalid currency");
    if (!["available", "escrow", "cashback", "bounty", "all"].includes(i.which)) throw new Error("invalid target");
    return i;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.rpc("admin_reset_wallet", { _user_id: data.userId, _currency: data.currency, _which: data.which });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Feature a seller (admin only). Toggles manually featured status. */
export const featureSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; featured: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { error } = await sb.from("profiles")
      .update({ is_featured: data.featured })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, `seller.${data.featured ? "feature" : "unfeature"}`, "user", data.userId);
    return { ok: true };
  });

/** Update marketplace promotional placements. */
export const updatePromotionalPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { section: string; data: any }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { error } = await sb.from("marketplace_settings")
      .upsert({ 
        key: `promo_${data.section}`, 
        value: data.data,
        updated_at: new Date().toISOString() 
      });
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "marketplace.promo_update", "setting", data.section, { section: data.section });
    return { ok: true };
  });

