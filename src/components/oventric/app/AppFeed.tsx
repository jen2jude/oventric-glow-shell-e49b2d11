import { logCreatorEvent } from "@/lib/creator-events";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  Share2,
  Play,
  Loader2,
  ShoppingBag,
  MoreHorizontal,
  Eye,
  EyeOff,
  Link2,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Pencil,
  Trash2,
  Gift,
  Sparkles,
  Store,
  LayoutGrid,
  BadgeCheck,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { AppSheet } from "@/components/oventric/app/AppSheet";
import { listPosts, toggleLike, setPostSaved as setPostSavedFn, deletePost as deletePostFn, updatePostText as updatePostTextFn } from "@/lib/posts.functions";
import { listFollowing, listFollowers } from "@/lib/follows.functions";
import { listCreatorFeed, getTopCreators, getMyCreatorProfile, type CreatorPostDTO } from "@/lib/creators.functions";
import { CreatorOnboardingModal } from "@/components/oventric/creators/CreatorOnboardingModal";
import { CreatorPublishModal } from "@/components/oventric/creators/CreatorPublishModal";
import { setCurrentFeedTab } from "@/lib/create-context";
import { listProducts } from "@/lib/marketplace.functions";
import { CreatorPostSheet } from "@/components/oventric/app/CreatorPostSheet";
import { ProductQuickView } from "./ProductQuickView";
import { EDIT_WINDOW_MS } from "@/lib/post-edit";
import { togglePostSet, getSavedPosts } from "@/components/oventric/PostActionsMenu";
import { ReportModal } from "@/components/oventric/ReportModal";
import { CommentsSheet } from "@/components/oventric/feed/CommentsSheet";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { visibleProductPrice } from "@/lib/money-visibility";
import { trackPostView } from "@/lib/post-views";
import type { ProductDTO } from "@/lib/marketplace.functions";
import { PostComposerModal } from "@/components/oventric/PostComposerModal";

type Post = Awaited<ReturnType<typeof listPosts>>["posts"][number];

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

/** Muted looping 10s preview that starts when scrolled into view; tap opens the detail panel. */
function AppPreviewVideo({ src, poster, onTap }: { src: string; poster: string | null; onTap: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.muted = true;
          void el.play().catch(() => {});
          timer = setInterval(() => {
            if (el.currentTime > 10) el.currentTime = 0;
          }, 500);
        } else {
          el.pause();
          if (timer) clearInterval(timer);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-neutral-900">
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        className="pointer-events-none aspect-video w-full object-cover"
      />
      <button
        type="button"
        aria-label="Open showcase"
        onClick={() => {
          haptic("select");
          onTap();
        }}
        className="absolute inset-0"
      />
      <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur" style={{ color: "#ffffff" }}>
        <Play className="h-3 w-3" /> Tap to watch
      </span>
    </div>
  );
}

