import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  BookOpen,
  Bot,
  Camera,
  Code2,
  Compass,
  Download,
  Eye,
  Film,
  Flame,
  GraduationCap,
  Home,
  Loader2,
  Megaphone,
  Music2,
  Package,
  Palette,
  PenLine,
  Play,
  Plus,
  Search,
  Sparkles,
  Trophy,
  TrendingUp,
  UsersRound,
  Wand2,
  Wrench,
  X,
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
import { FollowButton } from "@/components/oventric/FollowButton";
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

/** Tabs that own a shareable sub-URL. */
const TAB_PATHS: Partial<Record<HubTab, string>> = {
  home: "/creators",
  discover: "/creators/discover",
  following: "/creators/following",
};

/** Accent per section — Bright Spectrum (website only). */
const ACCENTS = ["#16A34A", "#2563EB", "#7C3AED", "#D97706", "#E5484D"];
const CRIMSON = "#E5484D";

/** Visual discovery categories, matched against real post/creator fields, tools and resource categories. */
const CATEGORIES: { key: string; icon: typeof Home; match: RegExp }[] = [
  { key: "Video", icon: Film, match: /video|film|youtube|reel|premiere|capcut|davinci|editor/ },
  { key: "Design", icon: Palette, match: /design|graphic|figma|canva|photoshop|illustrator|brand|ui|ux|logo/ },
  { key: "AI", icon: Bot, match: /\bai\b|midjourney|chatgpt|prompt|stable diffusion|gpt|runway/ },
  { key: "Photography", icon: Camera, match: /photo|lightroom|camera|portrait/ },
  { key: "Writing", icon: PenLine, match: /writ|copy|blog|article|ebook|script/ },
  { key: "Marketing", icon: Megaphone, match: /marketing|social media|\bads?\b|seo|growth|brand strateg/ },
  { key: "Education", icon: GraduationCap, match: /tutorial|course|learn|teach|education|guide|how to|lesson|tips/ },
  { key: "Development", icon: Code2, match: /develop|code|coding|\bweb\b|\bapp\b|react|javascript|python|software/ },
  { key: "Animation", icon: Wand2, match: /anim|motion|\b3d\b|after effects|blender|cinema 4d/ },
  { key: "Music", icon: Music2, match: /music|audio|beat|sound|fl studio|ableton|podcast/ },
  { key: "Digital Products", icon: Package, match: /template|preset|pack|asset|plugin|lut|font|mockup|digital product/ },
];

const LEARN_RE = /tutorial|course|learn|teach|guide|how to|lesson|tips|step by step|masterclass|explained|beginner/;

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const postText = (p: CreatorPostDTO) =>
  [p.title, p.caption, ...(p.fields ?? []), ...(p.author.tools ?? []), p.asset?.category ?? "", p.author.name]
    .join(" ")
    .toLowerCase();
const creatorText = (c: TopCreatorDTO) => [c.name, c.slug ?? "", ...c.fields, ...(c.tools ?? [])].join(" ").toLowerCase();
const isVideoPost = (p: CreatorPostDTO) => p.media[0]?.type === "video" || !!p.externalEmbedUrl;
const isFreeResource = (p: CreatorPostDTO) => !!p.asset?.available && p.asset.isFree;
const thumbOf = (p: CreatorPostDTO) => {
  const m = p.media[0];
  return m?.type === "video" ? (m.posterUrl ?? null) : (m?.url ?? null);
};

function tabFromPath(path: string): HubTab {
  if (path.startsWith("/creators/discover")) return "discover";
  if (path.startsWith("/creators/following")) return "following";
  return "home";
}

type DiscoverMode = "all" | "creators" | "content" | "resources" | "tools";

/**
 * Standalone Creator's Hub (/creators, /creators/discover, /creators/following).
 * Reuses creator_posts, profiles and the existing follow system — no parallel
 * social graph. Website renders white + Bright Spectrum; the app renders
 * compact dark + crimson.
 */
