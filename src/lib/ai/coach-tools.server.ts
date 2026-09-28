import { tool } from "ai";
import { z } from "zod";

type Sb = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/**
 * Controlled, read-only tools for Oventric Coach. Private tools are bound to
 * the authenticated user id — the model can never pick another user's id.
 */
export function buildCoachTools(sb: Sb, userId: string, currency: string, rate: number) {
  const money = (usd: number | null | undefined) =>
    Math.round(Number(usd || 0) * rate * 100) / 100;
  const liveProducts = () =>
    sb
      .from("products")
      .select("id, slug, name, category, price_usd, rating, reviews, cashback_pct, seller_id")
      .eq("status", "active")
      .or("kind.is.null,kind.neq.physical");

  const sellerNames = async (ids: string[]) => {
    if (!ids.length) return new Map<string, { name: string; slug: string | null }>();
    const { data } = await sb
      .from("profiles")
      .select("user_id, display_name, username, shop_name, slug, banned_at")
      .in("user_id", [...new Set(ids)]);
    return new Map(
      (data ?? [])
        .filter((p) => !p.banned_at)
        .map((p) => [p.user_id, { name: p.shop_name || p.display_name || p.username || "Seller", slug: p.slug }]),
    );
  };

  const shapeProducts = async (rows: Array<Record<string, unknown>>) => {
    const names = await sellerNames(rows.map((r) => String(r.seller_id)));
    return rows
      .filter((r) => names.has(String(r.seller_id)))
      .map((r) => ({
        id: r.id as string,
        name: r.name as string,
        category: r.category as string,
        price: money(r.price_usd as number),
        currency,
        cashbackPct: Number(r.cashback_pct || 0),
        rating: Number(r.rating || 0),
        reviews: Number(r.reviews || 0),
        seller: names.get(String(r.seller_id))!.name,
        sellerId: r.seller_id as string,
        url: `/product/${r.id}`,
      }));
  };

  return {
    searchProducts: tool({
      description:
        "Search live Oventric marketplace digital products by keyword and/or category. Prices are already in the user's home currency.",
      inputSchema: z.object({
        query: z.string().nullable().describe("Keywords, or null"),
        category: z.string().nullable().describe("Category name, or null"),
        sort: z.enum(["relevance", "top_rated", "cheapest", "newest", "most_cashback"]).nullable(),
      }),
      execute: async ({ query, category, sort }) => {
        let q = liveProducts();
        if (query) q = q.or(`name.ilike.%${query.replace(/[%,()]/g, " ")}%,description.ilike.%${query.replace(/[%,()]/g, " ")}%`);
        if (category) q = q.ilike("category", `%${category}%`);
        if (sort === "top_rated") q = q.order("rating", { ascending: false });
        else if (sort === "cheapest") q = q.order("price_usd", { ascending: true });
        else if (sort === "most_cashback") q = q.order("cashback_pct", { ascending: false });
        else q = q.order("created_at", { ascending: false });
        const { data, error } = await q.limit(6);
        if (error) return { error: "Search unavailable right now" };
        return { products: await shapeProducts(data ?? []) };
      },
    }),

    getProduct: tool({
      description: "Get full details of one Oventric product by id.",
      inputSchema: z.object({ productId: z.string() }),
      execute: async ({ productId }) => {
        const { data } = await sb
          .from("products")
          .select("id, name, category, description, price_usd, rating, reviews, cashback_pct, seller_id, basic_info, in_stock, status")
          .eq("id", productId)
          .eq("status", "active")
          .maybeSingle();
        if (!data) return { error: "Product not found" };
        const [shaped] = await shapeProducts([data]);
        if (!shaped) return { error: "Product not available" };
        return { product: { ...shaped, description: String(data.description ?? "").slice(0, 1200), inStock: data.in_stock } };
      },
    }),

    searchSellers: tool({
      description: "Find Oventric sellers/shops/creators by name.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const s = query.replace(/[%,()]/g, " ");
        const { data } = await sb
          .from("profiles")
          .select("user_id, display_name, username, shop_name, slug, bio, banned_at, deleted_at")
          .or(`shop_name.ilike.%${s}%,display_name.ilike.%${s}%,username.ilike.%${s}%`)
          .limit(10);
        const sellers = (data ?? [])
          .filter((p) => !p.banned_at && !p.deleted_at)
          .slice(0, 5)
          .map((p) => ({
            id: p.user_id,
            name: p.shop_name || p.display_name || p.username || "Seller",
            bio: String(p.bio ?? "").slice(0, 160),
            url: `/profile/${p.slug || p.user_id}`,
          }));
        return { sellers };
      },
    }),

    getSellerProducts: tool({
      description: "List live products of a seller by their id.",
      inputSchema: z.object({ sellerId: z.string() }),
      execute: async ({ sellerId }) => {
        const { data } = await liveProducts().eq("seller_id", sellerId).order("rating", { ascending: false }).limit(6);
        return { products: await shapeProducts(data ?? []) };
      },
    }),

    getMyWallet: tool({
      description: "The signed-in user's own wallet: available balance, escrow (pending) and cashback, in their home currency.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await sb
          .from("wallets")
          .select("currency, available_balance, escrow_balance, accumulated_cashback")
          .eq("user_id", userId)
          .maybeSingle();
        if (!data) return { error: "No wallet yet" };
        return {
          wallet: {
            currency: data.currency,
            available: Number(data.available_balance),
            inEscrow: Number(data.escrow_balance),
            cashback: Number(data.accumulated_cashback),
            url: "/?section=Wallet",
          },
        };
      },
    }),

    getMyOrders: tool({
      description: "The signed-in user's own recent orders — as buyer (purchases) or seller (sales) — with real status.",
      inputSchema: z.object({ as: z.enum(["buyer", "seller"]) }),
      execute: async ({ as }) => {
        const { data } = await sb
          .from("orders")
          .select("id, product_name_snapshot, status, escrow_status, dispute_status, total_usd, seller_share_usd, created_at, auto_release_at, released_at, refunded_at")
          .eq(as === "buyer" ? "buyer_id" : "seller_id", userId)
          .order("created_at", { ascending: false })
          .limit(8);
        return {
          orders: (data ?? []).map((o) => ({
            id: o.id,
            product: o.product_name_snapshot,
            status: o.status,
            escrow: o.escrow_status,
            dispute: o.dispute_status,
            amount: money(as === "seller" ? o.seller_share_usd ?? o.total_usd : o.total_usd),
            currency,
            date: o.created_at,
            autoReleaseAt: o.auto_release_at,
            releasedAt: o.released_at,
            refundedAt: o.refunded_at,
            url: `/order/${o.id}`,
          })),
        };
      },
    }),

    searchNewsfeed: tool({
      description: "Search recent public newsfeed posts by keyword or hashtag.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const { data } = await sb
          .from("posts")
          .select("id, author_id, text, created_at, views_count")
          .eq("audience", "public")
          .is("circle_id", null)
          .ilike("text", `%${query.replace(/[%,()]/g, " ")}%`)
          .order("created_at", { ascending: false })
          .limit(6);
        const names = await sellerNames((data ?? []).map((p) => p.author_id));
        return {
          posts: (data ?? [])
            .filter((p) => names.has(p.author_id))
            .map((p) => ({ id: p.id, author: names.get(p.author_id)!.name, text: String(p.text ?? "").slice(0, 240), date: p.created_at })),
        };
      },
    }),

    navigateTo: tool({
      description:
        "Offer the user a button that opens an Oventric screen. Use for Wallet, Marketplace, Newsfeed, Explore, Purchases, Seller Hub, Account, a product or an order.",
      inputSchema: z.object({
        label: z.string().describe("Short button text, e.g. 'Open Wallet'"),
        destination: z.enum(["Wallet", "Marketplace", "Newsfeed", "Explore", "Purchases", "Account", "SellerHub", "Home", "Product", "Order", "Profile"]),
        id: z.string().nullable().describe("Product/order/profile id when needed, else null"),
      }),
      execute: async ({ label, destination, id }) => {
        const map: Record<string, string> = {
          Wallet: "/?section=Wallet",
          Marketplace: "/?section=Marketplace",
          Newsfeed: "/?section=Newsfeed",
          Explore: "/?section=Explore",
          Purchases: "/?section=Purchases",
          Account: "/?section=Account",
          SellerHub: "/seller-hub",
          Home: "/?section=Home",
        };
        let url = map[destination];
        if (destination === "Product" && id) url = `/product/${id}`;
        if (destination === "Order" && id) url = `/order/${id}`;
        if (destination === "Profile" && id) url = `/profile/${id}`;
        return url ? { label, url } : { error: "Unknown destination" };
      },
    }),
  };
}