/** Native app feed: X-style vertical timeline of compact post cards. */
export function AppFeed() {
  const fetchPosts = useServerFn(listPosts);
  const like = useServerFn(toggleLike);
  const saveFn = useServerFn(setPostSavedFn);
  const deleteFn = useServerFn(deletePostFn);
  const updateText = useServerFn(updatePostTextFn);
  const navigate = useNavigate();
  const { openGate } = useAuthGate() as any;
  const { homeCurrency, balancesHidden } = useOnboarding();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : getSavedPosts(),
  );
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const [menuFor, setMenuFor] = useState<Post | null>(null);
  const [reportFor, setReportFor] = useState<Post | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<{ id: string; text: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [tab, setTab] = useState<"foryou" | "following" | "shop" | "creators">("foryou");
  // Tell the page-aware coach which Newsfeed tab is showing.
  useEffect(() => {
    (window as unknown as { __oventricFeedTab?: string }).__oventricFeedTab = tab;
    window.dispatchEvent(new CustomEvent("oventric:feed-tab", { detail: tab }));
    return () => {
      (window as unknown as { __oventricFeedTab?: string }).__oventricFeedTab = undefined;
      window.dispatchEvent(new CustomEvent("oventric:feed-tab", { detail: null }));
    };
  }, [tab]);
  const [followingIds, setFollowingIds] = useState<Set<string> | null>(null);
  const [followerIds, setFollowerIds] = useState<Set<string> | null>(null);
  const loadFollowing = useServerFn(listFollowing);
  const loadFollowers = useServerFn(listFollowers);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [creatorSheet, setCreatorSheet] = useState<CreatorPostDTO | null>(null);
  // "New creator content" links: the global CreatorPostDeepLink opens the
  // player; here we just jump to the Creators tab.
  useEffect(() => {
    const w = window as unknown as { __oventricOpenCreators?: boolean };
    const go = () => {
      w.__oventricOpenCreators = false;
      setTab("creators");
    };
    if (w.__oventricOpenCreators) go();
    window.addEventListener("oventric:open-creators", go);
    return () => window.removeEventListener("oventric:open-creators", go);
  }, []);
  const fetchProducts = useServerFn(listProducts);
  const fetchCreatorFeed = useServerFn(listCreatorFeed);
  const fetchTopCreators = useServerFn(getTopCreators);
  const loadCreatorProfile = useServerFn(getMyCreatorProfile);
  const queryClient = useQueryClient();
  const [creatorOnboardOpen, setCreatorOnboardOpen] = useState(false);
  const [creatorPublishOpen, setCreatorPublishOpen] = useState(false);
  const { data: creatorPosts } = useQuery({
    queryKey: ["app-feed-creator-posts"],
    queryFn: () => fetchCreatorFeed(),
    staleTime: 60_000,
    enabled: tab === "creators",
  });
  const { data: topCreators } = useQuery({
    queryKey: ["app-feed-top-creators"],
    queryFn: () => fetchTopCreators(),
    staleTime: 120_000,
    enabled: tab === "creators",
  });
  const { data: shopProducts } = useQuery({
    queryKey: ["app-feed-shop-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60_000,
    enabled: tab === "shop",
  });
  const shopPriceOf = (p: ProductDTO) =>
    visibleProductPrice(
      {
        price_usd: p.priceUSD,
        original_currency: p.originalCurrency,
        original_amount: p.originalAmount,
        fx_snapshot: p.fxSnapshot,
      },
      (homeCurrency ?? "USD") as Currency,
      balancesHidden,
    );

  // Shop tab sections, mirroring the web feed: Free downloads, Popular right
  // now, then up to 6 category sections.
  const shopSections = useMemo(() => {
    const all = shopProducts ?? [];
    const bySales = (a: ProductDTO, b: ProductDTO) =>
      (b.salesCount ?? 0) - (a.salesCount ?? 0);
    const free = all.filter((p) => p.priceUSD <= 0).slice(0, 8);
    const paid = all.filter((p) => p.priceUSD > 0);
    // Trending rail: most-bought first; if nothing has sold yet, fall back to
    // the newest paid products so the rail is never empty.
    const sold = paid.filter((p) => (p.salesCount ?? 0) > 0).sort(bySales);
    const trending = (sold.length > 0 ? sold : [...paid]).slice(0, 10);
    const byCategory = new Map<string, ProductDTO[]>();
    paid.forEach((p) => {
      const key = p.category || "Other";
      const list = byCategory.get(key) ?? [];
      list.push(p);
      byCategory.set(key, list);
    });
    return {
      free,
      trending,
      popular: [...paid].sort(bySales).slice(0, 8),
      categories: Array.from(byCategory.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6)
        .map(([name, items]) => [name, items.slice(0, 8)] as const),
    };
  }, [shopProducts]);

  const saveEdit = async () => {
    if (!editingPost) return;
    const { id, text } = editingPost;
    setEditSaving(true);
    try {
      await updateText({ data: { id, text: text.trim() } });
      setPosts((xs) => xs!.map((x) => (x.id === id ? { ...x, text: text.trim() } : x)));
      setEditingPost(null);
      toast.success("Post updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update this post");
    } finally {
      setEditSaving(false);
    }
  };

  const reloadPosts = () =>
    fetchPosts()
      .then((r) => setPosts(r.posts.filter((p) => !p.repost_of || p.text || p.media_url)))
      .catch(() => {});

  // Let the footer + button know which tab is showing.
  useEffect(() => {
    setCurrentFeedTab(tab);
  }, [tab]);
  useEffect(() => () => setCurrentFeedTab(null), []);

  // Create requests: "post" opens the composer; "creator" opens the creator
  // upload for returning creators, or onboarding for first-timers.
  useEffect(() => {
    const onCreate = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === "post") setComposerOpen(true);
      if (kind === "creator") {
        void loadCreatorProfile()
          .then((p) => (p.isCreator ? setCreatorPublishOpen(true) : setCreatorOnboardOpen(true)))
          .catch(() => setCreatorOnboardOpen(true));
      }
    };
    window.addEventListener("oventric:create", onCreate);
    return () => window.removeEventListener("oventric:create", onCreate);
  }, [loadCreatorProfile]);

  useEffect(() => {
    fetchPosts()
      .then((r) => setPosts(r.posts.filter((p) => !p.repost_of || p.text || p.media_url)))
      .catch(() => setPosts([]));
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setUserId(data.session?.user.id ?? null);
    });
  }, [fetchPosts]);

  // Both sides of the user's network power the Following tab (same as web).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      loadFollowing({ data: { userId } }),
      loadFollowers({ data: { userId } }),
    ])
      .then(([following, followers]) => {
        if (cancelled) return;
        setFollowingIds(new Set((following ?? []).map((r: any) => r.userId ?? r.user_id ?? r.id)));
        setFollowerIds(new Set((followers ?? []).map((r: any) => r.userId ?? r.user_id ?? r.id)));
      })
      .catch(() => {
        setFollowingIds(new Set());
        setFollowerIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [userId, loadFollowing, loadFollowers]);

  const onLike = async (p: Post) => {
    if (!signedIn) return openGate?.("generic");
    haptic("select");
    const next = !p.viewer_liked;
    setPosts((xs) =>
      xs!.map((x) =>
        x.id === p.id ? { ...x, viewer_liked: next, likes_count: x.likes_count + (next ? 1 : -1) } : x,
      ),
    );
    try {
      await like({ data: { postId: p.id, like: next } });
    } catch {
      setPosts((xs) =>
        xs!.map((x) =>
          x.id === p.id ? { ...x, viewer_liked: !next, likes_count: x.likes_count + (next ? -1 : 1) } : x,
        ),
      );
    }
  };

  const onShare = async (p: Post) => {
    const url = `${window.location.origin}/post/${p.id}`;
    haptic("light");
    try {
      if (navigator.share) await navigator.share({ title: p.author_name, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* dismissed */
    }
  };

  const openAuthor = (p: Post) => {
    if (p.author_slug || p.author_id)
      navigate({ to: "/profile/$id", params: { id: p.author_slug ?? p.author_id } });
  };

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState<number | null>(null);
  const [enterDir, setEnterDir] = useState<"left" | "right" | null>(null);

  if (!posts) {
    return (
      <div className="flex h-[calc(100dvh-80px)] items-center justify-center bg-[#070A08]">
        <Loader2 className="h-6 w-6 animate-spin text-[#E5484D]" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-80px)] items-center justify-center bg-[#070A08] px-8 text-center text-[13px] text-white/50">
        No posts yet — tap + to share the first one.
      </div>
    );
  }

  const visiblePosts = posts
    .filter((p) => !hidden.has(p.id))
    .filter((p) => {
      if (tab === "creators") return false; // creators tab renders its own section
      if (tab === "shop") return (p.product_attachments?.length ?? 0) > 0;
      if (tab !== "following") return true;
      if (!followingIds || !followerIds) return true; // still loading
      return followingIds.has(p.author_id) || followerIds.has(p.author_id);
    });

  // Swipe left = next tab, swipe right = previous tab (For you ↔ Following ↔ Shop).
  // Creators is its own Creator Hub screen (footer button), not a feed tab.
  const FEED_TABS = ["foryou", "following", "shop"] as const;
  const onFeedTouchStart = (e: React.TouchEvent) => {
    if (tab === "creators") return;
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onFeedTouchMove = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dragX === null && (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy))) return; // vertical scroll stays scrolling
    const idx = (FEED_TABS as readonly string[]).indexOf(tab);
    const atEdge = (dx < 0 && idx === FEED_TABS.length - 1) || (dx > 0 && idx === 0);
    setDragX(atEdge ? dx * 0.25 : dx); // damped resistance at the first/last tab
  };
  const onFeedTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    const dx = dragX ?? 0;
    setDragX(null);
    if (!start) return;
    const t = e.changedTouches[0];
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const idx = (FEED_TABS as readonly string[]).indexOf(tab);
    const next = dx < 0 ? idx + 1 : idx - 1;
    if (next < 0 || next >= FEED_TABS.length) return;
    haptic("select");
    setEnterDir(dx < 0 ? "left" : "right");
    setTab(FEED_TABS[next]);
  };

  return (
    <div
      className="min-h-[calc(100dvh-80px)] bg-[#070A08] pb-24"
      onTouchStart={onFeedTouchStart}
      onTouchMove={onFeedTouchMove}
      onTouchEnd={onFeedTouchEnd}
    >
      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={async () => {
          await reloadPosts();
        }}
      />
      {/* Stick within the feed's scroll area, directly beneath the app header.
          Unlike a viewport-fixed bar, this occupies space above the first post. */}
      <div className="app-scroll-header sticky top-0 z-30 w-full border-b border-white/10 bg-[#070A08] shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
        {tab === "creators" ? (
          <div className="mx-auto flex h-12 w-full max-w-md items-center justify-center px-4 text-[14px] font-bold text-white">
            Creator Hub
          </div>
        ) : (
        <div className="mx-auto flex h-12 w-full max-w-md items-center justify-evenly px-2">
          {(
            [
              { key: "foryou", label: "For you" },
              { key: "following", label: "Following" },
              { key: "shop", label: "Shop" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                haptic("select");
                setTab(t.key);
              }}
              className="relative flex h-full min-w-0 flex-1 items-center justify-center px-1 text-[12px] font-bold"
              style={{ color: tab === t.key ? "#ffffff" : "rgba(255,255,255,0.4)" }}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-[#E5484D]" />
              )}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Tab content: follows the finger while swiping, slides in on tab change */}
      <div
        key={tab}
        className={
          enterDir === "left"
            ? "animate-[feed-slide-left_0.28s_ease-out]"
            : enterDir === "right"
              ? "animate-[feed-slide-right_0.28s_ease-out]"
              : undefined
        }
        style={
          dragX !== null
            ? { transform: `translateX(${dragX}px)`, transition: "none" }
            : { transition: "transform 0.22s ease-out" }
        }
        onAnimationEnd={() => setEnterDir(null)}
      >
      {/* Shop tab: product rail above the shoppable posts */}
      {tab === "shop" && shopSections.trending.length > 0 && (
        <div className="border-b border-white/5 py-3">
          <p className="px-4 text-[11px] font-bold uppercase tracking-wider text-white/40">
            Trending in the market
          </p>
          <div className="mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shopSections.trending.map((sp) => (
              <button
                key={sp.id}
                onClick={() => {
                  haptic("select");
                  setQuickViewId(sp.id);
                }}
                className="w-[130px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left active:bg-white/[0.06]"
              >
                <div className="aspect-square w-full bg-neutral-900">
                  {sp.coverUrl ? (
                    <img src={sp.coverUrl} alt={sp.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-white/10" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="line-clamp-1 text-[11px] font-semibold text-white">{sp.name}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-[#E5484D]">{shopPriceOf(sp)}</p>
                  {(sp.salesCount ?? 0) > 0 && (
                    <p className="mt-0.5 text-[10px] font-medium text-white/35">
                      {sp.salesCount} sold
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shop tab: marketplace sections, mirroring the web feed */}
      {tab === "shop" && (shopProducts?.length ?? 0) > 0 && (
        <div className="space-y-5 border-b border-white/5 px-4 py-4">
          {(
            [
              { title: "Free downloads", subtitle: "Grab these at no cost", icon: Gift, items: shopSections.free },
              { title: "Popular right now", subtitle: "Top digital products on Oventric", icon: Sparkles, items: shopSections.popular },
              ...shopSections.categories.map(([name, items], i) => ({
                title: name,
                subtitle: "Browse this category",
                icon: i % 2 === 0 ? Store : LayoutGrid,
                items,
              })),
            ] as const
          )
            .filter((s) => s.items.length > 0)
            .map((s) => (
              <section key={s.title} aria-label={s.title}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#E5484D]/25 bg-[#E5484D]/10">
                    <s.icon className="h-4 w-4 text-[#E5484D]" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0">
                    <h2 className="truncate text-[13px] font-bold text-white">{s.title}</h2>
                    <p className="truncate text-[10.5px] text-white/40">{s.subtitle}</p>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {s.items.map((sp) => {
                    const free = sp.priceUSD <= 0;
                    return (
                      <button
                        key={`${s.title}-${sp.id}`}
                        onClick={() => {
                          haptic("select");
                          setQuickViewId(sp.id);
                        }}
                        className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left active:bg-white/[0.06]"
                      >
                        <div className="relative h-24 w-full bg-neutral-900">
                          {sp.coverUrl ? (
                            <img src={sp.coverUrl} alt={sp.name} loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <div className={`h-full w-full bg-gradient-to-br ${sp.hue}`} />
                          )}
                          {free && (
                            <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold text-white">
                              FREE
                            </span>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="line-clamp-2 text-[11.5px] font-semibold leading-snug text-white">{sp.name}</p>
                          <p className="mt-0.5 truncate text-[10px] text-white/35">{sp.vendor}</p>
                          <p className={`mt-0.5 text-[11px] font-bold ${free ? "text-emerald-400" : "text-[#E5484D]"}`}>
                            {free ? "Free" : shopPriceOf(sp)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}

      {/* Creators tab: top creators rail + showcase posts */}
      {tab === "creators" && (
        <div className="pb-4">
          {(topCreators?.length ?? 0) > 0 && (
            <div className="border-b border-white/5 py-3">
              <p className="px-4 text-[11px] font-bold uppercase tracking-wider text-white/40">
                Top creators
              </p>
              <div className="mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {topCreators!.slice(0, 12).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      haptic("select");
                      if (c.slug) navigate({ to: "/profile/$id", params: { id: c.slug } });
                    }}
                    className="flex w-[72px] shrink-0 snap-start flex-col items-center gap-1.5"
                  >
                    <span className="relative h-14 w-14 overflow-hidden rounded-full border border-white/10">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-[#E5484D] text-[14px] font-bold" style={{ color: "#ffffff" }}>
                          {c.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="flex w-full items-center justify-center gap-0.5">
                      <span className="line-clamp-1 text-[10.5px] font-semibold text-white">{c.name.split(" ")[0]}</span>
                      {c.verified && <BadgeCheck className="h-3 w-3 shrink-0 text-[#E5484D]" />}
                    </span>
                    <span className="text-[9.5px] text-white/35">{compact(c.followersCount)} followers</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!creatorPosts && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-white/30" />
            </div>
          )}
          {creatorPosts && creatorPosts.length === 0 && (
            <div className="flex items-center justify-center px-8 py-20 text-center text-[13px] text-white/50">
              No creator showcases yet — creators can publish their work from the + button.
            </div>
          )}

          <div className="divide-y divide-white/5">
            {(creatorPosts ?? []).map((cp: CreatorPostDTO) => {
              const thumb = cp.media[0];
              const isVideo = thumb?.type === "video" || !!cp.externalEmbedUrl;
              const price = cp.asset
                ? cp.asset.isFree
                  ? "Free"
                  : visibleProductPrice(
                      {
                        price_usd: cp.asset.priceUsd,
                        original_currency: cp.asset.originalCurrency ?? "USD",
                        original_amount: cp.asset.originalAmount ?? cp.asset.priceUsd,
                        fx_snapshot: cp.asset.fxSnapshot,
                      },
                      (homeCurrency ?? "USD") as Currency,
                      balancesHidden,
                    )
                : null;
              return (
                <article key={cp.id} className="px-4 py-3 active:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                      {cp.author.avatarUrl ? (
                        <img src={cp.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-[#E5484D] text-[11px] font-bold" style={{ color: "#ffffff" }}>
                          {cp.author.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[12.5px] font-bold text-white">{cp.author.name}</p>
                      <p className="text-[10.5px] text-white/35">
                        {ago(cp.createdAt)} · {compact(cp.viewCount)} views
                      </p>
                    </div>
                    {cp.fields[0] && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9.5px] font-semibold text-white/50">
                        {cp.fields[0]}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-white">{cp.title}</p>
                  {cp.caption && (
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-white/55">{cp.caption}</p>
                  )}

                  {thumb && thumb.type === "video" ? (
                    <div className="mt-2">
                      <AppPreviewVideo src={thumb.url} poster={thumb.posterUrl ?? null} onTap={() => setCreatorSheet(cp)} />
                    </div>
                  ) : thumb ? (
                    <button
                      onClick={() => {
                        if (cp.externalUrl) {
                          haptic("select");
                          logCreatorEvent(cp.id, "link_click", { target: cp.externalUrl });
                          window.open(cp.externalUrl, "_blank", "noopener");
                        }
                      }}
                      className="relative mt-2 block w-full overflow-hidden rounded-2xl border border-white/[0.08]"
                    >
                      <div className="aspect-video w-full bg-neutral-900">
                        {(thumb.posterUrl ?? thumb.url) && (
                          <img
                            src={thumb.posterUrl ?? thumb.url}
                            alt={cp.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      {isVideo && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 backdrop-blur">
                            <Play className="ml-0.5 h-5 w-5" style={{ color: "#ffffff" }} />
                          </span>
                        </span>
                      )}
                      {price && (
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold backdrop-blur" style={{ color: cp.asset?.isFree ? "#4ADE80" : "#E5484D" }}>
                          {price}
                        </span>
                      )}
                    </button>
                  ) : null}

                  {cp.asset &&
                    (cp.asset.available ? (
                      <button
                        type="button"
                        onClick={() => {
                          haptic("select");
                          setCreatorSheet(cp);
                        }}
                        className={`mt-2 inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-black active:opacity-80 ${
                          cp.asset.isFree
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : "border-[#E5484D]/40 bg-[#E5484D]/15 text-[#FF7A7E]"
                        }`}
                      >
                        <span className="text-[10px] font-black">{compact(cp.asset.downloadCount)}</span>
                        {cp.asset.isFree ? <Download className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                        {cp.asset.isFree ? "Get it free" : "Buy"}
                        {!cp.asset.isFree && price && (
                          <span className="border-l border-[#E5484D]/30 pl-2 text-[10px]">{price}</span>
                        )}
                      </button>
                    ) : (
                      <span className="mt-2 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-[10.5px] font-bold text-white/40">
                        Asset pending review
                      </span>
                    ))}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab !== "creators" && visiblePosts.length === 0 && (
        <div className="flex items-center justify-center px-8 py-20 text-center text-[13px] text-white/50">
          {tab === "following"
            ? "No posts from people you follow yet — follow creators to fill this feed."
            : tab === "shop"
              ? "No shoppable posts yet — sellers can attach products to their posts."
              : "No posts yet — tap + to share the first one."}
        </div>
      )}

      <div className="divide-y divide-white/5">
        {visiblePosts.map((p) => {
          const img = p.media_type === "video" ? p.poster_url : p.media_url;
          return (
            <article key={p.id} ref={trackPostView(p.id)} className="px-4 py-3 active:bg-white/[0.02]">
              {/* Header row */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => openAuthor(p)}
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
                  aria-label={`Open ${p.author_name}`}
                >
                  {p.author_avatar_url ? (
                    <img src={p.author_avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center bg-[#E5484D] text-[12px] font-bold"
                      style={{ color: "#ffffff" }}
                    >
                      {p.initials}
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <button
                      onClick={() => openAuthor(p)}
                      className="truncate text-[14px] font-bold"
                      style={{ color: "#ffffff" }}
                    >
                      {p.author_name}
                    </button>
                    <span className="shrink-0 text-[12px] text-white/40">· {ago(p.created_at)}</span>
                  </div>
                  {p.mentions.length > 0 && (
                    <p className="text-[12px] leading-snug text-white/50">
                      is with{" "}
                      {p.mentions.slice(0, 2).map((m, i) => (
                        <span key={m.user_id}>
                          {i > 0 && (p.mentions.length === 2 ? " and " : ", ")}
                          <button
                            onClick={() => navigate({ to: "/profile/$id", params: { id: m.slug ?? m.user_id } })}
                            className="font-semibold text-white/85"
                          >
                            {m.name}
                          </button>
                        </span>
                      ))}
                      {p.mentions.length > 2 && (
                        <>
                          {" and "}
                          <span className="font-semibold text-white/85">
                            {p.mentions.length - 2 >= 10 ? "10+" : p.mentions.length - 2} other{p.mentions.length - 2 === 1 ? "" : "s"}
                          </span>
                        </>
                      )}
                    </p>
                  )}

                  {/* Text — long posts truncate with a View more toggle */}
                  {p.text &&
                    (p.text.length > 240 ? (
                      <div className="mt-0.5">
                        <p
                          className={`whitespace-pre-line text-[14px] leading-snug text-white/90 ${
                            expanded.has(p.id) ? "" : "line-clamp-5"
                          }`}
                        >
                          {p.text}
                        </p>
                        <button
                          onClick={() =>
                            setExpanded((s) => {
                              const n = new Set(s);
                              if (n.has(p.id)) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                          className="mt-1 text-[13px] font-semibold text-[#E5484D]"
                        >
                          {expanded.has(p.id) ? "Show less" : "View more"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-0.5 whitespace-pre-line text-[14px] leading-snug text-white/90">
                        {p.text}
                      </p>
                    ))}

                  {/* Media */}
                  {img && (
                    <button
                      onClick={() => navigate({ to: "/post/$id", params: { id: p.id } })}
                      className="relative mt-2.5 block w-full overflow-hidden rounded-2xl border border-white/10"
                      aria-label="Open post"
                    >
                      <img src={img} alt="" loading="lazy" className="w-full object-cover" />
                      {p.media_type === "video" && (
                        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 backdrop-blur">
                          <Play className="h-5 w-5 fill-current" style={{ color: "#ffffff" }} />
                        </span>
                      )}
                    </button>
                  )}

                  {/* Product attachments — swipe sideways when several are tagged */}
                  {(p.product_attachments?.length ?? 0) > 0 && (
                  <div className="-mr-4 mt-2.5 flex snap-x snap-mandatory gap-2 overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {p.product_attachments!.map((pa) => {
                    const multi = p.product_attachments!.length > 1;
                    const widthCls = multi ? "w-[82%] shrink-0 snap-start" : "w-full";
                    if (pa.available === false) {
                      return (
                        <div key={pa.id} className={`flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 ${widthCls}`}>
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04]">
                            <ShoppingBag className="h-4 w-4 text-white/20" />
                          </div>
                          <p className="text-[12px] font-semibold text-white/60">
                            This product is no longer available
                          </p>
                        </div>
                      );
                    }
                    const priceLabel = visibleProductPrice(
                      {
                        price_usd: pa.priceUsd,
                        original_currency: (pa.originalCurrency ?? "USD") as any,
                        original_amount: pa.originalAmount ?? pa.priceUsd,
                        fx_snapshot: pa.fxSnapshot ?? null,
                      },
                      (homeCurrency ?? "USD") as Currency,
                      balancesHidden,
                    );
                    return (
                      <button
                        key={pa.id}
                        onClick={() =>
                          navigate({ to: "/product/$id", params: { id: pa.id } })
                        }
                        className={`flex items-stretch overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left active:bg-white/[0.06] ${widthCls}`}
                      >
                        <div className="w-20 shrink-0 bg-neutral-900">
                          {pa.coverUrl ? (
                            <img
                              src={pa.coverUrl}
                              alt={pa.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ShoppingBag className="h-5 w-5 text-white/10" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-1 text-[13px] font-bold text-white">
                              {pa.name}
                            </p>
                            <span className="shrink-0 text-[13px] font-black text-[#E5484D]">
                              {priceLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/45">
                            {pa.shortDescription || pa.vendor}
                          </p>
                          {!!pa.cashbackPct && pa.cashbackPct > 0 && (
                            <span className="mt-1 inline-block rounded-md border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              {pa.cashbackPct}% cashback
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  </div>
                  )}

                  {/* Action row */}
                  <div className="mt-2 flex items-center justify-between pr-2">
                    <button
                      onClick={() => setCommentsFor(p)}
                      className="flex items-center gap-1.5 text-white/45 active:text-[#E5484D]"
                      aria-label="Comments"
                    >
                      <MessageCircle className="h-[18px] w-[18px]" />
                      <span className="text-[12px] font-medium">{compact(p.comments_count)}</span>
                    </button>
                    <span className="flex items-center gap-1.5 text-white/45" aria-label="Views">
                      <Eye className="h-[18px] w-[18px]" />
                      <span className="text-[12px] font-medium">{compact(p.views_count)}</span>
                    </span>
                    <button
                      onClick={() => onLike(p)}
                      className={`flex items-center gap-1.5 ${p.viewer_liked ? "text-[#E5484D]" : "text-white/45"} active:text-[#E5484D]`}
                      aria-label="Like"
                    >
                      <Heart className={`h-[18px] w-[18px] ${p.viewer_liked ? "fill-[#E5484D]" : ""}`} />
                      <span className="text-[12px] font-medium">{compact(p.likes_count)}</span>
                    </button>
                    <button
                      onClick={() => onShare(p)}
                      className="flex items-center gap-1.5 text-white/45 active:text-[#E5484D]"
                      aria-label="Share"
                    >
                      <Share2 className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setMenuFor(p)}
                  className="-mr-2 shrink-0 rounded-full p-1.5 text-white/40 active:bg-white/10"
                  aria-label="More options"
                >
                  <MoreHorizontal className="h-[18px] w-[18px]" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      </div>

      {menuFor && (() => {
        const post = menuFor;
        const isOwn = !!userId && post.author_id === userId;
        const saved = savedIds.has(post.id);
        const run = (fn: () => void) => {
          setMenuFor(null);
          fn();
        };
        const toggleSave = () => {
          if (!signedIn) return openGate?.("generic");
          haptic("light");
          const next = !saved;
          setSavedIds((s) => {
            const n = new Set(s);
            if (next) n.add(post.id);
            else n.delete(post.id);
            return n;
          });
          togglePostSet("saved", post.id, next);
          saveFn({ data: { postId: post.id, saved: next } })
            .then(() => toast.success(next ? "Saved to your bookmarks." : "Removed from saved."))
            .catch(() => {
              setSavedIds((s) => {
                const n = new Set(s);
                if (next) n.delete(post.id);
                else n.add(post.id);
                return n;
              });
              togglePostSet("saved", post.id, !next);
              toast.error("Couldn't update your saved posts");
            });
        };
        const hide = (msg: string) => {
          haptic("select");
          setHidden((s) => new Set(s).add(post.id));
          togglePostSet("hidden", post.id, true);
          toast.success(msg);
        };
        const items: { icon: React.ElementType; label: string; sub?: string; danger?: boolean; action: () => void }[] = [
          { icon: Bookmark, label: saved ? "Unsave" : "Save", sub: "Add this to your saved items", action: toggleSave },
          {
            icon: ThumbsDown,
            label: "See less content like this",
            action: () => {
              togglePostSet("interested", post.id, false);
              hide("Thanks — we'll show less like this.");
            },
          },
          { icon: EyeOff, label: "Hide post", action: () => hide("Post hidden from your feed.") },
          {
            icon: ThumbsUp,
            label: "Interested",
            action: () => {
              haptic("select");
              togglePostSet("interested", post.id, true);
              togglePostSet("hidden", post.id, false);
              toast.success("Got it — we'll show more like this.");
            },
          },
          {
            icon: Share2,
            label: "Share",
            action: () => {
              haptic("light");
              void onShare(post);
            },
          },
          {
            icon: Link2,
            label: "Copy link",
            action: () => {
              haptic("light");
              navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`).then(() => toast.success("Link copied"));
            },
          },
          { icon: Eye, label: "View post", action: () => navigate({ to: "/post/$id", params: { id: post.id } }) },
          { icon: Flag, label: "Report this", danger: true, action: () => setReportFor(post) },
        ];
        if (isOwn) {
          const withinEditWindow =
            Date.now() - new Date(post.created_at).getTime() < EDIT_WINDOW_MS;
          if (withinEditWindow) {
            items.push({
              icon: Pencil,
              label: "Edit post",
              sub: "You can edit within 10 minutes of sharing",
              action: () => setEditingPost({ id: post.id, text: post.text ?? "" }),
            });
          }
          items.push({
            icon: Trash2,
            label: "Delete post",
            danger: true,
            action: () => {
              if (!window.confirm("Delete this post permanently?")) return;
              deleteFn({ data: { id: post.id } })
                .then(() => {
                  setPosts((xs) => xs!.filter((x) => x.id !== post.id));
                  toast.success("Post deleted.");
                })
                .catch(() => toast.error("Couldn't delete this post"));
            },
          });
        }
        return (
          <AppSheet open onClose={() => setMenuFor(null)}>
            <div className="px-2 pb-10 pt-1">
              <div className="px-4 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-white/40">
                More options
              </div>
              {items.map(({ icon: Icon, label, sub, danger, action }) => (
                <button
                  key={label}
                  onClick={() => run(action)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left active:bg-white/10"
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${danger ? "text-[#ff6369]" : "text-white/50"}`} />
                  <span className="min-w-0">
                    <span className={`block text-[14px] font-medium ${danger ? "text-[#ff6369]" : "text-white/85"}`}>
                      {label}
                    </span>
                    {sub ? <span className="block text-[11.5px] text-white/40">{sub}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </AppSheet>
        );
      })()}

      <ReportModal
        open={!!reportFor}
        onClose={() => setReportFor(null)}
        target="post"
        targetKind="post"
        targetId={reportFor?.id}
        onReported={(id) => {
          toast.success("Report submitted. Thank you.");
          setHidden((s) => new Set(s).add(id));
          togglePostSet("hidden", id, true);
        }}
      />

      {editingPost && (
        <AppSheet open onClose={() => (editSaving ? null : setEditingPost(null))}>
          <div className="px-4 pb-10 pt-1">
            <div className="px-1 pb-1 pt-2 text-[15px] font-bold" style={{ color: "#ffffff" }}>
              Edit post
            </div>
            <p className="px-1 pb-3 text-[12px] text-white/40">
              You can edit a post within 10 minutes of sharing it.
            </p>
            <textarea
              value={editingPost.text}
              onChange={(e) =>
                setEditingPost((prev) => (prev ? { ...prev, text: e.target.value } : prev))
              }
              rows={5}
              maxLength={4000}
              autoFocus
              className="w-full resize-none rounded-[10px] border border-white/10 bg-white/[0.06] p-3 text-[14px] leading-snug outline-none focus:border-[#E5484D]"
              style={{ color: "#ffffff" }}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditingPost(null)}
                className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white/60 active:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving || !editingPost.text.trim()}
                onClick={() => void saveEdit()}
                className="flex items-center gap-1.5 rounded-[10px] bg-[#E5484D] px-4 py-2 text-[13px] font-semibold hover:brightness-95 disabled:opacity-50"
                style={{ color: "#ffffff" }}
              >
                {editSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </AppSheet>
      )}

      {commentsFor && (
        <CommentsSheet
          postId={commentsFor.id}
          postAuthorName={commentsFor.author_name}
          onClose={() => setCommentsFor(null)}
          viewerName="You"
          viewerInitials="OV"
        />
      )}

      <CreatorPostSheet post={creatorSheet} onClose={() => setCreatorSheet(null)} />

      <CreatorOnboardingModal
        open={creatorOnboardOpen}
        onClose={() => setCreatorOnboardOpen(false)}
        onDone={() => {
          window.dispatchEvent(new Event("oventric:creator-onboarded"));
          setCreatorOnboardOpen(false);
          setCreatorPublishOpen(true);
        }}
      />
      <CreatorPublishModal
        open={creatorPublishOpen}
        onClose={() => setCreatorPublishOpen(false)}
        onPublished={() => {
          void queryClient.invalidateQueries({ queryKey: ["app-feed-creator-posts"] });
        }}
      />

      <ProductQuickView
        productId={quickViewId}
        currency={(homeCurrency ?? "USD") as Currency}
        onClose={() => setQuickViewId(null)}
      />
    </div>
  );
}