export function CreatorHubPage() {
  const isApp = useIsAppShell();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, openGate } = useAuthGate();
  const [tab, setTabState] = useState<HubTab>(() => tabFromPath(pathname));
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<DiscoverMode>("all");
  const [openPost, setOpenPost] = useState<CreatorPostDTO | null>(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  const fetchFeed = useServerFn(listCreatorFeed);
  const fetchTop = useServerFn(getTopCreators);
  const fetchFollowing = useServerFn(listFollowing);
  const loadProfile = useServerFn(getMyCreatorProfile);

  const setTab = (next: HubTab) => {
    setTabState(next);
    if (typeof window === "undefined") return;
    const path = TAB_PATHS[next] ?? "/creators";
    if (window.location.pathname !== path) window.history.replaceState({}, "", `${path}${window.location.search}`);
  };

  const { data: posts, refetch: refetchPosts } = useQuery({
    queryKey: ["creator-hub-posts"],
    queryFn: () => fetchFeed(),
    staleTime: 60_000,
  });
  const { data: creators } = useQuery({
    queryKey: ["creator-hub-creators", 60],
    queryFn: () => fetchTop({ data: { limit: 60 } }),
    staleTime: 120_000,
  });

  useEffect(() => {
    if (!isAuthenticated) return setMeId(null);
    void supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, [isAuthenticated]);

  const { data: following } = useQuery({
    queryKey: ["creator-hub-following", meId],
    queryFn: () => (meId ? fetchFollowing({ data: { userId: meId } }) : Promise.resolve([])),
    enabled: !!meId && tab === "following",
    staleTime: 60_000,
  });

  const startCreate = () => {
    if (!isAuthenticated) return openGate("generic");
    void loadProfile()
      .then((p) => (p.isCreator ? setPublishOpen(true) : setOnboardOpen(true)))
      .catch(() => setOnboardOpen(true));
  };

  useEffect(() => {
    const onCreate = (e: Event) => {
      if ((e as CustomEvent<{ kind?: string }>).detail?.kind === "creator") startCreate();
    };
    window.addEventListener("oventric:create", onCreate);
    return () => window.removeEventListener("oventric:create", onCreate);
  });

  // ---- Real-data filtering (search + category) ----
  const needle = q.trim().toLowerCase();
  const catRe = category ? CATEGORIES.find((c) => c.key === category)?.match : undefined;
  const matchPost = (p: CreatorPostDTO) => {
    const s = postText(p);
    if (needle && !s.includes(needle)) return false;
    if (catRe && !(catRe.test(s) || (category === "Digital Products" && !!p.asset?.available))) return false;
    return true;
  };
  const matchCreator = (c: TopCreatorDTO) => {
    const s = creatorText(c);
    if (needle && !s.includes(needle)) return false;
    if (catRe && !catRe.test(s)) return false;
    return true;
  };
  const filteredPosts = useMemo(() => (posts ?? []).filter(matchPost), [posts, needle, category]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredCreators = useMemo(() => (creators ?? []).filter(matchCreator), [creators, needle, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const featured = filteredCreators.slice(0, 8);
  const trending = useMemo(
    () =>
      [...filteredPosts]
        .sort((a, b) => Number(isVideoPost(b) || !!thumbOf(b)) - Number(isVideoPost(a) || !!thumbOf(a)) || b.viewCount - a.viewCount)
        .slice(0, 5),
    [filteredPosts],
  );
  const learn = useMemo(() => filteredPosts.filter((p) => LEARN_RE.test(postText(p))).slice(0, 8), [filteredPosts]);
  const freeResources = useMemo(() => filteredPosts.filter(isFreeResource), [filteredPosts]);
  // Rising: newest creators (by first published post) that already earned views.
  const featuredIds = new Set(featured.slice(0, 4).map((c) => c.id));
  const rising = useMemo(
    () =>
      [...filteredCreators]
        .filter((c) => c.postsCount > 0 && c.viewsCount > 0 && !featuredIds.has(c.id))
        .sort((a, b) => (b.firstPostAt ?? "").localeCompare(a.firstPostAt ?? ""))
        .slice(0, 8),
    [filteredCreators], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of CATEGORIES) {
      m.set(c.key, (posts ?? []).filter((p) => c.match.test(postText(p)) || (c.key === "Digital Products" && !!p.asset?.available)).length);
    }
    return m;
  }, [posts]);
  const allTools = useMemo(() => {
    const m = new Map<string, number>();
    (creators ?? []).forEach((c) => (c.tools ?? []).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    (posts ?? []).forEach((p) => (p.author.tools ?? []).forEach((t) => m.set(t, (m.get(t) ?? 0) + 0)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 24);
  }, [creators, posts]);

  const followedIds = useMemo(() => new Set((following ?? []).map((p) => p.userId)), [following]);
  const followedCreators = (creators ?? []).filter((c) => followedIds.has(c.id));
  const followingPosts = filteredPosts.filter((p) => followedIds.has(p.author.userId));

  const t: Theme = isApp
    ? {
        page: "bg-[#070A08] text-white",
        muted: "text-white/55",
        faint: "text-white/35",
        card: "bg-white/[0.04] border-white/10",
        input: "bg-white/[0.06] border-white/10 text-white placeholder:text-white/40",
        chipIdle: "text-white/60 border-white/10 bg-white/[0.03]",
        chipActive: "bg-white text-[#070A08] border-white",
        bar: "bg-[#070A08]/95 border-white/10",
        app: true,
      }
    : {
        page: "bg-white text-slate-900",
        muted: "text-slate-500",
        faint: "text-slate-400",
        card: "bg-white border-slate-200 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]",
        input: "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400",
        chipIdle: "text-slate-600 border-slate-200 bg-white hover:text-slate-900",
        chipActive: "bg-slate-900 text-white border-slate-900",
        bar: "bg-white/95 border-slate-200",
        app: false,
      };

  const loading = !posts || !creators;
  const filtering = !!needle || !!category;

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
          <p className={`font-wallet-display text-[10px] font-bold uppercase ${isApp ? "text-[#E5484D]" : "tracking-[0.32em]"}`} style={isApp ? undefined : { color: CRIMSON }}>
            Oventric
          </p>
          <h1 className={`font-wallet-display font-extrabold leading-none ${isApp ? "mt-1 text-[25px]" : "mt-2 text-[44px] tracking-tight sm:text-[64px] lg:text-[84px]"}`}>
            Creator's Hub
          </h1>
          <p className={`font-wallet-display font-semibold ${isApp ? "mt-1 text-[13px] text-white/75" : "mt-3 text-[17px] sm:text-[22px]"}`}>
            Create. Share. Teach. Sell. Grow.
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
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear search" className="opacity-60">
                  <X className="h-4 w-4" />
                </button>
              )}
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
                tab === key ? t.chipActive : t.chipIdle
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${isApp ? "space-y-7 pt-4" : "space-y-12 pt-7"}`}>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: CRIMSON }} />
          </div>
        ) : tab === "home" ? (
          <>
            {filtering && (
              <FilterNote t={t} q={q} category={category} onClear={() => { setQ(""); setCategory(null); }} />
            )}
            <Section title="Featured Creators" icon={Sparkles} accent={ACCENTS[2]} t={t} action={{ label: "Discover", onClick: () => { setMode("creators"); setTab("discover"); } }}>
              <FeaturedCreators creators={featured} t={t} meId={meId} empty="No featured creators yet." />
            </Section>
            <Section title="Trending" icon={Flame} accent={ACCENTS[4]} t={t}>
              <TrendingMosaic posts={trending} t={t} onOpen={setOpenPost} />
            </Section>
            <Section title="Watch & Learn" icon={GraduationCap} accent={ACCENTS[1]} t={t}>
              <ContentRail posts={learn} t={t} onOpen={setOpenPost} empty="No tutorials yet. Creators who teach will appear here." />
            </Section>
            <Section title="Free Resources" icon={Download} accent={ACCENTS[0]} t={t} action={freeResources.length > 4 ? { label: "See all", onClick: () => setTab("resources") } : undefined}>
              <ResourceGrid posts={freeResources.slice(0, isApp ? 4 : 6)} t={t} onOpen={setOpenPost} empty="No free resources shared yet." />
            </Section>
            <Section title="Rising Creators" icon={TrendingUp} accent={ACCENTS[3]} t={t}>
              <RisingList creators={rising} t={t} empty="No rising creators yet." />
            </Section>
            <Section title="Creator Categories" icon={Compass} accent={ACCENTS[2]} t={t}>
              <CategoryGrid
                t={t}
                counts={categoryCounts}
                active={category}
                onPick={(k) => {
                  haptic("select");
                  setCategory(k === category ? null : k);
                  setTab("discover");
                }}
              />
            </Section>
          </>
        ) : tab === "discover" ? (
          <DiscoverView
            t={t}
            mode={mode}
            setMode={setMode}
            category={category}
            setCategory={setCategory}
            q={q}
            setQ={setQ}
            posts={filteredPosts}
            creators={filteredCreators}
            resources={freeResources}
            tools={allTools}
            allCreators={creators ?? []}
            meId={meId}
            onOpen={setOpenPost}
          />
        ) : tab === "following" ? (
          !isAuthenticated ? (
            <Empty t={t}>
              <button className="font-bold underline" onClick={() => openGate("generic")}>Sign in</button> to see creators you follow and their latest work.
            </Empty>
          ) : !following ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin opacity-50" /></div>
          ) : (
            <>
              <Section title="Creators you follow" icon={UsersRound} accent={ACCENTS[2]} t={t}>
                {followedCreators.length === 0 ? (
                  <Empty t={t}>
                    You aren't following any creators yet.{" "}
                    <button className="font-bold underline" onClick={() => { setMode("creators"); setTab("discover"); }}>Discover creators</button>
                  </Empty>
                ) : (
                  <RisingList creators={followedCreators} t={t} empty="" />
                )}
              </Section>
              <Section title="Latest from creators you follow" icon={Flame} accent={ACCENTS[4]} t={t}>
                <ContentGrid posts={followingPosts} t={t} onOpen={setOpenPost} empty="Creators you follow haven't shared work yet." />
              </Section>
            </>
          )
        ) : tab === "resources" ? (
          <Section title="Free Resources" icon={Download} accent={ACCENTS[0]} t={t}>
            <ResourceGrid posts={freeResources} t={t} onOpen={setOpenPost} empty="No free resources shared yet." />
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
      <CreatorPublishModal open={publishOpen} onClose={() => setPublishOpen(false)} onPublished={() => void refetchPosts()} />
    </div>
  );
}

type Theme = {
  page: string;
  card: string;
  muted: string;
  faint: string;
  input: string;
  chipIdle: string;
  chipActive: string;
  bar: string;
  app: boolean;
};

function Section({
  title,
  icon: Icon,
  accent,
  t,
  action,
  children,
}: {
  title: string;
  icon: typeof Home;
  accent: string;
  t: Theme;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className={`flex items-center ${t.app ? "mb-3 gap-2" : "mb-5 gap-2.5"}`}>
        <span
          className={`grid place-items-center rounded-[10px] ${t.app ? "h-7 w-7 bg-[#E5484D]/12 text-[#E5484D]" : "h-8 w-8"}`}
          style={t.app ? undefined : { background: `${accent}1F`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h2 className={`font-wallet-display font-extrabold uppercase ${t.app ? "text-[13px] tracking-wide" : "text-[18px] tracking-[0.08em] sm:text-[22px]"}`}>{title}</h2>
        {action && (
          <button onClick={action.onClick} className={`ml-auto text-[12px] font-bold ${t.app ? "text-[#E5484D]" : t.muted}`}>
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ t, children }: { t: Theme; children: React.ReactNode }) {
  return <div className={`rounded-[10px] border border-dashed px-6 py-10 text-center text-[13.5px] ${t.card} ${t.muted}`}>{children}</div>;
}

function FilterNote({ t, q, category, onClear }: { t: Theme; q: string; category: string | null; onClear: () => void }) {
  return (
    <div className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[12px] ${t.card} ${t.muted}`}>
      Showing results for {q && <b className="font-bold">"{q}"</b>} {category && <b className="font-bold">{category}</b>}
      <button onClick={onClear} className="ml-auto font-bold underline">Clear</button>
    </div>
  );
}

