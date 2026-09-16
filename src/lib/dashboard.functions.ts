import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currencyForCountry, fallbackRateTable } from "@/lib/currency/africa";

/* -------------------------------------------------------------------------- */
/*  Overview snapshot                                                          */
/* -------------------------------------------------------------------------- */

type HomeCurrency = string;

function countryToHomeCurrency(country: string | null | undefined): HomeCurrency {
  return currencyForCountry(country);
}

const FX_FALLBACK: Record<HomeCurrency, number> = fallbackRateTable();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadUsdRates(sb: any): Promise<Record<HomeCurrency, number>> {
  try {
    const { data } = await sb.from("platform_settings").select("fx_rates").maybeSingle();
    const r = (data?.fx_rates ?? null) as Record<string, number> | null;
    if (!r) return FX_FALLBACK;
    const merged: Record<string, number> = { ...FX_FALLBACK, USD: 1 };
    for (const code of Object.keys(merged)) {
      const v = Number(r[code]);
      if (v > 0) merged[code] = v;
    }
    return merged;
  } catch {
    return FX_FALLBACK;
  }
}

export interface DashboardActivityItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  unread: boolean;
}

export interface DashboardOverview {
  homeCurrency: HomeCurrency;
  wallet: { currency: HomeCurrency; available: number; escrow: number } | null;
  purchases: { total: number; pending: number };
  listings: { total: number; pending: number; active: number; rejected: number };
  social: { followers: number; following: number; circles: number };
  unread: { messages: number; notifications: number };
  /** Buyer + seller order pipeline for the key overview cards. */
  orders: { placed: number; awaitingBuyer: number; toFulfil: number; last30: number };
  /** Seller revenue released to the user, in USD and home currency. */
  revenue: { grossUSD: number; gross: number; last30USD: number; last30: number; currency: HomeCurrency };
  /** Recent notifications, newest first. */
  activity: DashboardActivityItem[];
}


