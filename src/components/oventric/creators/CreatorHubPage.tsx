import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  BookOpen,
  Compass,
  Download,
  Flame,
  Home,
  Loader2,
  Play,
  Plus,
  Search,
  Sparkles,
  Trophy,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  getMyCreatorProfile,
  getTopCreators,
  listCreatorFeed,
  type CreatorPostDTO,
  type TopCreatorDTO,
} from "@/lib/creators.functions";
import { listFollowing } from "@/lib/follows.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { CreatorPostSheet } from "@/components/oventric/app/CreatorPostSheet";
import { CreatorOnboardingModal } from "@/components/oventric/creators/CreatorOnboardingModal";
import { CreatorPublishModal } from "@/components/oventric/creators/CreatorPublishModal";

type HubTab = "home" | "discover" | "following" | "resources" | "challenges";

const TABS: { key: HubTab; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "discover", label: "Discover", icon: Compass },
  { key: "following", label: "Following", icon: UsersRound },
  { key: "resources", label: "Resources", icon: BookOpen },
  { key: "challenges", label: "Challenges", icon: Trophy },
];

/** Accent per section — Bright Spectrum. */
const ACCENTS = ["#16A34A", "#2563EB", "#7C3AED", "#D97706", "#E5484D"];

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

/**
 * Standalone Creator Hub (/creators). Reuses the existing creator showcase
 * data (creator_posts, profiles, follows) — no separate social system.
 * Web renders light; the installed app renders dark.
 */
