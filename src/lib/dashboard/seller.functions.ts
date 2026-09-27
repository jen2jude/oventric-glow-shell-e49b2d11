import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface DashboardMetrics {
  totalSales: number;
  totalOrders: number;
  totalRevenueUSD: number;
  totalProducts: number;
  totalFollowers: number;
  totalViews: number;
  engagementRate: number;
  shopVisits: number;
  conversionRate: number;
  conversations: number;
}

export const getSellerMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardMetrics> => {
    const sb = context.supabase;
    const me = context.userId;

    const [ordersRes, productsRes, followersRes] = await Promise.all([
      sb.from("orders").select("id, total_usd, status").eq("seller_id", me),
      sb.from("products").select("id", { count: "exact", head: true }).eq("seller_id", me),
      sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", me),
    ]);

    const orders = (ordersRes.data ?? []) as Array<{ total_usd: number; status: string }>;
    const paidOrders = orders.filter(o => ["paid", "delivered", "completed", "released"].includes(o.status));
    const totalRevenueUSD = paidOrders.reduce((sum, o) => sum + Number(o.total_usd || 0), 0);
    const followers = followersRes.count ?? 0;

    const [viewsRes, dmRes, postsRes] = await Promise.all([
      sb.from("seller_view_events").select("kind, viewer_key").eq("seller_id", me).limit(50000),
      sb.from("direct_messages").select("sender_id").eq("recipient_id", me).eq("is_system", false).limit(50000),
      sb.from("posts").select("id, views_count").eq("author_id", me).limit(5000),
    ]);
    const views = ((viewsRes.data ?? []) as Array<{ kind: string; viewer_key: string }>).filter(v => v.kind === "product_view" || v.kind === "shop_visit");
    const productViews = views.filter(v => v.kind === "product_view").length;
    const shopVisits = views.filter(v => v.kind === "shop_visit").length;
    const uniqueVisitors = new Set(views.map(v => v.viewer_key)).size;
    const conversations = new Set((dmRes.data ?? []).map((d: { sender_id: string }) => d.sender_id)).size;

    const posts = (postsRes.data ?? []) as Array<{ id: string; views_count: number | null }>;
    let engagementRate = 0;
    if (posts.length) {
      const ids = posts.map(p => p.id);
      const [l, c, sv] = await Promise.all([
        sb.from("post_likes").select("post_id", { count: "exact", head: true }).in("post_id", ids),
        sb.from("post_comments").select("id", { count: "exact", head: true }).in("post_id", ids),
        sb.from("post_saves").select("post_id", { count: "exact", head: true }).in("post_id", ids),
      ]);
      const interactions = (l.count ?? 0) + (c.count ?? 0) + (sv.count ?? 0);
      const postViews = posts.reduce((s, p) => s + Number(p.views_count || 0), 0);
      const base = postViews > 0 ? postViews : Math.max(followers, 1) * posts.length;
      engagementRate = Math.min(100, Number(((interactions / base) * 100).toFixed(1)));
    }
    const conversionRate = uniqueVisitors > 0
      ? Math.min(100, Number(((paidOrders.length / uniqueVisitors) * 100).toFixed(1)))
      : 0;

    return {
      totalSales: paidOrders.length,
      totalOrders: orders.length,
      totalRevenueUSD: Number(totalRevenueUSD.toFixed(2)),
      totalProducts: productsRes.count ?? 0,
      totalFollowers: followers,
      totalViews: productViews,
      engagementRate,
      shopVisits,
      conversionRate,
      conversations,
    };
  });

export const toggleProductStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    productId: z.string().uuid(), 
    status: z.enum(["active", "pending", "rejected"]) 
  }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const me = context.userId;

    const { error } = await sb
      .from("products")
      .update({ status: data.status })
      .eq("id", data.productId)
      .eq("seller_id", me);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ productId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const me = context.userId;

    const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("product_id", data.productId);
    
    if (count && count > 0) {
      const { error } = await sb
        .from("products")
        .update({ status: "rejected", reject_reason: "Archived by seller" })
        .eq("id", data.productId)
        .eq("seller_id", me);
      if (error) throw new Error(error.message);
      return { success: true, archived: true };
    }

    const { error } = await sb
      .from("products")
      .delete()
      .eq("id", data.productId)
      .eq("seller_id", me);

    if (error) throw new Error(error.message);
    return { success: true };
  });

/** Owner marks one of their listings in/out of stock. */
export const setProductStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ productId: z.string().uuid(), inStock: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ in_stock: data.inStock } as any)
      .eq("id", data.productId)
      .eq("seller_id", context.userId);
    if (error) throw new Error(error.message);
    return { success: true, inStock: data.inStock };
  });

export const updateShopSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    logoPath: z.string().optional(),
    coverPath: z.string().optional(),
    description: z.string().optional(),
    about: z.string().optional(),
    shopName: z.string().optional()
  }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const me = context.userId;

    // Use specific shop fields if available, otherwise fallback to profile fields
    const { error } = await sb
      .from("profiles")
      .update({
        shop_logo_path: data.logoPath ?? null,
        shop_cover_path: data.coverPath ?? null,
        bio: data.description ?? null,
        shop_about: data.about ?? null,
        shop_name: data.shopName ?? null
      } as any)
      .eq("user_id", me);

    if (error) throw new Error(error.message);
    return { success: true };
  });