export const getDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardOverview> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;

    const [
      wallets,
      ordersRes,
      productsRes,
      followersRes,
      followingRes,
      circlesRes,
      unreadMsgRes,
      unreadNotifRes,
      profileRes,
      sellerOrdersRes,
      activityRes,
      rates,
    ] = await Promise.all([
      sb.from("wallets").select("currency, available_balance, escrow_balance").eq("user_id", me),
      sb.from("orders").select("id, status, created_at, escrow_status, buyer_confirmed_at", { count: "exact", head: false }).eq("buyer_id", me),
      sb.from("products").select("id, status").eq("seller_id", me),
      sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", me),
      sb.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", me),
      sb.from("circle_members").select("circle_id", { count: "exact", head: true }).eq("user_id", me),
      sb.from("direct_messages").select("id", { count: "exact", head: true }).eq("recipient_id", me).is("read_at", null),
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me).is("read_at", null),
      (async () => {
        // Profiles has restricted grants for authenticated; use admin to read
        // the caller's own country so home-currency resolution is reliable.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return await supabaseAdmin.from("profiles").select("country").eq("user_id", me).maybeSingle();
        } catch {
          return { data: null } as { data: { country: string | null } | null };
        }
      })(),
      sb
        .from("orders")
        .select("id, status, created_at, seller_share_usd, escrow_status, released_at, delivered_at")
        .eq("seller_id", me),
      sb
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .eq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(6),
      loadUsdRates(sb),
    ]);

    // Home currency comes from the user's country. Overview always reports
    // the wallet + bounty earnings in this currency only.
    const homeCurrency: HomeCurrency = countryToHomeCurrency(
      (profileRes?.data as { country?: string | null } | null)?.country ?? null,
    );


    const walletRows = (wallets.data ?? []) as Array<{ currency: string; available_balance: number; escrow_balance: number }>;
    const home = walletRows.find((w) => w.currency === homeCurrency) ?? null;

    const orderRows = (ordersRes.data ?? []) as Array<{
      status: string;
      created_at: string;
      escrow_status: string | null;
      buyer_confirmed_at: string | null;
    }>;
    const sellerOrderRows = (sellerOrdersRes.data ?? []) as Array<{
      status: string;
      created_at: string;
      seller_share_usd: number | null;
      escrow_status: string | null;
      released_at: string | null;
      delivered_at: string | null;
    }>;
    const productRows = (productsRes.data ?? []) as Array<{ status: string }>;

    const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const isRecent = (iso: string | null) => (iso ? new Date(iso).getTime() >= since30 : false);
    const paidSellerOrders = sellerOrderRows.filter((o) => o.status === "paid");
    const releasedSellerOrders = paidSellerOrders.filter((o) => !!o.released_at);
    const revenueUSD = releasedSellerOrders.reduce((sum, o) => sum + Number(o.seller_share_usd || 0), 0);
    const revenue30USD = releasedSellerOrders
      .filter((o) => isRecent(o.released_at))
      .reduce((sum, o) => sum + Number(o.seller_share_usd || 0), 0);
    const homeRate = rates[homeCurrency] ?? 1;
    const homeDigits = homeCurrency === "USD" ? 2 : 0;

    return {
      homeCurrency,
      wallet: {
        currency: homeCurrency,
        available: Number(home?.available_balance ?? 0),
        escrow: Number(home?.escrow_balance ?? 0),
      },
      purchases: {
        total: orderRows.filter((o) => o.status === "paid").length,
        pending: orderRows.filter((o) => o.status === "pending").length,
      },
      listings: {
        total: productRows.length,
        pending: productRows.filter((p) => p.status === "pending").length,
        active: productRows.filter((p) => p.status === "active").length,
        rejected: productRows.filter((p) => p.status === "rejected").length,
      },
      social: {
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
        circles: circlesRes.count ?? 0,
      },
      unread: {
        messages: unreadMsgRes.count ?? 0,
        notifications: unreadNotifRes.count ?? 0,
      },
      orders: {
        placed: orderRows.length,
        awaitingBuyer: orderRows.filter(
          (o) => o.status === "paid" && !o.buyer_confirmed_at && o.escrow_status !== "released",
        ).length,
        toFulfil: paidSellerOrders.filter((o) => !o.delivered_at).length,
        last30:
          orderRows.filter((o) => isRecent(o.created_at)).length +
          sellerOrderRows.filter((o) => isRecent(o.created_at)).length,
      },
      revenue: {
        grossUSD: Number(revenueUSD.toFixed(2)),
        gross: Number((revenueUSD * homeRate).toFixed(homeDigits)),
        last30USD: Number(revenue30USD.toFixed(2)),
        last30: Number((revenue30USD * homeRate).toFixed(homeDigits)),
        currency: homeCurrency,
      },
      activity: ((activityRes.data ?? []) as Array<{
        id: string;
        kind: string | null;
        title: string | null;
        body: string | null;
        link: string | null;
        read_at: string | null;
        created_at: string;
      }>).map((n) => ({
        id: n.id,
        kind: n.kind ?? "update",
        title: n.title ?? "Activity",
        body: n.body,
        link: n.link,
        createdAt: n.created_at,
        unread: !n.read_at,
      })),
    };
  });


/* -------------------------------------------------------------------------- */
/*  Bounties tab                                                               */
/* -------------------------------------------------------------------------- */

export interface DashboardBountyPosted {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priceUSD: number;
  status: string;
  deadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  coverPath: string | null;
  coverUrl: string | null;
  applicantLimit: number | null;
  applicantsCount: number;
  promoted: boolean;
}

export interface DashboardBountySolved {
  id: string;
  bountyId: string | null;
  title: string;
  payoutUSD: number;
  solvedAt: string;
  coverPath: string | null;
  coverUrl: string | null;
}