export function CreatorHubPage() {
  const isApp = useIsAppShell();
  const { isAuthenticated, openGate } = useAuthGate();
  const [tab, setTab] = useState<HubTab>("home");
  const [q, setQ] = useState("");
  const [openPost, setOpenPost] = useState<CreatorPostDTO | null>(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  const fetchFeed = useServerFn(listCreatorFeed);
  const fetchTop = useServerFn(getTopCreators);
  const fetchFollowing = useServerFn(listFollowing);
  const loadProfile = useServerFn(getMyCreatorProfile);

  const { data: posts, refetch: refetchPosts } = useQuery({
    queryKey: ["creator-hub-posts"],
    queryFn: () => fetchFeed(),
    staleTime: 60_000,
  });
  const { data: creators } = useQuery({
    queryKey: ["creator-hub-top"],
    queryFn: () => fetchTop(),
    staleTime: 120_000,
  });

  useEffect(() => {
    if (!isAuthenticated) return setMeId(null);
    void supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, [isAuthenticated]);

  const { data: following } = useQuery({
    queryKey: ["creator-hub-following", meId],
    queryFn: () => {
      if (!meId) return Promise.resolve([]);
      return fetchFollowing({ data: { userId: meId } });
    },
    enabled: !!meId && tab === "following",
    staleTime: 60_000,
  });

  const startCreate = () => {
    if (!isAuthenticated) return openGate("generic");
    void loadProfile()
      .then((p) => (p.isCreator ? setPublishOpen(true) : setOnboardOpen(true)))
      .catch(() => setOnboardOpen(true));
  };

  // Footer + button on this screen creates creator content.
  useEffect(() => {
    const onCreate = (e: Event) => {
      if ((e as CustomEvent<{ kind?: string }>).detail?.kind === "creator") startCreate();
    };
    window.addEventListener("oventric:create", onCreate);
    return () => window.removeEventListener("oventric:create", onCreate);
  });

  const needle = q.trim().toLowerCase();
  const filteredPosts = useMemo(() => {
    const all = posts ?? [];
    if (!needle) return all;
    return all.filter((p) =>
      [p.title, p.caption, p.author.name, ...(p.fields ?? [])].some((s) => s?.toLowerCase().includes(needle)),
    );
  }, [posts, needle]);
  const filteredCreators = useMemo(() => {
    const all = creators ?? [];
    if (!needle) return all;
    return all.filter((c) => [c.name, ...c.fields].some((s) => s.toLowerCase().includes(needle)));
  }, [creators, needle]);

  const trending = useMemo(
    () => [...filteredPosts].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0)).slice(0, 8),
    [filteredPosts],
  );
  const freeResources = useMemo(() => filteredPosts.filter((p) => p.asset?.available && p.asset.isFree), [filteredPosts]);
  // Rising: creators with real activity, ranked by views per post.
  const rising = useMemo(
    () =>
      [...filteredCreators]
        .filter((c) => c.postsCount > 0)
        .sort((a, b) => b.viewsCount / b.postsCount - a.viewsCount / a.postsCount)
        .slice(0, 8),
    [filteredCreators],
  );
  const followingIds = useMemo(() => new Set((following ?? []).map((p) => p.userId)), [following]);
  const followingPosts = filteredPosts.filter((p) => followingIds.has(p.author.userId));

  const t = isApp
    ? {
        page: "bg-[#070A08] text-white",
        muted: "text-white/55",
        faint: "text-white/35",
        card: "bg-white/[0.04] border-white/10",
        input: "bg-white/[0.06] border-white/10 text-white placeholder:text-white/40",
        tabIdle: "text-white/50 border-white/10",
        tabActive: "bg-white text-[#070A08] border-white",
        bar: "bg-[#070A08]/95 border-white/10",
        app: true,
      }
    : {
        page: "bg-white text-slate-900",
        muted: "text-slate-500",
        faint: "text-slate-400",
        card: "bg-white border-slate-200 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]",
        input: "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400",
        tabIdle: "text-slate-500 border-slate-200 hover:text-slate-900",
        tabActive: "bg-slate-900 text-white border-slate-900",
        bar: "bg-white/95 border-slate-200",
        app: false,
      };

  const loading = !posts || !creators;

  return (
    <div className={`min-h-full pb-28 font-wallet-body ${t.page}`} data-testid="creator-hub" data-app-view={isApp || undefined}>
      {/* Editorial header */}
      <header className="relative overflow-hidden">
        {!isApp && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-1.5">
            {ACCENTS.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
          </div>
        )}
        <div className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${isApp ? "pb-4 pt-5" : "pb-6 pt-8 md:pt-14"}`}>
          <p className={`font-wallet-display text-[10px] font-bold uppercase ${isApp ? "text-[#E5484D]" : "tracking-[0.32em]"}`} style={isApp ? undefined : { color: "#E5484D" }}>
            Oventric
          </p>
          <h1 className={`font-wallet-display font-extrabold leading-none ${isApp ? "mt-1 text-[25px]" : "mt-2 text-[44px] tracking-tight sm:text-[64px] lg:text-[84px]"}`}>
            CREATORS
          </h1>
          <p className={`font-wallet-display font-semibold ${isApp ? "mt-1 text-[13px] text-white/75" : "mt-3 text-[17px] sm:text-[22px]"}`}>
            Create. Share. Teach. Sell. Grow.
          </p>
          <p className={`max-w-2xl leading-relaxed ${isApp ? "mt-1.5 text-[11.5px]" : "mt-2 text-[14px] sm:text-[15px]"} ${t.muted}`}>
            Discover creators, learn new skills, find useful resources and explore digital work from the Oventric creator community.
          </p>
          <div className={`flex gap-2.5 sm:flex-row sm:items-center ${isApp ? "mt-3" : "mt-5 flex-col"}`}>
            <label className={`flex flex-1 items-center gap-2 rounded-[10px] border px-3 ${isApp ? "h-10" : "h-12 px-4"} ${t.input}`}>
              <Search className="h-4 w-4 shrink-0 opacity-60" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search creators, content & resources"
                aria-label="Search creators, content & resources"
                className={`h-full min-w-0 flex-1 bg-transparent outline-none ${isApp ? "text-[12px]" : "text-[14px]"}`}
              />
            </label>
            <button
              onClick={() => {
                haptic("medium");
                startCreate();
              }}
              className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] font-bold text-white ${isApp ? "h-10 w-10 px-0" : "h-12 px-5 text-[14px]"}`}
              aria-label="Creator's Hub"
            >
              <Plus className="h-4 w-4" /> <span className={isApp ? "sr-only" : undefined}>Creator's Hub</span>
            </button>
          </div>
        </div>
      </header>

      {/* Creator navigation */}
      <nav className={`app-scroll-header sticky top-0 z-20 border-b backdrop-blur ${t.bar}`} aria-label="Creator navigation">
        <div className={`mx-auto flex max-w-6xl overflow-x-auto px-4 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isApp ? "gap-1.5 py-2" : "gap-2 py-3"}`}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                haptic("select");
                setTab(key);
              }}
              aria-current={tab === key ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-bold transition-colors ${isApp ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-[13px]"} ${
                tab === key ? t.tabActive : t.tabIdle
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${isApp ? "space-y-6 pt-4" : "space-y-10 pt-6"}`}>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#E5484D" }} />
          </div>
        ) : tab === "home" ? (
          <>
            <Section title="Featured Creators" icon={Sparkles} accent={ACCENTS[2]} t={t}>
              <CreatorRail creators={filteredCreators.slice(0, 10)} t={t} empty="No featured creators yet." />
            </Section>
            <Section title="Trending Content" icon={Flame} accent={ACCENTS[4]} t={t}>
              <PostGrid posts={trending} t={t} onOpen={setOpenPost} empty="No creator content yet. Be the first to share your work." large />
            </Section>
            <Section title="Free Resources" icon={Download} accent={ACCENTS[0]} t={t}>
              <PostGrid posts={freeResources.slice(0, 8)} t={t} onOpen={setOpenPost} empty="No free resources shared yet." />
            </Section>
            <Section title="Rising Creators" icon={TrendingUp} accent={ACCENTS[3]} t={t}>
              <CreatorRail creators={rising} t={t} empty="No rising creators yet." />
            </Section>
          </>
        ) : tab === "discover" ? (
          <Section title="Discover" icon={Compass} accent={ACCENTS[1]} t={t}>
            <PostGrid posts={filteredPosts} t={t} onOpen={setOpenPost} empty="Nothing matches your search yet." />
          </Section>
        ) : tab === "following" ? (
          <Section title="From creators you follow" icon={UsersRound} accent={ACCENTS[2]} t={t}>
            {!isAuthenticated ? (
              <Empty t={t}>
                <button className="font-bold underline" onClick={() => openGate("generic")}>Sign in</button> to see work from creators you follow.
              </Empty>
            ) : !following ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin opacity-50" /></div>
            ) : (
              <PostGrid posts={followingPosts} t={t} onOpen={setOpenPost} empty="Creators you follow haven't shared work yet." />
            )}
          </Section>
        ) : tab === "resources" ? (
          <Section title="Resources" icon={BookOpen} accent={ACCENTS[0]} t={t}>
            <PostGrid posts={freeResources} t={t} onOpen={setOpenPost} empty="No free resources shared yet." />
          </Section>
        ) : (
          <Section title="Challenges" icon={Trophy} accent={ACCENTS[3]} t={t}>
            <Empty t={t}>Creator challenges are coming soon. Check back for themed briefs and community showcases.</Empty>
          </Section>
        )}
      </div>

      <CreatorPostSheet post={openPost} onClose={() => setOpenPost(null)} />
      <CreatorOnboardingModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onDone={() => {
          setOnboardOpen(false);
          setPublishOpen(true);
        }}
      />
      <CreatorPublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onPublished={() => void refetchPosts()}
      />
    </div>
  );
}

type Theme = { card: string; muted: string; faint: string; app: boolean };

function Section({
  title,
  icon: Icon,
  accent,
  t,
  children,
}: {
  title: string;
  icon: typeof Home;
  accent: string;
  t: Theme;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className={`flex items-center ${t.app ? "mb-3 gap-2" : "mb-4 gap-2.5"}`}>
        <span
          className={`grid place-items-center rounded-[10px] ${t.app ? "h-7 w-7 bg-[#E5484D]/12 text-[#E5484D]" : "h-8 w-8"}`}
          style={t.app ? undefined : { background: `${accent}1F`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h2 className={`font-wallet-display font-extrabold ${t.app ? "text-[15px]" : "text-[20px] tracking-tight sm:text-[24px]"}`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Empty({ t, children }: { t: Theme; children: React.ReactNode }) {
  return <div className={`rounded-[10px] border border-dashed px-6 py-10 text-center text-[14px] ${t.card} ${t.muted}`}>{children}</div>;
}

function CreatorRail({ creators, t, empty }: { creators: TopCreatorDTO[]; t: Theme; empty: string }) {
  if (creators.length === 0) return <Empty t={t}>{empty}</Empty>;
  return (
    <div className={`-mx-4 flex snap-x overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${t.app ? "gap-2" : "gap-3"}`}>
      {creators.map((c, i) => {
        const accent = t.app ? "#E5484D" : ACCENTS[i % ACCENTS.length];
        const inner = (
          <div className={`flex h-full shrink-0 snap-start flex-col items-center rounded-[10px] border text-center sm:w-auto ${t.app ? "w-[132px] p-3" : "w-[150px] p-4"} ${t.card}`}>
            <span className={`relative overflow-hidden rounded-full ${t.app ? "h-12 w-12 ring-1 ring-white/15" : "h-16 w-16"}`} style={t.app ? undefined : { boxShadow: `0 0 0 3px ${accent}` }}>
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className={`flex h-full w-full items-center justify-center font-bold text-white ${t.app ? "bg-white/10 text-[16px]" : "text-[20px]"}`} style={t.app ? undefined : { background: accent }}>
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <span className="mt-3 flex max-w-full items-center gap-1">
              <span className="truncate font-wallet-display text-[14px] font-bold">{c.name}</span>
              {c.verified && <BadgeCheck className={`h-3.5 w-3.5 shrink-0 ${t.app ? "text-[#E5484D]" : ""}`} style={t.app ? undefined : { color: accent }} />}
            </span>
            {c.fields[0] && <span className={`mt-0.5 truncate text-[11.5px] ${t.muted}`}>{c.fields[0]}</span>}
            <span className={`mt-2 text-[11px] ${t.faint}`}>
              {compact(c.followersCount)} followers · {c.postsCount} posts
            </span>
          </div>
        );
        return c.slug ? (
          <Link key={c.id} to="/profile/$id" params={{ id: c.slug }} className="shrink-0 sm:shrink">
            {inner}
          </Link>
        ) : (
          <div key={c.id} className="shrink-0 sm:shrink">{inner}</div>
        );
      })}
    </div>
  );
}

function PostGrid({
  posts,
  t,
  onOpen,
  empty,
  large,
}: {
  posts: CreatorPostDTO[];
  t: Theme;
  onOpen: (p: CreatorPostDTO) => void;
  empty: string;
  large?: boolean;
}) {
  if (posts.length === 0) return <Empty t={t}>{empty}</Empty>;
  return (
    <div className={`grid ${t.app ? "gap-2.5" : "gap-4"} ${large ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"}`}>
      {posts.map((p, i) => {
        const m = p.media[0];
        const thumb = m?.type === "video" ? (m.posterUrl ?? null) : (m?.url ?? null);
        const isVideo = m?.type === "video" || !!p.externalEmbedUrl;
        const featured = large && i === 0;
        return (
          <button
            key={p.id}
            onClick={() => {
              haptic("select");
              onOpen(p);
            }}
            className={`group overflow-hidden rounded-[10px] border text-left ${t.card} ${featured ? "sm:col-span-2 sm:row-span-2" : ""}`}
          >
            <div className={`relative w-full overflow-hidden bg-black/10 ${featured ? "aspect-[4/3]" : "aspect-[4/5]"}`}>
              {thumb ? (
                <img src={thumb} alt={p.title ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : m?.type === "video" ? (
                <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <div className={`flex h-full w-full items-center justify-center ${t.app ? "bg-white/[0.04]" : ""}`} style={t.app ? undefined : { background: `${ACCENTS[i % ACCENTS.length]}22` }}>
                  <Sparkles className={`h-8 w-8 ${t.app ? "text-[#E5484D]" : ""}`} style={t.app ? undefined : { color: ACCENTS[i % ACCENTS.length] }} />
                </div>
              )}
              {isVideo && (
                <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60">
                  <Play className="h-3.5 w-3.5 fill-current" style={{ color: "#ffffff" }} />
                </span>
              )}
              {p.asset?.available && p.asset.isFree && (
                <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.app ? "bg-black/60 text-white" : ""}`} style={t.app ? undefined : { background: "#16A34A", color: "#ffffff" }}>
                  FREE
                </span>
              )}
            </div>
            <div className={t.app ? "p-2.5" : "p-3"}>
              <p className={`line-clamp-2 font-wallet-display font-bold ${featured ? "text-[17px]" : "text-[13.5px]"}`}>
                {p.title || p.caption || "Untitled"}
              </p>
              <p className={`mt-1 truncate text-[11.5px] ${t.muted}`}>
                {p.author.name} · {compact(p.viewCount ?? 0)} views
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
