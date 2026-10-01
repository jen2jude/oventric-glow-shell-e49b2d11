import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BadgeCheck, Download, Eye, FolderHeart, MessageCircle, Pencil, Play, ShieldOff, ShoppingBag, Sparkles, Wrench } from "lucide-react";
import {
  getCreatorBlockState,
  type CreatorPostDTO,
  type PublicCreatorProfileDTO,
} from "@/lib/creators.functions";
import { listPublicCollections } from "@/lib/collections.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { haptic } from "@/lib/haptics";
import { Header } from "@/components/oventric/Header";
import { FollowButton } from "@/components/oventric/FollowButton";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { CreatorPostSheet } from "@/components/oventric/app/CreatorPostSheet";
import { CreatorOnboardingModal } from "@/components/oventric/creators/CreatorOnboardingModal";

type Section = "content" | "resources" | "collections" | "shop";
type Filter = "all" | "videos" | "tutorials" | "tips" | "resources";

const CRIMSON = "#E5484D";
const ACCENTS = ["#16A34A", "#2563EB", "#7C3AED", "#D97706", "#E5484D"];
const TUTORIAL_RE = /tutorial|course|learn|guide|how to|lesson|step by step|masterclass|explained|beginner/;
const TIPS_RE = /\btips?\b|trick|hack|quick|shortcut|secret/;

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const text = (p: CreatorPostDTO) => [p.title, p.caption, ...(p.fields ?? [])].join(" ").toLowerCase();
const isVideo = (p: CreatorPostDTO) => p.media[0]?.type === "video" || !!p.externalEmbedUrl;
const thumbOf = (p: CreatorPostDTO) => {
  const m = p.media[0];
  return m?.type === "video" ? (m.posterUrl ?? null) : (m?.url ?? null);
};

/**
 * Public creator profile (/creators/@username). Built on the existing profile
 * identity, follow system, messaging and shop — no parallel systems.
 */
export function CreatorProfilePage({ profile }: { profile: PublicCreatorProfileDTO }) {
  const isApp = useIsAppShell();
  const navigate = useNavigate();
  const { session, isAuthenticated, openGate } = useAuthGate();
  const meId = session?.user?.id ?? null;
  const isOwner = meId === profile.userId;
  const [filter, setFilter] = useState<Filter>("all");
  const [openPost, setOpenPost] = useState<CreatorPostDTO | null>(null);
  const [dmOpen, setDmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchCollections = useServerFn(listPublicCollections);
  const fetchBlock = useServerFn(getCreatorBlockState);
  const { data: collections } = useQuery({
    queryKey: ["creator-profile-collections", profile.userId],
    queryFn: () => fetchCollections({ data: { idOrSlug: profile.userId } }),
    staleTime: 120_000,
  });
  const { data: block } = useQuery({
    queryKey: ["creator-profile-block", profile.userId, meId],
    queryFn: () => fetchBlock({ data: { targetId: profile.userId } }),
    enabled: !!meId && !isOwner,
    staleTime: 60_000,
  });
  const blocked = !!block?.blocked;

  const resources = useMemo(() => profile.posts.filter((p) => p.asset?.available), [profile.posts]);
  const publicCollections = (collections ?? []).filter((c) => c.itemCount > 0);

  const sections = useMemo(() => {
    const s: { key: Section; label: string; n: number }[] = [];
    if (profile.posts.length) s.push({ key: "content", label: "Content", n: profile.posts.length });
    if (resources.length) s.push({ key: "resources", label: "Resources", n: resources.length });
    if (publicCollections.length) s.push({ key: "collections", label: "Collections", n: publicCollections.length });
    if (profile.shop.count) s.push({ key: "shop", label: "Shop", n: profile.shop.count });
    return s;
  }, [profile, resources.length, publicCollections.length]);
  const [section, setSection] = useState<Section>("content");
  useEffect(() => {
    if (sections.length && !sections.some((s) => s.key === section)) setSection(sections[0].key);
  }, [sections, section]);

  const filtered = useMemo(() => {
    const all = profile.posts;
    switch (filter) {
      case "videos":
        return all.filter(isVideo);
      case "tutorials":
        return all.filter((p) => TUTORIAL_RE.test(text(p)));
      case "tips":
        return all.filter((p) => TIPS_RE.test(text(p)));
      case "resources":
        return all.filter((p) => p.asset?.available);
      default:
        return all;
    }
  }, [profile.posts, filter]);

  const t = isApp
    ? {
        page: "bg-[#070A08] text-white",
        muted: "text-white/55",
        faint: "text-white/35",
        card: "bg-white/[0.04] border-white/10",
        chipIdle: "text-white/60 border-white/10 bg-white/[0.03]",
        chipActive: "bg-white text-[#070A08] border-white",
        ghost: "border-white/15 text-white",
        app: true,
      }
    : {
        page: "bg-white text-slate-900",
        muted: "text-slate-500",
        faint: "text-slate-400",
        card: "bg-white border-slate-200 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]",
        chipIdle: "text-slate-600 border-slate-200 bg-white hover:text-slate-900",
        chipActive: "bg-slate-900 text-white border-slate-900",
        ghost: "border-slate-200 text-slate-900",
        app: false,
      };
  const handle = profile.slug ?? profile.username;

  const message = () => {
    if (!isAuthenticated) return openGate("generic");
    haptic("select");
    setDmOpen(true);
  };
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else void navigate({ to: "/creators" });
  };

  const stats = [
    { label: "Followers", v: profile.stats.followers },
    { label: "Content", v: profile.stats.content },
    { label: "Resources", v: profile.stats.resources },
    ...(profile.stats.downloads > 0 ? [{ label: "Downloads", v: profile.stats.downloads }] : []),
  ];

  return (
    <div className={`min-h-screen pb-24 font-wallet-body ${t.page}`} data-testid="creator-profile" data-app-view={isApp || undefined}>
      {isApp ? (
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#070A08]/95 px-4 py-3 backdrop-blur">
          <button onClick={back} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="truncate font-wallet-display text-[14px] font-bold">{profile.name}</p>
        </div>
      ) : (
        <div className="sticky top-0 z-50">
          <Header forceSiteNavbar />
          <div className="flex h-1">{ACCENTS.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
        </div>
      )}

      {/* Header */}
      <header className="relative">
        <div className={`relative w-full overflow-hidden ${isApp ? "h-24" : "h-40 md:h-56"}`}>
          {profile.coverUrl ? (
            <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: isApp ? "linear-gradient(135deg,#1a0d0e,#070A08)" : `linear-gradient(120deg, ${ACCENTS.map((c) => `${c}33`).join(",")})` }}
            />
          )}
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-end md:gap-6">
            <span className={`-mt-10 block shrink-0 overflow-hidden rounded-full border-4 ${isApp ? "h-20 w-20 border-[#070A08]" : "h-24 w-24 border-white md:-mt-14 md:h-32 md:w-32"}`}>
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[28px] font-bold text-white" style={{ background: CRIMSON }}>
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <div className="mt-3 min-w-0 flex-1">
              <h1 className={`flex items-center gap-1.5 font-wallet-display font-extrabold leading-tight ${isApp ? "text-[21px]" : "text-[28px] md:text-[38px]"}`}>
                <span className="truncate">{profile.name}</span>
                {profile.verified && <BadgeCheck className="h-5 w-5 shrink-0" style={{ color: isApp ? CRIMSON : "#2563EB" }} aria-label="Verified" />}
              </h1>
              <p className={`text-[13px] ${t.muted}`}>
                {handle && <>@{handle}</>}
                {profile.category && <> · <span className="font-semibold">{profile.category}</span></>}
              </p>
            </div>
            {!blocked && (
              <div className={`mt-4 flex gap-2 md:mt-0 md:pb-1 ${isApp ? "" : "md:w-auto"}`}>
                {isOwner ? (
                  <button onClick={() => setEditOpen(true)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-4 py-2.5 text-[13px] font-bold md:flex-none ${t.ghost}`}>
                    <Pencil className="h-4 w-4" /> Edit creator profile
                  </button>
                ) : (
                  <>
                    <div className="flex-1 md:w-36 md:flex-none">
                      <FollowButton targetId={profile.userId} className="w-full !py-2.5" />
                    </div>
                    <button onClick={message} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-4 py-2.5 text-[13px] font-bold md:w-36 md:flex-none ${t.ghost}`}>
                      <MessageCircle className="h-4 w-4" /> Message
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {!blocked && (
            <div className="mt-4 md:grid md:grid-cols-[1fr_320px] md:gap-8">
              <div>
                {profile.bio && <p className={`whitespace-pre-line leading-relaxed ${isApp ? "text-[13px] text-white/80" : "text-[15px] text-slate-700"}`}>{profile.bio}</p>}
                {profile.tools.length > 0 && (
                  <div className="mt-3">
                    <p className={`mb-1.5 text-[10.5px] font-bold uppercase tracking-wider ${t.faint}`}>Tools used</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.tools.map((tool, i) => (
                        <span
                          key={tool}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${isApp ? "border-white/10 text-white/75" : ""}`}
                          style={isApp ? undefined : { borderColor: `${ACCENTS[i % 5]}55`, color: ACCENTS[i % 5], background: `${ACCENTS[i % 5]}0F` }}
                        >
                          <Wrench className="h-3 w-3" /> {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className={`mt-4 grid rounded-[10px] border md:mt-0 md:self-start ${t.card}`} style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))` }}>
                {stats.map((s) => (
                  <div key={s.label} className={`text-center ${isApp ? "py-2.5" : "py-4"}`}>
                    <p className={`font-wallet-display font-extrabold ${isApp ? "text-[16px]" : "text-[20px]"}`}>{compact(s.v)}</p>
                    <p className={`text-[10.5px] font-semibold ${t.muted}`}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {blocked ? (
          <div className={`mt-8 rounded-[10px] border border-dashed px-6 py-10 text-center text-[13.5px] ${t.card} ${t.muted}`}>
            <ShieldOff className="mx-auto mb-2 h-6 w-6" /> This creator's profile isn't available.
          </div>
        ) : sections.length === 0 ? (
          <div className={`mt-8 rounded-[10px] border border-dashed px-6 py-10 text-center text-[13.5px] ${t.card} ${t.muted}`}>
            {isOwner ? "You haven't published anything yet. Share your first piece from the Creator's Hub." : `${profile.name} hasn't published anything yet.`}
            {isOwner && (
              <div className="mt-3">
                <Link to="/creators" className="font-bold underline">Go to Creator's Hub</Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <nav className={`app-scroll-header sticky z-20 -mx-4 mt-6 flex gap-1.5 overflow-x-auto border-b px-4 py-2.5 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 ${isApp ? "top-[61px] border-white/10 bg-[#070A08]/95" : "top-[68px] border-slate-200 bg-white/95"}`} aria-label="Profile sections">
              {sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    haptic("select");
                    setSection(s.key);
                  }}
                  aria-current={section === s.key ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${section === s.key ? t.chipActive : t.chipIdle}`}
                >
                  {s.label} <span className="opacity-60">{s.n}</span>
                </button>
              ))}
            </nav>

            <div className="pt-4">
              {section === "content" && (
                <>
                  <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
                    {(["all", "videos", "tutorials", "tips", "resources"] as Filter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        aria-pressed={filter === f}
                        className={`shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-bold capitalize ${filter === f ? (isApp ? "border-[#E5484D] bg-[#E5484D]/15 text-[#E5484D]" : t.chipActive) : t.chipIdle}`}
                      >
                        {f === "all" ? "All" : f}
                      </button>
                    ))}
                  </div>
                  <PostGrid posts={filtered} t={t} onOpen={setOpenPost} empty="Nothing in this filter yet." />
                </>
              )}
              {section === "resources" && <ResourceList posts={resources} t={t} onOpen={setOpenPost} />}
              {section === "collections" && (
                <div className={`grid grid-cols-2 lg:grid-cols-4 ${isApp ? "gap-2" : "gap-4"}`}>
                  {publicCollections.map((c) => {
                    const cover = c.coverUrl ?? c.items.find((i) => i.imageUrl)?.imageUrl ?? null;
                    return (
                      <div key={c.id} className={`overflow-hidden rounded-[10px] border ${t.card}`}>
                        <div className="aspect-[4/3] bg-black/10">
                          {cover ? <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><FolderHeart className="h-7 w-7 opacity-40" /></div>}
                        </div>
                        <div className="p-2.5">
                          <p className="truncate font-wallet-display text-[13px] font-bold">{c.title}</p>
                          <p className={`text-[11px] ${t.muted}`}>{c.itemCount} items</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {section === "shop" && (
                <>
                  <div className={`grid grid-cols-2 lg:grid-cols-4 ${isApp ? "gap-2" : "gap-4"}`}>
                    {profile.shop.items.map((p) => (
                      <Link key={p.id} to="/product/$id" params={{ id: p.slug ?? p.id }} className={`overflow-hidden rounded-[10px] border ${t.card}`}>
                        <div className="aspect-square bg-black/10">
                          {p.coverUrl ? <img src={p.coverUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ShoppingBag className="h-7 w-7 opacity-40" /></div>}
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 font-wallet-display text-[12.5px] font-bold">{p.name}</p>
                          <p className={`mt-0.5 truncate text-[11px] ${t.muted}`}>{p.category}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {handle && (
                    <Link
                      to="/shop/$id"
                      params={{ id: handle }}
                      className="mt-4 flex items-center justify-center gap-2 rounded-[10px] py-3 text-[13px] font-bold text-white"
                      style={{ background: CRIMSON }}
                    >
                      <ShoppingBag className="h-4 w-4" /> Visit full shop ({profile.shop.count})
                    </Link>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <CreatorPostSheet post={openPost} onClose={() => setOpenPost(null)} />
      {!isOwner && (
        <ProfileMessageModal
          open={dmOpen}
          onClose={() => setDmOpen(false)}
          recipient={{ userId: profile.userId, displayName: profile.name, avatarUrl: profile.avatarUrl, slug: profile.slug }}
        />
      )}
      {isOwner && (
        <CreatorOnboardingModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onDone={() => {
            setEditOpen(false);
            if (typeof window !== "undefined") window.location.reload();
          }}
        />
      )}
    </div>
  );
}

type T = { card: string; muted: string; faint: string; app: boolean };

function PostGrid({ posts, t, onOpen, empty }: { posts: CreatorPostDTO[]; t: T; onOpen: (p: CreatorPostDTO) => void; empty: string }) {
  if (!posts.length) return <div className={`rounded-[10px] border border-dashed px-6 py-10 text-center text-[13px] ${t.card} ${t.muted}`}>{empty}</div>;
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${t.app ? "gap-1.5" : "gap-4"}`}>
      {posts.map((p, i) => {
        const thumb = thumbOf(p);
        const lead = i === 0 && posts.length > 4;
        return (
          <button
            key={p.id}
            onClick={() => {
              haptic("select");
              onOpen(p);
            }}
            className={`group relative overflow-hidden rounded-[10px] border text-left ${t.card} ${lead ? "col-span-2 md:row-span-2" : ""}`}
          >
            <div className={`relative w-full overflow-hidden bg-black/20 ${lead ? "aspect-[16/10] md:aspect-auto md:h-full md:min-h-[320px]" : "aspect-[4/5]"}`}>
              {thumb ? (
                <img src={thumb} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : p.media[0]?.type === "video" ? (
                <video src={p.media[0].url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center"><Sparkles className="h-7 w-7" style={{ color: CRIMSON }} /></div>
              )}
              {isVideo(p) && (
                <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60"><Play className="h-3.5 w-3.5 fill-current" style={{ color: "#fff" }} /></span>
              )}
              {p.asset?.available && p.asset.isFree && (
                <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: t.app ? "rgba(0,0,0,0.6)" : "#16A34A", color: "#fff" }}>FREE</span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-10" style={{ color: "#fff" }}>
                <p className={`line-clamp-2 font-wallet-display font-bold ${lead ? "text-[16px] md:text-[20px]" : "text-[12px]"}`}>{p.title || p.caption || "Untitled"}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] opacity-80"><Eye className="h-3 w-3" /> {compact(p.viewCount)}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ResourceList({ posts, t, onOpen }: { posts: CreatorPostDTO[]; t: T; onOpen: (p: CreatorPostDTO) => void }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${t.app ? "gap-2" : "gap-4"}`}>
      {posts.map((p) => {
        const thumb = thumbOf(p);
        const free = !!p.asset?.isFree;
        return (
          <article key={p.id} className={`flex items-center gap-3 rounded-[10px] border p-2.5 ${t.card}`}>
            <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[8px] bg-black/20">
              {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-wallet-display text-[13.5px] font-bold">{p.title || "Untitled resource"}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-bold">
                <span className={`rounded-full border px-2 py-0.5 ${t.app ? "border-white/10 text-white/60" : "border-slate-200 text-slate-600"}`}>{p.asset?.category || "Resource"}</span>
                {free && <span className="rounded-full px-2 py-0.5" style={{ background: t.app ? "rgba(229,72,77,0.14)" : "#16A34A1F", color: t.app ? CRIMSON : "#16A34A" }}>Free</span>}
                {(p.asset?.downloadCount ?? 0) > 0 && <span className={t.faint}>{p.asset!.downloadCount} downloads</span>}
              </div>
            </div>
            <button
              onClick={() => onOpen(p)}
              className="inline-flex shrink-0 items-center gap-1 rounded-[10px] px-2.5 py-2 text-[11px] font-bold text-white"
              style={{ background: t.app ? CRIMSON : free ? "#16A34A" : "#0F172A" }}
            >
              <Download className="h-3.5 w-3.5" /> {free ? "Get Resource" : "View"}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export function CreatorProfileMissing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#070A08] px-6 text-center text-white">
      <ShieldOff className="h-8 w-8 opacity-60" />
      <p className="font-wallet-display text-[18px] font-bold">Creator not found</p>
      <p className="text-[13px] text-white/55">This profile doesn't exist or is no longer available.</p>
      <Link to="/creators" className="mt-2 rounded-[10px] px-4 py-2.5 text-[13px] font-bold text-white" style={{ background: CRIMSON }}>
        Back to Creator's Hub
      </Link>
    </div>
  );
}