function Avatar({ name, url, size, t, accent }: { name: string; url: string | null; size: string; t: Theme; accent?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full ${size} ${t.app ? "ring-1 ring-white/15" : ""}`} style={!t.app && accent ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}>
      {url ? (
        <img src={url} alt={name} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className={`flex h-full w-full items-center justify-center font-bold text-white ${t.app ? "bg-white/10" : ""}`} style={t.app ? undefined : { background: accent ?? CRIMSON }}>
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function ProfileLink({ slug, children, className }: { slug: string | null; children: React.ReactNode; className?: string }) {
  return slug ? (
    <Link to="/creators/$handle" params={{ handle: `@${slug}` }} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

/** Featured: compact horizontal rail on mobile, editorial grid with one lead card on desktop. */
function FeaturedCreators({ creators, t, meId, empty }: { creators: TopCreatorDTO[]; t: Theme; meId: string | null; empty: string }) {
  if (creators.length === 0) return <Empty t={t}>{empty}</Empty>;
  return (
    <div className={`-mx-4 flex snap-x overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${t.app ? "gap-2" : "gap-4"}`}>
      {creators.map((c, i) => {
        const accent = t.app ? CRIMSON : ACCENTS[i % ACCENTS.length];
        const lead = i === 0;
        return (
          <article
            key={c.id}
            className={`relative flex shrink-0 snap-start flex-col overflow-hidden rounded-[10px] border ${t.card} ${t.app ? "w-[168px] p-3" : "w-[210px] p-4 md:w-auto"} ${lead && !t.app ? "md:col-span-2 md:row-span-2 md:p-6" : ""}`}
          >
            {!t.app && <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />}
            <ProfileLink slug={c.slug} className="flex items-center gap-2.5">
              <Avatar name={c.name} url={c.avatarUrl} t={t} accent={accent} size={lead && !t.app ? "h-11 w-11 md:h-20 md:w-20" : t.app ? "h-10 w-10" : "h-11 w-11"} />
              <span className="min-w-0">
                <span className="flex items-center gap-1">
                  <span className={`truncate font-wallet-display font-bold ${lead && !t.app ? "text-[14px] md:text-[22px]" : "text-[13.5px]"}`}>{c.name}</span>
                  {c.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />}
                </span>
                {c.slug && <span className={`block truncate text-[11px] ${t.faint}`}>@{c.slug}</span>}
              </span>
            </ProfileLink>
            <p className={`mt-2.5 truncate text-[11.5px] font-semibold ${t.muted}`}>{c.fields[0] ?? "Creator"}</p>
            <div className="mt-1.5 flex min-h-[22px] flex-wrap gap-1">
              {(c.tools ?? []).slice(0, lead && !t.app ? 5 : 2).map((tool) => (
                <span key={tool} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${t.app ? "border-white/10 text-white/60" : "border-slate-200 text-slate-600"}`}>
                  <Wrench className="h-2.5 w-2.5" /> {tool}
                </span>
              ))}
            </div>
            <p className={`mt-2 text-[11px] ${t.faint}`}>
              <b className={t.app ? "text-white/80" : "text-slate-800"}>{compact(c.followersCount)}</b> followers · {c.postsCount} posts
            </p>
            <div className="mt-auto pt-3">
              {meId === c.id ? (
                <span className={`block rounded-[10px] border py-2 text-center text-[11px] font-bold ${t.app ? "border-white/10 text-white/50" : "border-slate-200 text-slate-500"}`}>You</span>
              ) : (
                <FollowButton targetId={c.id} compact className="w-full !px-3 !py-2 !text-[12px]" />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Thumb({ p, t, i, className }: { p: CreatorPostDTO; t: Theme; i: number; className?: string }) {
  const m = p.media[0];
  const thumb = thumbOf(p);
  return (
    <div className={`relative w-full overflow-hidden bg-black/20 ${className ?? ""}`}>
      {thumb ? (
        <img src={thumb} alt={p.title ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : m?.type === "video" ? (
        <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${t.app ? "bg-white/[0.04]" : ""}`} style={t.app ? undefined : { background: `${ACCENTS[i % ACCENTS.length]}22` }}>
          <Sparkles className="h-8 w-8" style={{ color: t.app ? CRIMSON : ACCENTS[i % ACCENTS.length] }} />
        </div>
      )}
      {isVideoPost(p) && (
        <span className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 backdrop-blur">
          <Play className="h-3.5 w-3.5 fill-current" style={{ color: "#ffffff" }} />
        </span>
      )}
      {isFreeResource(p) && (
        <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: t.app ? "rgba(0,0,0,0.6)" : "#16A34A", color: "#ffffff" }}>
          FREE
        </span>
      )}
    </div>
  );
}

function Byline({ p, t, big }: { p: CreatorPostDTO; t: Theme; big?: boolean }) {
  const tool = p.author.tools?.[0] ?? p.fields?.[0];
  return (
    <div className={`mt-1.5 flex items-center gap-1.5 ${big ? "text-[12.5px]" : "text-[11px]"} ${t.muted}`}>
      <Avatar name={p.author.name} url={p.author.avatarUrl} t={t} size={big ? "h-6 w-6" : "h-4 w-4"} />
      <span className="truncate font-semibold">{p.author.name}</span>
      {tool && <span className={`truncate ${t.faint}`}>· {tool}</span>}
      <span className={`ml-auto inline-flex shrink-0 items-center gap-0.5 ${t.faint}`}>
        <Eye className="h-3 w-3" /> {compact(p.viewCount)}
      </span>
    </div>
  );
}

/** Trending: hero + varied tiles on desktop; hero + swipeable portrait rail on mobile. */
function TrendingMosaic({ posts, t, onOpen }: { posts: CreatorPostDTO[]; t: Theme; onOpen: (p: CreatorPostDTO) => void }) {
  if (posts.length === 0) return <Empty t={t}>No creator content yet. Be the first to share your work.</Empty>;
  const [hero, ...rest] = posts;
  const open = (p: CreatorPostDTO) => {
    haptic("select");
    onOpen(p);
  };
  return (
    <div className={`grid md:grid-cols-12 ${t.app ? "gap-2.5" : "gap-4"}`}>
      <button onClick={() => open(hero)} className={`group relative overflow-hidden rounded-[10px] border text-left md:col-span-7 md:row-span-2 ${t.card}`}>
        <Thumb p={hero} t={t} i={0} className="aspect-[16/11] md:aspect-auto md:h-full md:min-h-[420px]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-16 md:p-6" style={{ color: "#ffffff" }}>
          <span className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: CRIMSON }}>
            <Flame className="h-3 w-3" /> Trending
          </span>
          <p className={`line-clamp-2 font-wallet-display font-extrabold ${t.app ? "text-[17px]" : "text-[20px] md:text-[28px]"}`}>{hero.title || hero.caption || "Untitled"}</p>
          <div className="mt-2 flex items-center gap-2 text-[12px] opacity-90">
            <Avatar name={hero.author.name} url={hero.author.avatarUrl} t={{ ...t, app: true }} size="h-6 w-6" />
            <span className="font-semibold">{hero.author.name}</span>
            {(hero.author.tools?.[0] ?? hero.fields?.[0]) && <span className="opacity-70">· {hero.author.tools?.[0] ?? hero.fields?.[0]}</span>}
            <span className="ml-auto inline-flex items-center gap-1 opacity-80"><Eye className="h-3.5 w-3.5" /> {compact(hero.viewCount)}</span>
          </div>
        </div>
      </button>
      {/* Desktop: two wide tiles beside hero, then a row */}
      <div className={`-mx-4 flex snap-x overflow-x-auto px-4 pb-1 md:col-span-5 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${t.app ? "gap-2" : "gap-4"}`}>
        {rest.map((p, i) => (
          <button
            key={p.id}
            onClick={() => open(p)}
            className={`group w-[150px] shrink-0 snap-start overflow-hidden rounded-[10px] border text-left md:w-auto ${t.card} ${i < 2 ? "md:col-span-2 md:flex md:items-stretch" : ""}`}
          >
            <Thumb p={p} t={t} i={i + 1} className={i < 2 ? "aspect-[3/4] md:aspect-auto md:w-[45%] md:shrink-0" : "aspect-[3/4] md:aspect-square"} />
            <div className={`min-w-0 flex-1 ${t.app ? "p-2" : "p-3"}`}>
              <p className={`line-clamp-2 font-wallet-display font-bold ${t.app ? "text-[12px]" : "text-[13.5px]"}`}>{p.title || p.caption || "Untitled"}</p>
              <Byline p={p} t={t} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ContentRail({ posts, t, onOpen, empty }: { posts: CreatorPostDTO[]; t: Theme; onOpen: (p: CreatorPostDTO) => void; empty: string }) {
  if (posts.length === 0) return <Empty t={t}>{empty}</Empty>;
  return (
    <div className={`-mx-4 flex snap-x overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${t.app ? "gap-2.5" : "gap-4"}`}>
      {posts.map((p, i) => (
        <button
          key={p.id}
          onClick={() => {
            haptic("select");
            onOpen(p);
          }}
          className={`group shrink-0 snap-start overflow-hidden rounded-[10px] border text-left ${t.card} ${t.app ? "w-[230px]" : "w-[300px]"}`}
        >
          <Thumb p={p} t={t} i={i} className="aspect-video" />
          <div className={t.app ? "p-2.5" : "p-3"}>
            <p className={`line-clamp-2 font-wallet-display font-bold ${t.app ? "text-[12.5px]" : "text-[14px]"}`}>{p.title || p.caption || "Untitled"}</p>
            <Byline p={p} t={t} />
          </div>
        </button>
      ))}
    </div>
  );
}

function ContentGrid({ posts, t, onOpen, empty }: { posts: CreatorPostDTO[]; t: Theme; onOpen: (p: CreatorPostDTO) => void; empty: string }) {
  if (posts.length === 0) return <Empty t={t}>{empty}</Empty>;
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 ${t.app ? "gap-2.5" : "gap-4"}`}>
      {posts.map((p, i) => (
        <button
          key={p.id}
          onClick={() => {
            haptic("select");
            onOpen(p);
          }}
          className={`group overflow-hidden rounded-[10px] border text-left ${t.card}`}
        >
          <Thumb p={p} t={t} i={i} className="aspect-[4/5]" />
          <div className={t.app ? "p-2" : "p-3"}>
            <p className={`line-clamp-2 font-wallet-display font-bold ${t.app ? "text-[12px]" : "text-[13.5px]"}`}>{p.title || p.caption || "Untitled"}</p>
            <Byline p={p} t={t} />
          </div>
        </button>
      ))}
    </div>
  );
}

function ResourceGrid({ posts, t, onOpen, empty }: { posts: CreatorPostDTO[]; t: Theme; onOpen: (p: CreatorPostDTO) => void; empty: string }) {
  if (posts.length === 0) return <Empty t={t}>{empty}</Empty>;
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${t.app ? "gap-2" : "gap-4"}`}>
      {posts.map((p, i) => {
        const type = p.asset?.category || p.fields?.[0] || "Resource";
        return (
          <article key={p.id} className={`flex items-center gap-3 overflow-hidden rounded-[10px] border ${t.card} ${t.app ? "p-2" : "p-3"}`}>
            <Thumb p={p} t={t} i={i} className={`!w-auto shrink-0 rounded-[8px] ${t.app ? "h-16 w-16 aspect-square" : "h-20 w-20 aspect-square"}`} />
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[11px] font-semibold ${t.muted}`}>{p.author.name}</p>
              <p className={`line-clamp-1 font-wallet-display font-bold ${t.app ? "text-[13px]" : "text-[14.5px]"}`}>{p.title || "Untitled resource"}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-bold">
                <span className={`rounded-full border px-2 py-0.5 ${t.app ? "border-white/10 text-white/60" : "border-slate-200 text-slate-600"}`}>{type}</span>
                <span className="rounded-full px-2 py-0.5" style={{ background: t.app ? "rgba(229,72,77,0.14)" : "#16A34A1F", color: t.app ? CRIMSON : "#16A34A" }}>Free</span>
              </div>
            </div>
            <button
              onClick={() => {
                haptic("select");
                onOpen(p);
              }}
              className={`inline-flex shrink-0 items-center gap-1 rounded-[10px] font-bold text-white ${t.app ? "px-2.5 py-2 text-[11px]" : "px-3 py-2 text-[12px]"}`}
              style={{ background: t.app ? CRIMSON : "#16A34A" }}
            >
              <Download className="h-3.5 w-3.5" /> Get Resource
            </button>
          </article>
        );
      })}
    </div>
  );
}