export const listMyBounties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ posted: DashboardBountyPosted[]; solved: DashboardBountySolved[] }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;

    const { data: posted, error: pErr } = await sb
      .from("bounties")
      .select("id, title, description, category, price_usd, status, deadline_at, start_at, end_at, created_at, cover_path, applicant_limit, promoted")
      .eq("poster_id", me)
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const postedRows = (posted ?? []) as Array<Record<string, unknown>>;
    const postedIds = postedRows.map((r) => String(r.id));

    // Applicants per posted bounty (RLS on bounty_applications allows the
    // bounty poster to read all rows for their bounties).
    const applicantCount = new Map<string, number>();
    if (postedIds.length) {
      const { data: apps } = await sb
        .from("bounty_applications")
        .select("bounty_id")
        .in("bounty_id", postedIds);
      for (const a of ((apps ?? []) as Array<{ bounty_id: string }>)) {
        applicantCount.set(a.bounty_id, (applicantCount.get(a.bounty_id) ?? 0) + 1);
      }
    }

    // Solver history — audit_logs is admin-only under RLS, so read via admin
    // client scoped strictly to this authenticated user's solver_id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { data: solvedLogs } = await admin
      .from("audit_logs")
      .select("target_id, meta, created_at")
      .eq("action", "bounty.payout")
      .filter("meta->>solver_id", "eq", me)
      .order("created_at", { ascending: false })
      .limit(100);

    const rows = (solvedLogs ?? []) as Array<{ target_id: string | null; meta: Record<string, unknown>; created_at: string }>;
    const bountyIds = rows.map((r) => r.target_id).filter((x): x is string => !!x);
    let solvedMeta = new Map<string, { title: string; cover_path: string | null }>();
    if (bountyIds.length) {
      const { data: bs } = await admin.from("bounties").select("id, title, cover_path").in("id", bountyIds);
      solvedMeta = new Map(((bs ?? []) as Array<{ id: string; title: string; cover_path: string | null }>).map((b) => [b.id, { title: b.title, cover_path: b.cover_path }]));
    }

    // Batch-sign every unique cover path across posted + solved.
    const allPaths: (string | null)[] = [
      ...postedRows.map((r) => (r.cover_path as string | null) ?? null),
      ...rows.map((r) => (r.target_id ? solvedMeta.get(r.target_id)?.cover_path ?? null : null)),
    ];
    const uniquePaths = Array.from(new Set(allPaths.filter((p): p is string => !!p)));
    const signedMap = new Map<string, string>();
    if (uniquePaths.length) {
      try {
        const { data: signed } = await admin.storage
          .from("bounty-covers")
          .createSignedUrls(uniquePaths, 60 * 60 * 24 * 7);
        (signed ?? []).forEach((r: { path?: string; signedUrl?: string }) => {
          if (r.path && r.signedUrl) signedMap.set(r.path, r.signedUrl);
        });
      } catch { /* ignore */ }
    }
    const signOne = (p: string | null) => (p ? signedMap.get(p) ?? null : null);

    const solved: DashboardBountySolved[] = rows.map((r) => {
      const meta = r.target_id ? solvedMeta.get(r.target_id) : null;
      return {
        id: `${r.target_id ?? "solved"}-${r.created_at}`,
        bountyId: r.target_id,
        title: meta?.title ?? "Bounty",
        payoutUSD: Number((r.meta as { solverCut?: number })?.solverCut ?? 0),
        solvedAt: r.created_at,
        coverPath: meta?.cover_path ?? null,
        coverUrl: signOne(meta?.cover_path ?? null),
      };
    });

    const postedDTO: DashboardBountyPosted[] = postedRows.map((b) => ({
      id: String(b.id),
      title: String(b.title ?? ""),
      description: (b.description as string | null) ?? null,
      category: String(b.category ?? ""),
      priceUSD: Number(b.price_usd ?? 0),
      status: String(b.status ?? "active"),
      deadlineAt: (b.deadline_at as string | null) ?? null,
      startAt: (b.start_at as string | null) ?? null,
      endAt: (b.end_at as string | null) ?? null,
      createdAt: String(b.created_at),
      coverPath: (b.cover_path as string | null) ?? null,
      coverUrl: signOne((b.cover_path as string | null) ?? null),
      applicantLimit: b.applicant_limit == null ? null : Number(b.applicant_limit),
      applicantsCount: applicantCount.get(String(b.id)) ?? 0,
      promoted: !!b.promoted,
    }));

    return { posted: postedDTO, solved };
  });


/* -------------------------------------------------------------------------- */
/*  Courses tab                                                                */
/* -------------------------------------------------------------------------- */

export interface DashboardEnrolledCourse {
  id: string;
  courseId: string;
  title: string;
  coverPath: string | null;
  coverUrl: string | null;
  slug: string | null;
  totalModules: number;
  completedModules: number;
  completedAt: string | null;
  enrolledAt: string;
  isFree: boolean;
}

export interface DashboardPublishedCourse {
  id: string;
  title: string;
  slug: string | null;
  coverPath: string | null;
  coverUrl: string | null;
  description: string | null;
  category: string | null;
  level: string | null;
  priceUSD: number;
  isPublished: boolean;
  isFree: boolean;
  enrollments: number;
  revenueUSD: number;
  createdAt: string;
}

