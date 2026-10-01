import { ShowcaseEngagement } from "@/components/oventric/creators/ShowcaseEngagement";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BadgeCheck, Download, Eye, Play, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listCreatorFeed, recordCreatorPostView, type CreatorPostDTO } from "@/lib/creators.functions";
import { computeDisplayPrice } from "@/lib/fx-display";
import { createOrder, getOrderWithDownload } from "@/lib/marketplace.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { CreatorPostMenu } from "./CreatorPostMenu";
import { CreatorPostActions, CreatorPostDetails, CreatorProductAttachment, CreatorResourceCard } from "./CreatorResourceCard";
import { logCreatorEvent, useWatchTime } from "@/lib/creator-events";
import { getHiddenPosts } from "@/components/oventric/PostActionsMenu";


function isDirectVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (/\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(u.pathname)) return true;
    if (u.hostname.includes("dropbox.com") && (u.searchParams.get("dl") === "1" || u.searchParams.get("raw") === "1")) return true;
    if (u.hostname.includes("drive.google.com") && u.search.includes("export=download")) return true;
    return false;
  } catch {
    return false;
  }
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function relativeTime(value: string) {
  const created = new Date(value).getTime();
  const diffMs = Date.now() - created;
  if (!Number.isFinite(created)) return "now";
  if (diffMs < 45_000) return "now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return rtf.format(-days, "day");
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return rtf.format(-weeks, "week");
  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.floor(days / 365), "year");
}

const TINTS = [
  "border-sky-100 bg-sky-50/70 text-sky-700",
  "border-violet-100 bg-violet-50/70 text-violet-700",
  "border-emerald-100 bg-emerald-50/70 text-emerald-700",
  "border-amber-100 bg-amber-50/70 text-amber-700",
  "border-rose-100 bg-rose-50/70 text-rose-700",
  "border-teal-100 bg-teal-50/70 text-teal-700",
];

/** Muted 10s looping preview that starts when scrolled into view; click plays it fully. */
function PreviewVideo({ src, poster, postId }: { src: string; poster: string | null; postId?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [full, setFull] = useState(false);
  useWatchTime(ref, postId, full);

  useEffect(() => {
    const el = ref.current;
    if (!el || full) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.muted = true;
          void el.play().catch(() => {});
          // Loop a 10-second preview window.
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
  }, [full]);

  return (
    <div className="relative bg-white">
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted={!full}
        loop={!full}
        playsInline
        controls={full}
        className="max-h-[70vh] w-full bg-white object-contain"
        onClick={() => {
          if (full) return;
          setFull(true);
          const el = ref.current;
          if (el) {
            el.muted = false;
            el.currentTime = 0;
            void el.play().catch(() => {});
          }
        }}
      />
      {!full && (
        <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-foreground/70 px-2.5 py-1 text-[11px] font-bold text-background">
          <Play className="h-3 w-3" /> Tap to play
        </span>
      )}
    </div>
  );
}

/** Linked video (YouTube/Vimeo/etc): mounts and plays only while scrolled into view. */
function ViewportEmbed({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.5,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="mt-3 aspect-video w-full overflow-hidden rounded-[10px] border border-slate-100 bg-slate-50"
    >
      {visible ? (
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-slate-300">
          <Play className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}

type DockLink = { href: string; label: string; host: string; tone: string; dot: string };

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

function describeLink(url: string, fallback: string): DockLink {
  const host = hostOf(url);
  const h = host.toLowerCase();
  const make = (label: string, tone: string, dot: string): DockLink => ({ href: url, label, host, tone, dot });
  if (h.includes("whatsapp") || h.includes("wa.me")) return make("WhatsApp group", "hover:border-emerald-300 hover:bg-emerald-50/70", "bg-emerald-500");
  if (h.includes("t.me") || h.includes("telegram")) return make("Telegram channel", "hover:border-sky-300 hover:bg-sky-50/70", "bg-sky-500");
  if (h.includes("discord")) return make("Discord server", "hover:border-indigo-300 hover:bg-indigo-50/70", "bg-indigo-500");
  if (h.includes("youtube") || h.includes("youtu.be")) return make("Watch on YouTube", "hover:border-red-300 hover:bg-red-50/70", "bg-red-500");
  if (h.includes("vimeo")) return make("Watch on Vimeo", "hover:border-cyan-300 hover:bg-cyan-50/70", "bg-cyan-500");
  if (h.includes("tiktok")) return make("Watch on TikTok", "hover:border-slate-300 hover:bg-slate-50", "bg-slate-900");
  if (h.includes("instagram")) return make("Instagram", "hover:border-pink-300 hover:bg-pink-50/70", "bg-pink-500");
  if (h.includes("behance")) return make("Behance", "hover:border-blue-300 hover:bg-blue-50/70", "bg-blue-600");
  if (h.includes("dribbble")) return make("Dribbble", "hover:border-pink-300 hover:bg-pink-50/70", "bg-pink-400");
  if (h.includes("github")) return make("GitHub", "hover:border-slate-300 hover:bg-slate-50", "bg-slate-800");
  return make(fallback, "hover:border-amber-300 hover:bg-amber-50/70", "bg-amber-500");
}

/** Tappable dock of the creator's community, external-video and portfolio links. */
function LinkDock({ post }: { post: CreatorPostDTO }) {
  const links: DockLink[] = [];
  if (post.communityLink) links.push(describeLink(post.communityLink, "Join the community"));
  if (post.externalUrl && !post.externalEmbedUrl) links.push(describeLink(post.externalUrl, "Watch full video"));
  for (const w of post.author.workLinks ?? []) {
    if (w && !links.some((l) => l.href === w)) links.push(describeLink(w, "View work"));
  }
  if (links.length === 0) return null;

  return (
    <div className="mt-3 rounded-[10px] border border-dashed border-slate-200 bg-slate-50/50 p-2">
      <p className="px-1 pb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Connect with the creator</p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            onClick={() => logCreatorEvent(post.id, "link_click", { target: l.href })}
            target="_blank"
            rel="noreferrer noopener"
            className={`group flex shrink-0 items-center gap-2 rounded-[10px] border border-slate-200 bg-white py-1.5 pl-2.5 pr-2 transition-colors ${l.tone}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${l.dot}`} />
            <span className="min-w-0 text-left leading-tight">
              <span className="block truncate text-[12px] font-black text-slate-900">{l.label}</span>
              <span className="block truncate text-[10px] text-slate-400">{l.host}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function CreatorCard({
  post,
  onRecordedView,
  isOwner,
  onHide,
  onDeleted,
  onUpdated,
}: {
  post: CreatorPostDTO;
  onRecordedView: (postId: string) => void;
  isOwner: boolean;
  onHide: (postId: string) => void;
  onDeleted: (postId: string) => void;
  onUpdated: (
    postId: string,
    patch: { title: string; caption: string | null; communityLink: string | null },
  ) => void;
}) {
  const recordView = useServerFn(recordCreatorPostView);
  const articleRef = useRef<HTMLElement>(null);
  const initials = post.author.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const article = articleRef.current;
    if (!article) return;
    const key = "oventric_creator_view_session";
    let sessionKey = window.localStorage.getItem(key);
    if (!sessionKey) {
      sessionKey = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(key, sessionKey);
    }
    const viewedKey = `oventric_creator_viewed_${post.id}`;
    if (window.sessionStorage.getItem(viewedKey)) return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          if (timer) window.clearTimeout(timer);
          return;
        }
        timer = window.setTimeout(() => {
          void recordView({ data: { postId: post.id, sessionKey } }).then((result) => {
            if (result.recorded) {
              window.sessionStorage.setItem(viewedKey, "1");
              onRecordedView(post.id);
            }
          });
          observer.disconnect();
        }, 1200);
      },
      { threshold: 0.65 },
    );
    observer.observe(article);
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [onRecordedView, post.id, recordView]);

  return (
    <article ref={articleRef} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-slate-100 bg-white px-4 py-3 transition-colors hover:bg-slate-50">
      <div>
        <Link
          to="/profile/$id"
          params={{ id: post.author.slug ?? post.author.userId }}
          className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-black text-slate-500"
        >
          {post.author.avatarUrl ? (
            <img
              loading="lazy"
              decoding="async"
              src={post.author.avatarUrl}
              alt={`${post.author.name}'s profile`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials || "C"}</span>
          )}
        </Link>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            to="/profile/$id"
            params={{ id: post.author.slug ?? post.author.userId }}
            className="truncate text-sm font-black text-slate-900"
          >
            {post.author.name}
          </Link>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700">
            Creator
          </span>
          <span className="shrink-0 text-[11px] text-slate-400">
            · {relativeTime(post.createdAt)}
          </span>
          <div className="ml-auto">
            <CreatorPostMenu
              post={post}
              isOwner={isOwner}
              onHide={onHide}
              onDeleted={onDeleted}
              onUpdated={onUpdated}
            />
          </div>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
          {post.fields.length > 0 && <span className="truncate">{post.fields.join(" · ")}</span>}
          <span className="inline-flex shrink-0 items-center gap-1 text-slate-400">
            <Eye className="h-3.5 w-3.5" /> {compactNumber(post.viewCount)}
          </span>
        </div>
        <p className="mt-2 text-[15px] font-black leading-snug text-slate-900">{post.title}</p>
        {post.caption && <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{post.caption}</p>}

        {post.media.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-[10px] border border-slate-100">
            {post.media[0].type === "video" ? (
              <>
                <PreviewVideo src={post.media[0].url} poster={post.media[0].posterUrl} postId={post.id} />
                {post.fullVideoUrl && (
                  <div className="flex justify-end border-t border-slate-100 bg-white px-3 py-2">
                    <a
                      href={post.fullVideoUrl}
                      onClick={() => logCreatorEvent(post.id, "full_video_click", { target: post.fullVideoUrl ?? undefined })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-700 transition-colors hover:bg-violet-100"
                    >
                      {isDirectVideoUrl(post.fullVideoUrl) ? (
                        <>
                          <Download className="h-3.5 w-3.5" /> Download full video
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="h-3.5 w-3.5" /> Watch full video
                        </>
                      )}
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className={`grid gap-0.5 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {post.media.slice(0, 4).map((m) => (
                  <img key={m.url} src={m.url} alt="" loading="lazy" className="h-full max-h-[60vh] w-full object-cover" />
                ))}
              </div>
            )}
          </div>
        )}

        <CreatorPostDetails post={post} />
        <CreatorProductAttachment post={post} />
        {post.asset && <CreatorResourceCard post={post} />}

        {post.externalEmbedUrl && (
          <ViewportEmbed src={post.externalEmbedUrl} title={post.title} />
        )}

      <LinkDock post={post} />
      <ShowcaseEngagement postId={post.id} authorId={post.author.userId} />
      <CreatorPostActions post={post} isOwner={isOwner} />
      </div>
    </article>
  );
}

/** Creators tab feed: showcase work with auto-playing video previews. */
export function CreatorFeed({ reloadKey }: { reloadKey: number }) {
  const load = useServerFn(listCreatorFeed);
  const [posts, setPosts] = useState<CreatorPostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [field, setField] = useState<string>("all");
  const [meId, setMeId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHidden(getHiddenPosts());
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setMeId(data.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);


  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .then((rows) => alive && setPosts(rows))
      .catch((e) => console.error("[creators] feed", e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [load, reloadKey]);

  const fields = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.fields.forEach((f) => set.add(f)));
    return Array.from(set).slice(0, 8);
  }, [posts]);

  const visible = (field === "all" ? posts : posts.filter((p) => p.fields.includes(field))).filter(
    (p) => !hidden.has(p.id),
  );
  const handleRecordedView = useCallback((postId: string) => {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, viewCount: post.viewCount + 1 } : post)),
    );
  }, []);
  const handleHide = useCallback((postId: string) => {
    setHidden((current) => new Set(current).add(postId));
  }, []);
  const handleDeleted = useCallback((postId: string) => {
    setPosts((current) => current.filter((p) => p.id !== postId));
  }, []);
  const handleUpdated = useCallback(
    (
      postId: string,
      patch: { title: string; caption: string | null; communityLink: string | null },
    ) => {
      setPosts((current) =>
        current.map((p) =>
          p.id === postId
            ? { ...p, title: patch.title, caption: patch.caption, communityLink: patch.communityLink }
            : p,
        ),
      );
    },
    [],
  );

  if (loading) {
    return (
      <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/60 p-10 text-center" aria-busy="true">
        <BadgeCheck className="mx-auto h-7 w-7 animate-pulse text-emerald-600" />
        <p className="mt-3 text-sm font-bold text-slate-900">Loading creators…</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/60 p-10 text-center">
        <BadgeCheck className="mx-auto h-7 w-7 text-emerald-600" />
        <p className="mt-3 text-sm font-bold text-slate-900">No creators content yet</p>
        <p className="mt-1 text-xs text-slate-500">Tap + to set up your creator profile and showcase your work.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-y border-slate-100 bg-white sm:rounded-[10px] sm:border-x">
      {fields.length > 0 && (
        <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-slate-100 bg-white/95 px-3 py-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["all", ...fields].map((f, i) => (
            <Button
              key={f}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setField(f)}
              className={`h-8 shrink-0 rounded-full px-3 text-xs font-bold shadow-none ${
                field === f ? "border-emerald-500 bg-emerald-500 text-primary-foreground hover:bg-emerald-600" : TINTS[i % TINTS.length]
              }`}
            >
              {f === "all" ? "All" : f}
            </Button>
          ))}
        </div>
      )}
      {visible.map((p) => (
        <CreatorCard
          key={p.id}
          post={p}
          onRecordedView={handleRecordedView}
          isOwner={!!meId && meId === p.author.userId}
          onHide={handleHide}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      ))}
    </div>
  );
}