function RisingList({ creators, t, empty }: { creators: TopCreatorDTO[]; t: Theme; empty: string }) {
  if (creators.length === 0) return <Empty t={t}>{empty}</Empty>;
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${t.app ? "gap-2" : "gap-3"}`}>
      {creators.map((c, i) => (
        <ProfileLink key={c.id} slug={c.slug} className={`flex items-center gap-3 rounded-[10px] border ${t.card} ${t.app ? "p-2.5" : "p-3"}`}>
          <span className={`w-5 text-center font-wallet-display text-[13px] font-extrabold ${t.faint}`}>{i + 1}</span>
          <Avatar name={c.name} url={c.avatarUrl} t={t} size="h-10 w-10" accent={ACCENTS[i % ACCENTS.length]} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1">
              <span className="truncate font-wallet-display text-[13.5px] font-bold">{c.name}</span>
              {c.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: t.app ? CRIMSON : ACCENTS[i % ACCENTS.length] }} />}
            </span>
            <span className={`block truncate text-[11px] ${t.muted}`}>{c.fields[0] ?? "Creator"} · {compact(c.viewsCount)} views</span>
          </span>
        </ProfileLink>
      ))}
    </div>
  );
}

function CategoryGrid({ t, counts, active, onPick }: { t: Theme; counts: Map<string, number>; active: string | null; onPick: (k: string) => void }) {
  return (
    <div className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 ${t.app ? "gap-2" : "gap-3"}`}>
      {CATEGORIES.map(({ key, icon: Icon }, i) => {
        const accent = t.app ? CRIMSON : ACCENTS[i % ACCENTS.length];
        const on = active === key;
        return (
          <button
            key={key}
            onClick={() => onPick(key)}
            aria-pressed={on}
            className={`flex flex-col items-start rounded-[10px] border text-left transition-colors ${t.card} ${t.app ? "p-2.5" : "p-4"} ${on ? (t.app ? "!border-[#E5484D]" : "!border-slate-900") : ""}`}
          >
            <span className={`grid place-items-center rounded-[10px] ${t.app ? "h-8 w-8" : "h-10 w-10"}`} style={{ background: `${accent}1F`, color: accent }}>
              <Icon className="h-4 w-4" />
            </span>
            <span className={`mt-2 font-wallet-display font-bold leading-tight ${t.app ? "text-[11.5px]" : "text-[13.5px]"}`}>{key}</span>
            <span className={`text-[10.5px] ${t.faint}`}>{counts.get(key) ?? 0} posts</span>
          </button>
        );
      })}
    </div>
  );
}