export const listMyCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ enrolled: DashboardEnrolledCourse[]; published: DashboardPublishedCourse[] }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;

    const { data: enrolls } = await sb
      .from("course_enrollments")
      .select("id, course_id, completed_at, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false });
    const eRows = (enrolls ?? []) as Array<{ id: string; course_id: string; completed_at: string | null; created_at: string }>;
    const courseIds = eRows.map((r) => r.course_id);

    let courseMap = new Map<string, { title: string; slug: string | null; cover_path: string | null; is_free: boolean }>();
    let modulesMap = new Map<string, number>();
    let progressMap = new Map<string, number>();
    if (courseIds.length) {
      const [{ data: cs }, { data: ms }, { data: pr }] = await Promise.all([
        sb.from("courses").select("id, title, slug, cover_path, is_free").in("id", courseIds),
        sb.from("course_modules").select("id, course_id").in("course_id", courseIds),
        sb.from("course_progress").select("course_id, module_id").eq("user_id", me).in("course_id", courseIds),
      ]);
      courseMap = new Map(((cs ?? []) as Array<{ id: string; title: string; slug: string | null; cover_path: string | null; is_free: boolean }>).map((c) => [c.id, c]));
      for (const m of ((ms ?? []) as Array<{ course_id: string }>)) {
        modulesMap.set(m.course_id, (modulesMap.get(m.course_id) ?? 0) + 1);
      }
      for (const p of ((pr ?? []) as Array<{ course_id: string }>)) {
        progressMap.set(p.course_id, (progressMap.get(p.course_id) ?? 0) + 1);
      }
    }

    const { data: mine } = await sb
      .from("courses")
      .select("id, title, slug, cover_path, description, category, level, price_usd, is_published, is_free, created_at")
      .eq("owner_id", me)
      .order("created_at", { ascending: false });
    const mineRows = (mine ?? []) as Array<{ id: string; title: string; slug: string | null; cover_path: string | null; description: string | null; category: string | null; level: string | null; price_usd: number; is_published: boolean; is_free: boolean; created_at: string }>;
    const myIds = mineRows.map((r) => r.id);
    const enrollCount = new Map<string, { count: number; revenue: number }>();
    if (myIds.length) {
      const { data: byCourse } = await sb.from("course_enrollments").select("course_id, amount_paid_usd").in("course_id", myIds);
      for (const e of ((byCourse ?? []) as Array<{ course_id: string; amount_paid_usd: number }>)) {
        const cur = enrollCount.get(e.course_id) ?? { count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += Number(e.amount_paid_usd || 0);
        enrollCount.set(e.course_id, cur);
      }
    }

    // Sign private course-cover paths for both enrolled and published sets in one batch.
    const allCoverPaths: (string | null)[] = [
      ...eRows.map((r) => courseMap.get(r.course_id)?.cover_path ?? null),
      ...mineRows.map((r) => r.cover_path),
    ];
    const uniquePaths = Array.from(new Set(allCoverPaths.filter((p): p is string => !!p)));
    const signedMap = new Map<string, string>();
    if (uniquePaths.length) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: signed } = await supabaseAdmin.storage
          .from("course-covers")
          .createSignedUrls(uniquePaths, 60 * 60 * 24 * 7);
        (signed ?? []).forEach((r) => { if (r.path && r.signedUrl) signedMap.set(r.path, r.signedUrl); });
      } catch { /* fall back to null */ }
    }
    const signOne = (p: string | null) => (p ? signedMap.get(p) ?? null : null);

    const enrolled: DashboardEnrolledCourse[] = eRows.map((r) => {
      const c = courseMap.get(r.course_id);
      return {
        id: r.id,
        courseId: r.course_id,
        title: c?.title ?? "Course",
        coverPath: c?.cover_path ?? null,
        coverUrl: signOne(c?.cover_path ?? null),
        slug: c?.slug ?? null,
        totalModules: modulesMap.get(r.course_id) ?? 0,
        completedModules: progressMap.get(r.course_id) ?? 0,
        completedAt: r.completed_at,
        enrolledAt: r.created_at,
        isFree: !!c?.is_free,
      };
    });

    const published: DashboardPublishedCourse[] = mineRows.map((r) => {
      const stats = enrollCount.get(r.id) ?? { count: 0, revenue: 0 };
      return {
        id: r.id,
        title: r.title,
        slug: r.slug,
        coverPath: r.cover_path,
        coverUrl: signOne(r.cover_path),
        description: r.description,
        category: r.category,
        level: r.level,
        priceUSD: Number(r.price_usd || 0),
        isPublished: !!r.is_published,
        isFree: !!r.is_free,
        enrollments: stats.count,
        revenueUSD: Number(stats.revenue.toFixed(2)),
        createdAt: r.created_at,
      };
    });

    return { enrolled, published };
  });

