import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Plus,
  Users,
  Flame,
  Search,
  Lock,
  Globe2,
  Target,
  X,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  Trophy,
  Link2,
  Pin,
  Trash2,
  Check,
  UserPlus,
  Send,
} from "lucide-react";
import {
  getCircleCatalog,
  getCircleBySlug,
  createCircle,
  requestJoinCircle,
  cancelJoinRequest,
  leaveCircle,
  submitCircleCoc,
  listCirclePosts,
  createCirclePost,
  listCircleMembers,
  listCircleResources,
  addCircleResource,
  removeCircleResource,
  listCircleBounties,
  listCircleCategories,
  type CircleSummary,
} from "@/lib/circles-groups.functions";
import { FollowButton } from "@/components/oventric/FollowButton";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { supabase } from "@/integrations/supabase/client";
import { CommentsSheet } from "@/components/oventric/feed/CommentsSheet";
import {
  ReactionPicker,
  REACTION_META,
  ReactionGlyph,
  isImageReaction,
} from "@/components/oventric/feed/Reactions";
import { setReaction as setReactionFn, type ReactionType } from "@/lib/posts.functions";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { WebCircles } from "@/components/oventric/desktop/WebCircles";

const DEFAULT_CATEGORIES = [
  "SaaS Builders",
  "AI Engineering",
  "Design Systems",
  "Web3/Crypto",
  "Mobile Apps",
  "Infra & DevOps",
  "Community",
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtPeers(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

/* ============================ Root ============================ */

export function CirclesHub() {
  const isAppShell = useIsAppShell();
  const { isAuthenticated, openGate } = useAuthGate();

  const catalogFn = useServerFn(getCircleCatalog);
  const catalogQ = useQuery({
    queryKey: ["circle-catalog"],
    queryFn: () => catalogFn(),
    enabled: isAuthenticated,
  });

  const [activeCategory, setActiveCategory] = useState<string>("All");

  const catsQ = useQuery({
    queryKey: ["circle-categories"],
    queryFn: () => listCircleCategories(),
  });
  const categoryOptions = useMemo(() => {
    const names = (catsQ.data ?? []).map((c) => c.name);
    return ["All", ...(names.length > 0 ? names : DEFAULT_CATEGORIES)];
  }, [catsQ.data]);

  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [forgeOpen, setForgeOpen] = useState(false);

  // Open from deep-link ?circle=slug
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const c = u.searchParams.get("circle");
    if (c) setOpenSlug(c);
    const onOpenSlug = (e: Event) => {
      const detail = (e as CustomEvent<{ slug?: string }>).detail;
      if (detail?.slug) setOpenSlug(detail.slug);
    };
    window.addEventListener("oventric:circle:open-slug", onOpenSlug);
    return () => window.removeEventListener("oventric:circle:open-slug", onOpenSlug);
  }, []);

  const catalog = catalogQ.data;
  const filtered = useMemo(() => {
    const all = catalog?.all ?? [];
    return all.filter((c) => {
      const catOk = activeCategory === "All" || c.category === activeCategory;
      const q = query.trim().toLowerCase();
      const qOk =
        !q || c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [catalog, activeCategory, query]);

  if (!isAppShell && !openSlug) {
    return <WebCircles onOpen={(slug) => setOpenSlug(slug)} />;
  }

  if (openSlug) {
    return <CircleWorkspace slug={openSlug} onBack={() => setOpenSlug(null)} />;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-3">🛡️</div>
        <h1 className="text-2xl font-black text-white md:text-slate-900">Circles & Guilds</h1>
        <p className="text-slate-400 mt-2 md:text-slate-600">
          Sign in to discover and join real builder guilds.
        </p>
        <button
          onClick={() => openGate("generic")}
          className="mt-4 px-4 py-3 rounded-[10px] bg-emerald-500 text-black font-bold text-sm"
        >
          Sign in to continue
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6 md:bg-white md:min-h-screen">
      {/* Header row */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black text-white truncate md:text-slate-900">
            🛡️ Circles & Guilds
          </h1>
          <p className="text-sm text-slate-400 mt-1 md:text-slate-600">
            Find your crew. Build together. Split the bag.
          </p>
        </div>
        <button
          onClick={() => setForgeOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Forge New Circle</span>
          <span className="sm:hidden">Forge</span>
        </button>
      </div>

      {/* My Circles */}
      {catalog && catalog.mine.length > 0 && (
        <Rail
          title="Your Circles"
          icon={<Users className="w-4 h-4 text-emerald-300" />}
          items={catalog.mine}
          onOpen={(c) => setOpenSlug(c.slug)}
        />
      )}

      {/* Trending */}
      <Rail
        title="Trending Circles"
        icon={<Flame className="w-4 h-4 text-orange-400" />}
        items={catalog?.trending ?? []}
        onOpen={(c) => setOpenSlug(c.slug)}
      />

      {/* Most Active */}
      <Rail
        title="Most Active"
        icon={<MessageCircle className="w-4 h-4 text-sky-400" />}
        items={catalog?.mostActive ?? []}
        onOpen={(c) => setOpenSlug(c.slug)}
      />

      {/* Top Earners */}
      <Rail
        title="Top-Earning Guilds"
        icon={<Trophy className="w-4 h-4 text-yellow-400" />}
        items={catalog?.topEarners ?? []}
        onOpen={(c) => setOpenSlug(c.slug)}
      />

      {/* Search + Category Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-5 mt-8">
        <div className="relative sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guilds…"
            className="w-full bg-[#1E1E24] border border-white/10 rounded-[10px] pl-9 pr-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 md:bg-white md:shadow-sm md:border-slate-200 md:text-slate-900"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none min-w-0">
          {categoryOptions.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                    : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white hover:border-white/20 md:bg-white md:shadow-sm md:border-slate-200 md:hover:border-slate-300 md:hover:text-slate-900 md:text-slate-600"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {catalogQ.isLoading ? (
        <div className="text-center text-slate-500 py-8 text-sm md:text-slate-500">
          Loading circles…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-500 py-12 text-sm md:text-slate-500">
          No circles yet. Be the first to forge one for your niche.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CircleCard key={c.id} circle={c} onOpen={() => setOpenSlug(c.slug)} />
          ))}
        </div>
      )}

      {forgeOpen && (
        <ForgeCircleModal
          onClose={() => setForgeOpen(false)}
          onCreated={(slug) => {
            setForgeOpen(false);
            setOpenSlug(slug);
          }}
        />
      )}
    </div>
  );
}

/* ============================ Cards / Rails ============================ */

function Rail({
  title,
  icon,
  items,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  items: CircleSummary[];
  onOpen: (c: CircleSummary) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-lg font-black text-white md:text-slate-900">{title}</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto snap-x scrollbar-none pb-3 -mx-1 px-1">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => onOpen(c)}
            className="snap-start shrink-0 w-64 text-left bg-[#1E1E24] border border-white/10 hover:border-emerald-500/40 rounded-xl overflow-hidden transition-colors md:bg-white md:shadow-sm md:border-slate-200"
          >
            <div
              className={`h-16 relative overflow-hidden ${c.coverUrl ? "" : `bg-gradient-to-br ${c.bannerHue}`}`}
            >
              {c.coverUrl && (
                <img loading="lazy"
                  src={c.coverUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  decoding="async"
                />
              )}
              <div className="absolute bottom-0 left-3 translate-y-1/2 w-10 h-10 rounded-full bg-[#121214] md:bg-white border-2 border-[#1E1E24] md:border-white flex items-center justify-center text-lg overflow-hidden">
                {c.avatarUrl ? (
                  <img loading="lazy"
                    src={c.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    decoding="async"
                  />
                ) : (
                  <span>{c.emoji}</span>
                )}
              </div>
              {c.isPrivate && (
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 border border-white/20 text-[10px] font-bold text-white">
                  <Lock className="w-3 h-3" /> Private
                </span>
              )}
            </div>
            <div className="pt-6 pb-3 px-3">
              <div className="text-white font-bold text-sm truncate md:text-slate-900">
                {c.name}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider md:text-slate-500">
                {c.category}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-slate-400 md:text-slate-600">
                <Users className="w-3 h-3" /> {fmtPeers(c.memberCount)} members
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function CircleCard({ circle, onOpen }: { circle: CircleSummary; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left bg-[#1E1E24] border border-white/10 hover:border-emerald-500/40 rounded-xl overflow-hidden transition-colors md:bg-white md:shadow-sm md:border-slate-200"
    >
      <div
        className={`h-20 relative overflow-hidden ${circle.coverUrl ? "" : `bg-gradient-to-br ${circle.bannerHue}`}`}
      >
        {circle.coverUrl && (
          <img loading="lazy"
            src={circle.coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            decoding="async"
          />
        )}
        <div className="absolute bottom-0 left-4 translate-y-1/2 w-12 h-12 rounded-full bg-[#121214] md:bg-white border-2 border-[#1E1E24] md:border-white flex items-center justify-center text-xl overflow-hidden">
          {circle.avatarUrl ? (
            <img loading="lazy"
              src={circle.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              decoding="async"
            />
          ) : (
            <span>{circle.emoji}</span>
          )}
        </div>
        {circle.isPrivate && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 border border-white/20 text-[10px] font-bold text-white">
            <Lock className="w-3 h-3" /> Private
          </span>
        )}
      </div>
      <div className="pt-7 pb-4 px-4">
        <div className="text-white font-bold text-base truncate md:text-slate-900">
          {circle.name}
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 md:text-slate-500">
          {circle.category}
        </div>
        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] md:text-slate-600">
          {circle.description || "A guild forged by builders."}
        </p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 md:border-slate-200">
          <div className="flex items-center gap-1 text-xs text-slate-400 md:text-slate-600">
            <Users className="w-3 h-3" /> {fmtPeers(circle.memberCount)}
          </div>
          <div className="text-[11px] font-semibold text-emerald-300">
            {circle.myStatus === "member"
              ? "Joined"
              : circle.myStatus === "awaiting_coc"
                ? "Accept CoC"
                : circle.myStatus === "pending"
                  ? "Pending"
                  : "View"}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ============================ Workspace ============================ */

type Tab = "watercooler" | "members" | "bounties" | "resources";

function CircleWorkspace({ slug, onBack }: { slug: string; onBack: () => void }) {
  const qc = useQueryClient();
  const getCircle = useServerFn(getCircleBySlug);
  const circleQ = useQuery({
    queryKey: ["circle", slug],
    queryFn: () => getCircle({ data: { slug } }),
  });
  const circle = circleQ.data;

  const [tab, setTab] = useState<Tab>("watercooler");
  const [cocOpen, setCocOpen] = useState(false);

  useEffect(() => {
    if (circle && circle.myStatus === "awaiting_coc") setCocOpen(true);
  }, [circle]);

  const requestFn = useServerFn(requestJoinCircle);
  const cancelFn = useServerFn(cancelJoinRequest);
  const leaveFn = useServerFn(leaveCircle);

  const joinM = useMutation({
    mutationFn: (id: string) => requestFn({ data: { circleId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circle", slug] });
      qc.invalidateQueries({ queryKey: ["circle-catalog"] });
    },
  });
  const cancelM = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { circleId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circle", slug] }),
  });
  const leaveM = useMutation({
    mutationFn: (id: string) => leaveFn({ data: { circleId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circle", slug] }),
  });

  if (circleQ.isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm md:text-slate-500">
        Loading circle…
      </div>
    );
  }
  if (!circle) {
    return (
      <div className="p-8 text-center">
        <button onClick={onBack} className="text-emerald-400 text-sm">
          ← Back
        </button>
        <p className="text-slate-400 mt-4 md:text-slate-600">This circle no longer exists.</p>
      </div>
    );
  }

  const isMember = circle.myStatus === "member";

  return (
    <div className="max-w-6xl mx-auto w-full md:bg-white md:min-h-screen">
      {/* Banner */}
      <div
        className={`h-40 md:h-48 relative overflow-hidden ${circle.coverUrl ? "" : `bg-gradient-to-br ${circle.bannerHue}`}`}
      >
        {circle.coverUrl && (
          <img
            src={circle.coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        )}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-black/40 hover:bg-black/60 text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {circle.isPrivate && (
          <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 border border-white/20 text-xs font-bold text-white">
            <Lock className="w-3 h-3" /> Private
          </span>
        )}
      </div>

      <div className="px-4 md:px-6 -mt-10 relative">
        <div className="flex items-end gap-4">
          <div
            className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-[#121214] md:border-white shrink-0 overflow-hidden flex items-center justify-center text-3xl md:text-4xl ${circle.avatarUrl ? "bg-neutral-900" : `bg-gradient-to-br ${circle.avatarHue}`}`}
          >
            {circle.avatarUrl ? (
              <img
                src={circle.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              <span>{circle.emoji}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-2">
            <h2 className="text-xl md:text-2xl font-black text-white truncate md:text-slate-900">
              {circle.name}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap md:text-slate-600">
              <span className="uppercase tracking-wider font-bold">{circle.category}</span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" /> {fmtPeers(circle.memberCount)} members
              </span>
              {circle.isPrivate ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Private
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Globe2 className="w-3 h-3" /> Public
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-300 mt-4 md:text-slate-600">
          {circle.description || "A guild for builders."}
        </p>

        {/* Join / status / leave */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {circle.myStatus === "none" && (
            <button
              onClick={() => joinM.mutate(circle.id)}
              disabled={joinM.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm"
            >
              <UserPlus className="w-4 h-4" /> Request to Join
            </button>
          )}
          {circle.myStatus === "pending" && (
            <>
              <span className="px-3 py-3 rounded-[10px] bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold">
                Request pending admin approval
              </span>
              <button
                onClick={() => cancelM.mutate(circle.id)}
                className="px-3 py-3 rounded-[10px] bg-[#1E1E24] border border-white/10 text-slate-300 text-xs md:bg-white md:shadow-sm md:border-slate-200 md:text-slate-600"
              >
                Cancel request
              </button>
            </>
          )}
          {circle.myStatus === "awaiting_coc" && (
            <button
              onClick={() => setCocOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm"
            >
              <ShieldCheck className="w-4 h-4" /> Accept Code of Conduct
            </button>
          )}
          {isMember && circle.ownerId !== undefined && (
            <>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                <Check className="w-3 h-3" /> Member
              </span>
              {circle.myRole !== "owner" && (
                <button
                  onClick={() => leaveM.mutate(circle.id)}
                  className="px-3 py-1.5 rounded-[10px] bg-[#1E1E24] border border-white/10 text-slate-300 text-xs md:bg-white md:shadow-sm md:border-slate-200 md:text-slate-600"
                >
                  Leave
                </button>
              )}
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-6 border-b border-white/10 flex gap-4 overflow-x-auto md:border-slate-200">
          {(
            [
              ["watercooler", "Water Cooler"],
              ["members", "Members"],
              ["bounties", "Bounty Vault"],
              ["resources", "Resources"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 pb-2 -mb-px text-sm font-bold border-b-2 ${
                tab === id
                  ? "border-emerald-500 text-white md:text-slate-900"
                  : "border-transparent text-slate-400 hover:text-white md:hover:text-slate-900 md:text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="py-5">
          {tab === "watercooler" && <WatercoolerTab circle={circle} isMember={isMember} />}
          {tab === "members" && <MembersTab circle={circle} />}
          {tab === "bounties" && <BountiesTab circle={circle} />}
          {tab === "resources" && <ResourcesTab circle={circle} isMember={isMember} />}
        </div>
      </div>

      {cocOpen && (
        <CoCAcceptModal
          circle={circle}
          onClose={() => setCocOpen(false)}
          onDone={() => {
            setCocOpen(false);
            qc.invalidateQueries({ queryKey: ["circle", slug] });
            qc.invalidateQueries({ queryKey: ["circle-catalog"] });
          }}
        />
      )}
    </div>
  );
}

/* ---- Tab: Watercooler ---- */
function WatercoolerTab({ circle, isMember }: { circle: CircleSummary; isMember: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCirclePosts);
  const createFn = useServerFn(createCirclePost);
  const postsQ = useQuery({
    queryKey: ["circle-posts", circle.id],
    queryFn: () => listFn({ data: { circleId: circle.id } }),
    enabled: isMember,
  });
  const [text, setText] = useState("");
  const [openComments, setOpenComments] = useState<{ id: string; author: string } | null>(null);
  const [lastShared, setLastShared] = useState<boolean | null>(null);
  const postM = useMutation({
    mutationFn: () => createFn({ data: { circleId: circle.id, text } }),
    onSuccess: (res) => {
      setText("");
      setLastShared(!!res?.sharedToFeed);
      qc.invalidateQueries({ queryKey: ["circle-posts", circle.id] });
    },
  });

  if (!isMember) {
    return (
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-6 text-center md:bg-white md:shadow-sm md:border-slate-200">
        <Lock className="w-6 h-6 text-slate-500 mx-auto mb-2 md:text-slate-500" />
        <p className="text-sm text-slate-300 font-semibold md:text-slate-600">
          Members-only conversation
        </p>
        <p className="text-xs text-slate-500 mt-1 md:text-slate-500">
          Request to join. Once an admin approves, accept the code of conduct to unlock posting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-3 md:bg-white md:shadow-sm md:border-slate-200">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          placeholder="Share with the circle…"
          className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none resize-none min-h-[60px] md:text-slate-900"
        />
        <div className="flex items-center justify-between pt-2 border-t border-white/5 md:border-slate-200">
          <span className="text-[11px] text-slate-500 md:text-slate-500">
            Every 5th post here also appears in the public news feed as a taster for non‑members.
          </span>
          <button
            onClick={() => postM.mutate()}
            disabled={!text.trim() || postM.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-xs"
          >
            <Send className="w-3.5 h-3.5" /> Post
          </button>
        </div>
        {lastShared !== null && (
          <div
            className={`mt-2 text-[11px] ${lastShared ? "text-emerald-300" : "text-slate-500 md:text-slate-500"}`}
          >
            {lastShared
              ? "🎉 This post was also shared to the main news feed."
              : "Posted to the circle. Only members can see it."}
          </div>
        )}
      </div>

      {postsQ.isLoading ? (
        <div className="text-center text-slate-500 text-sm py-6 md:text-slate-500">Loading…</div>
      ) : (postsQ.data ?? []).length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8 md:text-slate-500">
          Be the first to say hi to the circle.
        </div>
      ) : (
        <div className="space-y-3">
          {postsQ.data!.map((p) => (
            <WatercoolerPost
              key={p.id}
              p={p}
              onOpenComments={() => setOpenComments({ id: p.id, author: p.authorName })}
            />
          ))}
        </div>
      )}

      {openComments && (
        <CommentsSheet
          postId={openComments.id}
          postAuthorName={openComments.author}
          onClose={() => setOpenComments(null)}
        />
      )}
    </div>
  );
}

function WatercoolerPost({
  p,
  onOpenComments,
}: {
  p: import("@/lib/circles-groups.functions").CirclePostRow;
  onOpenComments: () => void;
}) {
  const setReactionM = useServerFn(setReactionFn);
  const [viewerReaction, setViewerReaction] = useState<ReactionType | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [totals, setTotals] = useState<Record<ReactionType, number>>({
    love: 0,
    like: 0,
    dislike: 0,
    laugh: 0,
    crown: 0,
  });

  const react = async (r: ReactionType | null) => {
    const prev = viewerReaction;
    setViewerReaction(r);
    setTotals((t) => {
      const next = { ...t };
      if (prev) next[prev] = Math.max(0, next[prev] - 1);
      if (r) next[r] = (next[r] ?? 0) + 1;
      return next;
    });
    setPickerOpen(false);
    try {
      await setReactionM({ data: { postId: p.id, reaction: r } });
    } catch {
      setViewerReaction(prev);
    }
  };

  const total = totals.love + totals.like + totals.laugh + totals.crown;

  const activeColor = viewerReaction ? REACTION_META[viewerReaction].color : undefined;

  return (
    <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-3 md:bg-white md:shadow-sm md:border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        {p.authorAvatar ? (
          <ResponsiveImage
            sizes="32px"
            src={p.authorAvatar}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 text-xs font-bold">
            {p.authorName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <button
          onClick={() =>
            (window.location.href = p.authorSlug
              ? `/profile/${p.authorSlug}`
              : `/profile/${p.authorId}`)
          }
          className="text-sm font-semibold text-white hover:text-emerald-300 md:text-slate-900"
        >
          {p.authorName}
        </button>
        <span className="text-xs text-slate-500 md:text-slate-500">· {timeAgo(p.createdAt)}</span>
      </div>
      <p className="text-sm text-slate-200 whitespace-pre-wrap">{p.text}</p>
      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-white/5 relative md:border-slate-200">
        <button
          type="button"
          onClick={() => (viewerReaction ? react(null) : setPickerOpen((v) => !v))}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-slate-300 md:hover:bg-slate-100 md:bg-slate-50 md:text-slate-600"
          style={activeColor ? { color: activeColor } : undefined}
        >
          {viewerReaction ? (
            <ReactionGlyph
              reaction={viewerReaction}
              className={isImageReaction(viewerReaction) ? "w-5 h-5" : "w-3.5 h-3.5"}
            />
          ) : (
            <ReactionGlyph reaction="love" className="w-5 h-5" />
          )}

          <span>{total > 0 ? total : "React"}</span>
        </button>
        <button
          type="button"
          onClick={onOpenComments}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-slate-300 md:hover:bg-slate-100 md:bg-slate-50 md:text-slate-600"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Comment
        </button>
        {pickerOpen && (
          <ReactionPicker onPick={(r) => react(r)} onClose={() => setPickerOpen(false)} />
        )}
      </div>
    </div>
  );
}

/* ---- Tab: Members ---- */
function MembersTab({ circle }: { circle: CircleSummary }) {
  const listFn = useServerFn(listCircleMembers);
  const q = useQuery({
    queryKey: ["circle-members", circle.id],
    queryFn: () => listFn({ data: { circleId: circle.id } }),
  });
  if (q.isLoading)
    return (
      <div className="text-center text-slate-500 text-sm py-6 md:text-slate-500">
        Loading members…
      </div>
    );
  const rows = q.data ?? [];
  if (rows.length === 0)
    return (
      <div className="text-center text-slate-500 text-sm py-6 md:text-slate-500">
        No members yet.
      </div>
    );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map((m) => (
        <div
          key={m.userId}
          className="bg-[#1E1E24] border border-white/10 rounded-xl p-3 flex items-center gap-3 md:bg-white md:shadow-sm md:border-slate-200"
        >
          {m.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <ResponsiveImage
              sizes="40px"
              src={m.avatar}
              alt=""
              className="w-10 h-10 rounded-full object-cover shrink-0"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-bold shrink-0">
              {m.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <button
            onClick={() =>
              (window.location.href = m.slug ? `/profile/${m.slug}` : `/profile/${m.userId}`)
            }
            className="min-w-0 flex-1 text-left"
          >
            <div className="text-sm font-semibold text-white truncate md:text-slate-900">
              {m.name}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 md:text-slate-500">
              {m.role}
            </div>
          </button>
          <FollowButton targetId={m.userId} compact />
        </div>
      ))}
    </div>
  );
}

/* ---- Tab: Bounties ---- */
function BountiesTab({ circle }: { circle: CircleSummary }) {
  const listFn = useServerFn(listCircleBounties);
  const q = useQuery({
    queryKey: ["circle-bounties", circle.id],
    queryFn: () => listFn({ data: { circleId: circle.id } }),
  });
  return (
    <div className="max-w-4xl space-y-3">
      <div className="bg-[#1E1E24] border border-emerald-500/30 rounded-xl p-4 md:bg-white md:shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <div className="text-sm font-bold text-white md:text-slate-900">
            Bounties posted by circle members
          </div>
        </div>
        <p className="text-xs text-slate-400 md:text-slate-600">
          Discuss and coordinate here; each member still applies individually via their profile.
        </p>
      </div>
      {q.isLoading ? (
        <div className="text-center text-slate-500 text-sm py-6 md:text-slate-500">
          Loading bounties…
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-6 text-center text-slate-500 text-sm md:bg-white md:shadow-sm md:border-slate-200 md:text-slate-500">
          No open bounties from members yet.
        </div>
      ) : (
        q.data!.map((b) => (
          <div
            key={b.id}
            className="bg-[#1E1E24] border border-white/10 rounded-xl p-4 md:bg-white md:shadow-sm md:border-slate-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[10px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wide mb-2">
                  <Target className="w-3 h-3" />
                  {b.status.toUpperCase()} · ${b.priceUsd.toLocaleString()}
                </div>
                <h3 className="text-white font-bold text-sm leading-snug md:text-slate-900">
                  {b.title}
                </h3>
                <div className="text-xs text-slate-500 mt-1 md:text-slate-500">
                  by {b.posterName}
                  {b.category ? ` · ${b.category}` : ""}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ---- Tab: Resources ---- */
function ResourcesTab({ circle, isMember }: { circle: CircleSummary; isMember: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCircleResources);
  const addFn = useServerFn(addCircleResource);
  const rmFn = useServerFn(removeCircleResource);
  const q = useQuery({
    queryKey: ["circle-resources", circle.id],
    queryFn: () => listFn({ data: { circleId: circle.id } }),
    enabled: isMember,
  });
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const addM = useMutation({
    mutationFn: () => addFn({ data: { circleId: circle.id, title, url } }),
    onSuccess: () => {
      setTitle("");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["circle-resources", circle.id] });
    },
  });
  const rmM = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circle-resources", circle.id] }),
  });

  if (!isMember) {
    return (
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-6 text-center md:bg-white md:shadow-sm md:border-slate-200">
        <Lock className="w-6 h-6 text-slate-500 mx-auto mb-2 md:text-slate-500" />
        <p className="text-sm text-slate-300 font-semibold md:text-slate-600">Members only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2 md:bg-white md:shadow-sm md:border-slate-200">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 md:bg-white md:border-slate-200 md:text-slate-900"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 md:bg-white md:border-slate-200 md:text-slate-900"
        />
        <button
          onClick={() => addM.mutate()}
          disabled={!title.trim() || !url.trim() || addM.isPending}
          className="px-3 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs disabled:opacity-40"
        >
          Share
        </button>
      </div>

      {q.isLoading ? (
        <div className="text-center text-slate-500 text-sm py-6 md:text-slate-500">
          Loading resources…
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8 md:text-slate-500">
          No resources shared yet. Drop a link, template, or repo above.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {q.data!.map((r) => (
            <div
              key={r.id}
              className="bg-[#1E1E24] border border-white/10 rounded-xl p-3 flex items-start gap-3 md:bg-white md:shadow-sm md:border-slate-200"
            >
              <div className="w-10 h-10 rounded-[10px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                {r.pinned ? (
                  <Pin className="w-4 h-4 text-emerald-300" />
                ) : (
                  <Link2 className="w-4 h-4 text-emerald-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm font-semibold text-white hover:text-emerald-300 break-words md:text-slate-900"
                >
                  {r.title}
                </a>
                <div className="text-[10px] text-slate-500 truncate md:text-slate-500">{r.url}</div>
              </div>
              <button
                onClick={() => rmM.mutate(r.id)}
                className="p-1.5 rounded-[10px] text-slate-400 hover:text-red-400 hover:bg-white/5 md:text-slate-600"
                aria-label="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ Forge Modal ============================ */
type CocRule = { id: string; text: string };

function ForgeCircleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const createFn = useServerFn(createCircle);
  const catsQ = useQuery({
    queryKey: ["circle-categories"],
    queryFn: () => listCircleCategories(),
  });
  const dynamicCategories = useMemo(() => {
    const names = (catsQ.data ?? []).map((c) => c.name);
    return names.length > 0 ? names : DEFAULT_CATEGORIES;
  }, [catsQ.data]);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [category, setCategory] = useState<string>("");
  const [otherCategory, setOtherCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Uploads
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Code of Conduct rules
  const [pledge, setPledge] = useState(
    "Be kind, respectful, and constructive. No spam, harassment, or self-promo without value.",
  );
  const [rules, setRules] = useState<CocRule[]>([{ id: crypto.randomUUID(), text: "" }]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const pickAndUpload = async (
    bucket: "circle-avatars" | "circle-covers",
    file: File,
    setPath: (p: string) => void,
    setPreview: (p: string) => void,
    setBusy: (b: boolean) => void,
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id ?? "anon";
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      setPath(path);
      if (signed?.signedUrl) setPreview(signed.signedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const finalCategory =
    category === "__other" ? otherCategory.trim() : category || dynamicCategories[0] || "Community";

  const submit = async () => {
    if (!name.trim() || busy) return;
    if (category === "__other" && !otherCategory.trim()) {
      setError("Enter a category name for “Other”.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cleanRules = rules
        .map((r) => ({ id: r.id, text: r.text.trim() }))
        .filter((r) => r.text.length > 0)
        .slice(0, 20);
      const c = await createFn({
        data: {
          name: name.trim(),
          description: bio.trim() || undefined,
          isPrivate,
          category: finalCategory,
          avatarUrl: avatarPath ?? undefined,
          coverUrl: coverPath ?? undefined,
          codeOfConduct:
            cleanRules.length > 0 ? { pledge: pledge.trim(), questions: cleanRules } : undefined,
        },
      });
      onCreated(c.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to forge circle");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-light fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#1E1E24] border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-white font-black text-lg">Forge New Circle</h2>
            <p className="text-xs text-slate-400">Rally your peers under one banner.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-[10px] hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          {/* Cover */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
              Cover image (optional)
            </label>
            <div className="mt-1 relative w-full h-28 rounded-xl border border-white/10 overflow-hidden bg-[#2a2a30]">
              {coverPreview ? (
                <img loading="lazy" decoding="async" src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                  {uploadingCover ? "Uploading…" : "No cover — a grey background will be used"}
                </div>
              )}
              <label className="absolute bottom-2 right-2 px-2.5 py-1 rounded-[10px] bg-black/60 text-white text-xs font-semibold cursor-pointer hover:bg-black/80">
                {coverPreview ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      pickAndUpload(
                        "circle-covers",
                        f,
                        setCoverPath,
                        setCoverPreview,
                        setUploadingCover,
                      );
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* Icon + Name */}
          <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
            <div>
              <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                Circle picture
              </label>
              <div className="mt-1 relative w-16 h-16 rounded-full border border-white/10 overflow-hidden bg-[#2a2a30] flex items-center justify-center">
                {avatarPreview ? (
                  <img loading="lazy" decoding="async" src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-6 h-6 text-slate-500" />
                )}
                <label className="absolute inset-0 cursor-pointer opacity-0 hover:opacity-100 bg-black/50 text-[10px] text-white flex items-center justify-center font-semibold">
                  {uploadingAvatar ? "…" : "Change"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        pickAndUpload(
                          "circle-avatars",
                          f,
                          setAvatarPath,
                          setAvatarPreview,
                          setUploadingAvatar,
                        );
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                Circle Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="e.g. Edge Runtime Council"
                className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
              Scope / Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              placeholder="What will this guild ship together?"
              className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none min-h-[70px]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
              Category
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {dynamicCategories.map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      active
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                        : "bg-[#121214] border-white/10 text-slate-300 hover:text-white"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCategory("__other")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  category === "__other"
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                    : "bg-[#121214] border-white/10 text-slate-300 hover:text-white"
                }`}
              >
                Other
              </button>
            </div>
            {category === "__other" && (
              <input
                value={otherCategory}
                onChange={(e) => setOtherCategory(e.target.value)}
                maxLength={40}
                placeholder="Type your own category…"
                className="mt-2 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            )}
          </div>

          {/* Privacy */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
              Privacy
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`flex items-start gap-2 p-3 rounded-[10px] border text-left transition-colors ${
                  !isPrivate
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-white/10 bg-[#121214] hover:border-white/20"
                }`}
              >
                <Globe2 className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Public</div>
                  <div className="text-[10px] text-slate-400">Anyone can find & request.</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`flex items-start gap-2 p-3 rounded-[10px] border text-left transition-colors ${
                  isPrivate
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-white/10 bg-[#121214] hover:border-white/20"
                }`}
              >
                <Lock className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Private</div>
                  <div className="text-[10px] text-slate-400">Invite / approve only.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Code of Conduct — dynamic */}
          <div className="bg-[#121214] border border-white/10 rounded-[10px] p-3 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <div className="text-xs font-bold text-white">Code of Conduct</div>
            </div>
            <p className="text-[11px] text-slate-500">
              Add rules members must accept before joining. You can add as many as you need.
            </p>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Kindness pledge
              </label>
              <textarea
                value={pledge}
                onChange={(e) => setPledge(e.target.value)}
                maxLength={2000}
                className="mt-1 w-full bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-3 text-xs text-white focus:outline-none focus:border-emerald-500/50 resize-none min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              {rules.map((r, idx) => (
                <div key={r.id} className="flex items-start gap-2">
                  <span className="mt-2 text-[10px] font-bold text-slate-500 w-5 text-right">
                    {idx + 1}.
                  </span>
                  <input
                    value={r.text}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((p) => (p.id === r.id ? { ...p, text: e.target.value } : p)),
                      )
                    }
                    maxLength={500}
                    placeholder={`Rule ${idx + 1} (e.g. Keep discussions on-topic)`}
                    className="flex-1 bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setRules((prev) => prev.filter((p) => p.id !== r.id))}
                    className="p-2 rounded-[10px] text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    aria-label="Remove rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={rules.length >= 20}
                onClick={() => setRules((prev) => [...prev, { id: crypto.randomUUID(), text: "" }])}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-200 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> Add rule {rules.length >= 20 ? "(max 20)" : ""}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-[10px] p-3 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10 bg-[#121214]/50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-[10px] text-sm text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> {busy ? "Forging…" : "Forge Circle"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Code-of-Conduct Modal ============================ */
function CoCAcceptModal({
  circle,
  onClose,
  onDone,
}: {
  circle: CircleSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const submitFn = useServerFn(submitCircleCoc);
  const questions = circle.codeOfConduct.questions;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  const submit = async () => {
    if (!allAnswered || !agreed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitFn({
        data: {
          circleId: circle.id,
          agreedPledge: true,
          answers: questions.map((q) => ({ id: q.id, text: (answers[q.id] ?? "").trim() })),
        },
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-light fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#1E1E24] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-black text-lg">Accept the Code of Conduct</h2>
            <p className="text-xs text-slate-400">One last step to join {circle.name}.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-[10px] hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-[10px] p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <div className="text-xs font-bold text-white">Circle Pledge</div>
            </div>
            <p className="text-xs text-slate-200 whitespace-pre-wrap">
              {circle.codeOfConduct.pledge}
            </p>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id}>
              <label className="text-xs font-semibold text-slate-300">
                {idx + 1}. {q.text}
              </label>
              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                maxLength={1000}
                className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none min-h-[60px]"
              />
            </div>
          ))}

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 accent-emerald-500"
            />
            <span className="text-xs text-slate-300">
              I agree to the pledge and to treat every member of {circle.name} with respect.
            </span>
          </label>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-[10px] p-3 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10 bg-[#121214]/50">
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-[10px] text-sm text-slate-300 hover:bg-white/5"
          >
            Later
          </button>
          <button
            onClick={submit}
            disabled={!allAnswered || !agreed || busy}
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm disabled:opacity-40"
          >
            <Check className="w-4 h-4" /> {busy ? "Joining…" : "Join Circle"}
          </button>
        </div>
      </div>
    </div>
  );
}