function DiscoverView({
  t,
  mode,
  setMode,
  category,
  setCategory,
  q,
  setQ,
  posts,
  creators,
  resources,
  tools,
  allCreators,
  meId,
  onOpen,
}: {
  t: Theme;
  mode: DiscoverMode;
  setMode: (m: DiscoverMode) => void;
  category: string | null;
  setCategory: (c: string | null) => void;
  q: string;
  setQ: (s: string) => void;
  posts: CreatorPostDTO[];
  creators: TopCreatorDTO[];
  resources: CreatorPostDTO[];
  tools: string[];
  allCreators: TopCreatorDTO[];
  meId: string | null;
  onOpen: (p: CreatorPostDTO) => void;
}) {
  const MODES: { key: DiscoverMode; label: string; n?: number }[] = [
    { key: "all", label: "All" },
    { key: "creators", label: "Creators", n: creators.length },
    { key: "content", label: "Content", n: posts.length },
    { key: "resources", label: "Resources", n: resources.length },
    { key: "tools", label: "Tools", n: tools.length },
  ];
  const chip = (on: boolean) => `inline-flex shrink-0 items-center gap-1 rounded-full border font-bold ${t.app ? "px-3 py-1.5 text-[11px]" : "px-3.5 py-1.5 text-[12.5px]"} ${on ? t.chipActive : t.chipIdle}`;
  const toolCreators = (tool: string) => allCreators.filter((c) => (c.tools ?? []).includes(tool)).length;
  return (
    <div className={t.app ? "space-y-5" : "space-y-8"}>
      <div className="space-y-2.5">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0">
          {MODES.map((m) => (
            <button key={m.key} onClick={() => setMode(m.key)} className={chip(mode === m.key)} aria-pressed={mode === m.key}>
              {m.label}
              {m.n !== undefined && <span className="opacity-60">{m.n}</span>}
            </button>
          ))}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0">
          <button onClick={() => setCategory(null)} className={chip(!category)}>All categories</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key === category ? null : c.key)} className={chip(category === c.key)}>
              <c.icon className="h-3.5 w-3.5" /> {c.key}
            </button>
          ))}
        </div>
      </div>

      {(mode === "all" || mode === "creators") && (
        <Section title="Creators" icon={UsersRound} accent={ACCENTS[2]} t={t}>
          <FeaturedCreators creators={mode === "all" ? creators.slice(0, 8) : creators} t={t} meId={meId} empty="No creators match yet." />
        </Section>
      )}
      {(mode === "all" || mode === "content") && (
        <Section title="Content" icon={Flame} accent={ACCENTS[4]} t={t}>
          <ContentGrid posts={mode === "all" ? posts.slice(0, 8) : posts} t={t} onOpen={onOpen} empty="No content matches yet." />
        </Section>
      )}
      {(mode === "all" || mode === "resources") && (
        <Section title="Resources" icon={Download} accent={ACCENTS[0]} t={t}>
          <ResourceGrid posts={mode === "all" ? resources.slice(0, 6) : resources} t={t} onOpen={onOpen} empty="No free resources match yet." />
        </Section>
      )}
      {(mode === "all" || mode === "tools") && (
        <Section title="Tools" icon={Wrench} accent={ACCENTS[3]} t={t}>
          {tools.length === 0 ? (
            <Empty t={t}>Creators haven't listed their tools yet.</Empty>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tools.map((tool) => (
                <button
                  key={tool}
                  onClick={() => {
                    setQ(q.toLowerCase() === tool.toLowerCase() ? "" : tool);
                    setMode("all");
                  }}
                  className={chip(q.toLowerCase() === tool.toLowerCase())}
                >
                  <Wrench className="h-3 w-3" /> {tool} <span className="opacity-60">{toolCreators(tool)}</span>
                </button>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