/* -------------------------------------------------------------------------- */
/*  Wallet & earnings tab                                                      */
/* -------------------------------------------------------------------------- */

export interface DashboardWalletSummary {
  homeCurrency: HomeCurrency;
  mainBalance: number;        // available balance in home currency
  mainBalanceUSD: number;     // USD equivalent of main balance
  cashback: number;           // accumulated cashback in home currency
  escrow: number;             // escrow balance in home currency
  fxRate: number;             // 1 USD -> home currency
  recent: Array<{ id: string; type: string; amount: number; currency: string; inflow: boolean; status: string; occurredAt: string; amountHome: number }>;
  recentTotal: number;
  page: number;
  pageSize: number;
  pendingPayouts: Array<{ id: string; amount: number; currency: string; method: string; status: string; createdAt: string }>;
}

const WALLET_PAGE_SIZE = 10;

export const getMyWalletSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number } | undefined) => ({
    page: Math.max(1, Number(input?.page ?? 1)),
  }))
  .handler(async ({ data, context }): Promise<DashboardWalletSummary> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;
    const page = data.page;
    const from = (page - 1) * WALLET_PAGE_SIZE;
    const to = from + WALLET_PAGE_SIZE - 1;

    const [wRes, txRes, poRes, profileRes, rates] = await Promise.all([
      sb.from("wallets").select("currency, available_balance, escrow_balance, accumulated_cashback").eq("user_id", me),
      sb
        .from("wallet_transactions")
        .select("id, type, amount, currency, inflow, status, occurred_at", { count: "exact" })
        .eq("user_id", me)
        .order("occurred_at", { ascending: false })
        .range(from, to),
      sb.from("payout_requests").select("id, amount, currency, method, status, created_at").eq("user_id", me).in("status", ["pending", "approved"]).order("created_at", { ascending: false }),
      (async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return await supabaseAdmin.from("profiles").select("country").eq("user_id", me).maybeSingle();
        } catch {
          return { data: null } as { data: { country: string | null } | null };
        }
      })(),
      loadUsdRates(sb),
    ]);

    const homeCurrency = countryToHomeCurrency(
      (profileRes?.data as { country?: string | null } | null)?.country ?? null,
    );
    const fxRate = rates[homeCurrency] ?? 1;

    type WalletRow = { currency: string; available_balance: number; escrow_balance: number; accumulated_cashback: number };
    const rows = (wRes.data ?? []) as WalletRow[];
    const homeRow = rows.find((r) => r.currency === homeCurrency) ?? null;

    const mainBalance = Number(homeRow?.available_balance ?? 0);
    const escrow = Number(homeRow?.escrow_balance ?? 0);
    // Cashback is stored in USD platform-wide; convert to home currency.
    const cashbackUSD = rows.reduce((s, r) => s + Number(r.accumulated_cashback || 0), 0);
    const cashback = cashbackUSD * fxRate;
    const mainBalanceUSD = homeCurrency === "USD" ? mainBalance : mainBalance / (fxRate || 1);

    const round = (n: number) => (homeCurrency === "USD" ? Number(n.toFixed(2)) : Number(n.toFixed(0)));

    const recent = ((txRes.data ?? []) as Array<{ id: string; type: string; amount: number; currency: string; inflow: boolean; status: string; occurred_at: string }>).map((r) => {
      const cur = r.currency as HomeCurrency;
      const usd = cur === "USD" ? Number(r.amount) : Number(r.amount) / (rates[cur] ?? 1);
      const amountHome = homeCurrency === "USD" ? usd : usd * fxRate;
      return {
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        currency: r.currency,
        inflow: r.inflow,
        status: r.status,
        occurredAt: r.occurred_at,
        amountHome: round(amountHome),
      };
    });

    return {
      homeCurrency,
      mainBalance: round(mainBalance),
      mainBalanceUSD: Number(mainBalanceUSD.toFixed(2)),
      cashback: round(cashback),
      escrow: round(escrow),
      fxRate,
      recent,
      recentTotal: txRes.count ?? recent.length,
      page,
      pageSize: WALLET_PAGE_SIZE,
      pendingPayouts: ((poRes.data ?? []) as Array<{ id: string; amount: number; currency: string; method: string; status: string; created_at: string }>).map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        currency: r.currency,
        method: r.method,
        status: r.status,
        createdAt: r.created_at,
      })),
    };
  });

/* -------------------------------------------------------------------------- */
/*  Social tab                                                                 */
/* -------------------------------------------------------------------------- */

export interface DashboardSocialUser {
  userId: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  at: string;
}

export interface DashboardSocialCircle {
  id: string;
  name: string;
  slug: string;
  role: string;
  emoji: string | null;
  joinedAt: string;
}

export interface DashboardSocial {
  followers: DashboardSocialUser[];
  following: DashboardSocialUser[];
  circles: DashboardSocialCircle[];
}

export const getMySocial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardSocial> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = context.userId;

    const [followersRes, followingRes, circlesRes] = await Promise.all([
      sb.from("follows").select("follower_id, created_at").eq("followee_id", me).order("created_at", { ascending: false }).limit(100),
      sb.from("follows").select("followee_id, created_at").eq("follower_id", me).order("created_at", { ascending: false }).limit(100),
      sb.from("circle_members").select("circle_id, role, joined_at").eq("user_id", me).order("joined_at", { ascending: false }),
    ]);

    const followerIds = ((followersRes.data ?? []) as Array<{ follower_id: string; created_at: string }>).map((r) => r.follower_id);
    const followingIds = ((followingRes.data ?? []) as Array<{ followee_id: string; created_at: string }>).map((r) => r.followee_id);
    const allUserIds = Array.from(new Set([...followerIds, ...followingIds]));

    let userMap = new Map<string, { slug: string; name: string; avatar: string | null }>();
    if (allUserIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, slug, display_name, username, avatar_path")
        .in("user_id", allUserIds);
      userMap = new Map(
        ((profs ?? []) as Array<{ user_id: string; slug: string; display_name: string | null; username: string | null; avatar_path: string | null }>).map((p) => [
          p.user_id,
          { slug: p.slug, name: p.display_name || p.username || "Peer", avatar: p.avatar_path },
        ]),
      );
    }

    // Sign avatar_path values from the `avatars` bucket so <img> can render them.
    const avatarPaths = Array.from(
      new Set(Array.from(userMap.values()).map((v) => v.avatar).filter((p): p is string => !!p)),
    );
    const signedAvatars = new Map<string, string>();
    if (avatarPaths.length) {
      const { data: signed } = await supabaseAdmin.storage
        .from("avatars")
        .createSignedUrls(avatarPaths, 60 * 60 * 24 * 7);
      (signed ?? []).forEach((r) => {
        if (r.path && r.signedUrl) signedAvatars.set(r.path, r.signedUrl);
      });
    }
    const avatarUrlFor = (uid: string): string | null => {
      const p = userMap.get(uid)?.avatar ?? null;
      return p ? (signedAvatars.get(p) ?? null) : null;
    };

    const followers: DashboardSocialUser[] = ((followersRes.data ?? []) as Array<{ follower_id: string; created_at: string }>).map((r) => {
      const p = userMap.get(r.follower_id);
      return { userId: r.follower_id, slug: p?.slug ?? r.follower_id, name: p?.name ?? "Peer", avatarUrl: avatarUrlFor(r.follower_id), at: r.created_at };
    });
    const following: DashboardSocialUser[] = ((followingRes.data ?? []) as Array<{ followee_id: string; created_at: string }>).map((r) => {
      const p = userMap.get(r.followee_id);
      return { userId: r.followee_id, slug: p?.slug ?? r.followee_id, name: p?.name ?? "Peer", avatarUrl: avatarUrlFor(r.followee_id), at: r.created_at };
    });

    const cRows = (circlesRes.data ?? []) as Array<{ circle_id: string; role: string; joined_at: string }>;
    const circleIds = cRows.map((r) => r.circle_id);
    let circleMap = new Map<string, { name: string; slug: string; emoji: string | null }>();
    if (circleIds.length) {
      const { data: cs } = await supabaseAdmin.from("circles").select("id, name, slug, emoji").in("id", circleIds);
      circleMap = new Map(((cs ?? []) as Array<{ id: string; name: string; slug: string; emoji: string | null }>).map((c) => [c.id, { name: c.name, slug: c.slug, emoji: c.emoji }]));
    }
    const circles: DashboardSocialCircle[] = cRows.map((r) => {
      const c = circleMap.get(r.circle_id);
      return { id: r.circle_id, name: c?.name ?? "Circle", slug: c?.slug ?? r.circle_id, role: r.role, emoji: c?.emoji ?? null, joinedAt: r.joined_at };
    });

    return { followers, following, circles };
  });
