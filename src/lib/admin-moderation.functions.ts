/**
 * Admin Stage 4 — social commerce moderation (reviews, product tags).
 *
 * Reads are authoritative; the two mutations (remove a review, remove a
 * product tag) delete only the moderated row through the existing tables and
 * write an immutable audit entry. No financial effect, no new statuses.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { supabase: any; userId: string };

async function assertRole(ctx: Ctx, allowed: readonly string[]) {
  const { data: isSuper, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (isSuper) return;
  for (const role of allowed) {
    const { data: ok } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
    if (ok) return;
  }
  throw new Error(`Forbidden: requires one of admin, ${allowed.join(", ")}`);
}

async function writeAudit(
  actorId: string,
  action: string,
  targetKind: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any)
    .from("audit_logs")
    .insert({ actor_id: actorId, action, target_kind: targetKind, target_id: targetId, meta });
}

async function nameMap(sb: any, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await sb.from("profiles").select("user_id, display_name, username").in("user_id", unique);
  for (const p of (data ?? []) as any[]) {
    map.set(String(p.user_id), (p.display_name as string) || (p.username as string) || "Oventric member");
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export interface AdminReviewRow {
  id: string;
  productId: string;
  productName: string | null;
  sellerId: string | null;
  sellerName: string | null;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** Whether the reviewer has a settled paid order for this product. */
  verifiedPurchase: boolean;
}

export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminReviewRow[]> => {
    await assertRole(context as Ctx, ["moderator", "content", "support"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("product_reviews")
      .select("id, product_id, user_id, rating, comment, created_at")
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];

    const productIds = Array.from(new Set(rows.map((r) => String(r.product_id))));
    const products = new Map<string, { name: string; sellerId: string | null }>();
    if (productIds.length) {
      const { data: p } = await sb.from("products").select("id, name, seller_id").in("id", productIds);
      for (const row of (p ?? []) as any[]) {
        products.set(String(row.id), {
          name: String(row.name),
          sellerId: (row.seller_id as string | null) ?? null,
        });
      }
    }

    // Verified-purchase flag straight from settled orders.
    const buyerIds = Array.from(new Set(rows.map((r) => String(r.user_id))));
    const paid = new Set<string>();
    if (buyerIds.length && productIds.length) {
      const { data: o } = await sb
        .from("orders")
        .select("buyer_id, product_id, status")
        .in("buyer_id", buyerIds)
        .in("product_id", productIds)
        .eq("status", "paid");
      for (const row of (o ?? []) as any[]) paid.add(`${row.buyer_id}:${row.product_id}`);
    }

    const people = await nameMap(sb, [
      ...rows.map((r) => String(r.user_id)),
      ...[...products.values()].map((p) => String(p.sellerId ?? "")),
    ]);

    return rows.map((r) => {
      const p = products.get(String(r.product_id));
      return {
        id: String(r.id),
        productId: String(r.product_id),
        productName: p?.name ?? null,
        sellerId: p?.sellerId ?? null,
        sellerName: p?.sellerId ? people.get(p.sellerId) ?? null : null,
        reviewerId: String(r.user_id),
        reviewerName: people.get(String(r.user_id)) ?? "Oventric member",
        rating: Number(r.rating ?? 0),
        comment: (r.comment as string | null) ?? null,
        createdAt: r.created_at as string,
        verifiedPurchase: paid.has(`${r.user_id}:${r.product_id}`),
      };
    });
  });

/** Remove a policy-violating review. Ratings recalculate through the existing trigger. */
export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(280).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, ["moderator"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: before } = await sb
      .from("product_reviews")
      .select("id, product_id, user_id, rating, comment, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("That review no longer exists");
    const { error } = await sb.from("product_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, "review.delete", "product_review", data.id, {
      before,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Product tags on social posts                                        */
/* ------------------------------------------------------------------ */

export interface AdminProductTagRow {
  id: string;
  kind: "media_tag" | "attachment";
  postId: string;
  postExcerpt: string | null;
  postAuthorId: string | null;
  postAuthorName: string | null;
  postCreatedAt: string | null;
  productId: string;
  productName: string | null;
  productStatus: string | null;
  sellerId: string | null;
  sellerName: string | null;
  /** The tagged product row still exists. */
  valid: boolean;
  /** The product exists AND is currently purchasable. */
  available: boolean;
}

export const adminListProductTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminProductTagRow[]> => {
    await assertRole(context as Ctx, ["moderator", "content"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const [{ data: tags }, { data: atts }] = await Promise.all([
      sb
        .from("post_media_tags")
        .select("id, post_id, product_id, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      sb
        .from("post_product_attachments")
        .select("id, post_id, product_id, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const raw = [
      ...((tags ?? []) as any[]).map((t) => ({ ...t, kind: "media_tag" as const })),
      ...((atts ?? []) as any[]).map((t) => ({ ...t, kind: "attachment" as const })),
    ];
    if (!raw.length) return [];

    const postIds = Array.from(new Set(raw.map((r) => String(r.post_id))));
    const productIds = Array.from(new Set(raw.map((r) => String(r.product_id))));

    const [{ data: posts }, { data: products }] = await Promise.all([
      sb.from("posts").select("id, text, author_id, created_at").in("id", postIds),
      sb.from("products").select("id, name, status, seller_id, stock").in("id", productIds),
    ]);

    const pMap = new Map<string, any>();
    for (const p of (posts ?? []) as any[]) pMap.set(String(p.id), p);
    const prodMap = new Map<string, any>();
    for (const p of (products ?? []) as any[]) prodMap.set(String(p.id), p);

    const people = await nameMap(sb, [
      ...((posts ?? []) as any[]).map((p) => String(p.author_id ?? "")),
      ...((products ?? []) as any[]).map((p) => String(p.seller_id ?? "")),
    ]);

    return raw
      .map((r) => {
        const post = pMap.get(String(r.post_id));
        const prod = prodMap.get(String(r.product_id));
        const status = prod ? String(prod.status ?? "") : null;
        return {
          id: String(r.id),
          kind: r.kind,
          postId: String(r.post_id),
          postExcerpt: post?.text ? String(post.text).slice(0, 160) : null,
          postAuthorId: post?.author_id ? String(post.author_id) : null,
          postAuthorName: post?.author_id ? people.get(String(post.author_id)) ?? null : null,
          postCreatedAt: (post?.created_at as string | null) ?? null,
          productId: String(r.product_id),
          productName: prod?.name ? String(prod.name) : null,
          productStatus: status,
          sellerId: prod?.seller_id ? String(prod.seller_id) : null,
          sellerName: prod?.seller_id ? people.get(String(prod.seller_id)) ?? null : null,
          valid: Boolean(prod),
          available: Boolean(prod) && status === "active",
        } as AdminProductTagRow;
      })
      .sort((a, b) => (a.postCreatedAt ?? "") < (b.postCreatedAt ?? "") ? 1 : -1);
  });

/** Remove an invalid or policy-violating product tag from a post. */
export const adminRemoveProductTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["media_tag", "attachment"]),
        reason: z.string().trim().max(280).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, ["moderator", "content"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const table = data.kind === "media_tag" ? "post_media_tags" : "post_product_attachments";
    const { data: before } = await sb.from(table).select("*").eq("id", data.id).maybeSingle();
    if (!before) throw new Error("That tag no longer exists");
    const { error } = await sb.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, "product_tag.remove", table, data.id, {
      before,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });
