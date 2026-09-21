import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, MessageCircle, Play, Send } from "lucide-react";
import { listCreatorFeed, type CreatorPostDTO } from "@/lib/creators.functions";

const TINTS = [
  "border-sky-100 bg-sky-50/70 text-sky-700",
  "border-violet-100 bg-violet-50/70 text-violet-700",
  "border-emerald-100 bg-emerald-50/70 text-emerald-700",
  "border-amber-100 bg-amber-50/70 text-amber-700",
  "border-rose-100 bg-rose-50/70 text-rose-700",
  "border-teal-100 bg-teal-50/70 text-teal-700",
];

/** Muted 10s looping preview that starts when scrolled into view; click plays it fully. */
function PreviewVideo({ src, poster }: { src: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [full, setFull] = useState(false);

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
    <div className="relative">
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted={!full}
        loop={!full}
        playsInline
        controls={full}
        className="max-h-[70vh] w-full bg-black object-contain"
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
        <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
          <Play className="h-3 w-3" /> Tap to play
        </span>
      )}
    </div>
  );
}

function CreatorCard({ post, index }: { post: CreatorPostDTO; index: number }) {
  const tint = TINTS[index % TINTS.length];
  return (
    <article className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link
          to="/profile/$id"
          params={{ id: post.author.slug ?? post.author.userId }}
          className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200"
        >
          {post.author.avatarUrl && (
            <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/profile/$id"
            params={{ id: post.author.slug ?? post.author.userId }}
            className="block truncate text-sm font-black text-slate-900"
          >
            {post.author.name}
          </Link>
          <p className="truncate text-[11px] text-slate-500">{post.fields.join(" · ") || "Creator"}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${tint}`}>
          CREATOR
        </span>
      </div>

      <div className="px-4 pb-3">
        <p className="text-[15px] font-black leading-snug text-slate-950">{post.title}</p>
        {post.caption && <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{post.caption}</p>}
      </div>

      {post.media.length > 0 &&
        (post.media[0].type === "video" ? (
          <PreviewVideo src={post.media[0].url} poster={post.media[0].posterUrl} />
        ) : (
          <div className={`grid gap-0.5 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {post.media.slice(0, 4).map((m) => (
              <img key={m.url} src={m.url} alt="" loading="lazy" className="h-full max-h-[60vh] w-full object-cover" />
            ))}
          </div>
        ))}

      {post.externalEmbedUrl && (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={post.externalEmbedUrl}
            title={post.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="h-full w-full"
          />
        </div>
      )}

      {(post.communityLink || (post.externalUrl && !post.externalEmbedUrl)) && (
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {post.communityLink && (
            <a
              href={post.communityLink}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"
            >
              <Send className="h-3.5 w-3.5" /> Join the channel
            </a>
          )}
          {post.externalUrl && !post.externalEmbedUrl && (
            <a
              href={post.externalUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Watch full video
            </a>
          )}
        </div>
      )}
    </article>
  );
}

/** Creators tab feed: showcase work with auto-playing video previews. */
export function CreatorFeed({ reloadKey }: { reloadKey: number }) {
  const load = useServerFn(listCreatorFeed);
  const [posts, setPosts] = useState<CreatorPostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [field, setField] = useState<string>("all");

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

  const visible = field === "all" ? posts : posts.filter((p) => p.fields.includes(field));

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
    <div className="space-y-4">
      {fields.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["all", ...fields].map((f, i) => (
            <button
              key={f}
              type="button"
              onClick={() => setField(f)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                field === f ? "border-emerald-500 bg-emerald-500 text-white" : TINTS[i % TINTS.length]
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      )}
      {visible.map((p, i) => (
        <CreatorCard key={p.id} post={p} index={i} />
      ))}
    </div>
  );
}
