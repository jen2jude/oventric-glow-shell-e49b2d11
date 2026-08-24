import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { X, Send } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { markStoryViewed, reactToStory, type StoryGroup } from "@/lib/stories.functions";

const IMAGE_MS = 5000;
const REACTIONS = ["❤️", "🔥", "😂", "👏", "😮", "💯"];

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

/**
 * Full-screen story carousel: auto-advances (5s per image, video duration for
 * clips), blurs and locks the page behind it, closes on outside click, and lets
 * viewers fire a reaction that lands in the owner's inbox with the media snippet.
 */
export function StoryViewerModal({
  groups,
  startIndex,
  startItemIndex = 0,
  onClose,
}: {
  groups: StoryGroup[];
  startIndex: number;
  startItemIndex?: number;
  onClose: () => void;
}) {
  const [gi, setGi] = useState(startIndex);
  const [ii, setIi] = useState(startItemIndex);
  const [elapsed, setElapsed] = useState(0);
  const [sent, setSent] = useState<string | null>(null);
  const [floats, setFloats] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const markViewed = useServerFn(markStoryViewed);
  const react = useServerFn(reactToStory);

  const group = groups[gi];
  const item = group?.items[ii];


  const next = useCallback(() => {
    setElapsed(0);
    setIi((prev) => {
      const g = groups[gi];
      if (g && prev + 1 < g.items.length) return prev + 1;
      if (gi + 1 < groups.length) {
        setGi(gi + 1);
        return 0;
      }
      onClose();
      return prev;
    });
  }, [gi, groups, onClose]);

  const prev = useCallback(() => {
    setElapsed(0);
    setIi((p) => {
      if (p > 0) return p - 1;
      if (gi > 0) {
        const g = groups[gi - 1];
        setGi(gi - 1);
        return Math.max(0, (g?.items.length ?? 1) - 1);
      }
      return 0;
    });
  }, [gi, groups]);

  // Lock background scroll while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const itemId = item?.id;
  useEffect(() => {
    if (!itemId) return;
    markViewed({ data: { storyId: itemId } }).catch(() => {});
  }, [itemId, markViewed]);


  const duration = useMemo(() => {
    if (item?.mediaType === "video") return null; // driven by the <video> element
    return IMAGE_MS;
  }, [item]);

  // Keep the advance callback in a ref so re-renders (new `groups` array identity,
  // reaction bursts, etc.) never restart the progress timer mid-story.
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    if (!duration) return;
    const started = Date.now();
    setElapsed(0);
    const t = setInterval(() => {
      const p = (Date.now() - started) / duration;
      setElapsed(Math.min(1, p));
      if (p >= 1) {
        clearInterval(t);
        nextRef.current();
      }
    }, 50);
    return () => clearInterval(t);
    // Only a real media change restarts the countdown.
  }, [duration, gi, ii]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Warm the next few media items so playback starts instantly.
  useEffect(() => {
    const g = groups[gi];
    if (!g) return;
    const upcoming = [
      ...g.items.slice(ii + 1, ii + 3),
      ...(groups[gi + 1]?.items.slice(0, 1) ?? []),
    ];
    upcoming.forEach((s) => {
      if (s.mediaType === "video") {
        if (s.posterUrl) new Image().src = s.posterUrl;
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.src = s.mediaUrl;
      } else {
        new Image().src = s.mediaUrl;
      }
    });
  }, [groups, gi, ii]);

  if (!group || !item || typeof document === "undefined") return null;

  /** Emoji tap: float the reaction in-story. Send button: attach the clip in chat. */
  const onReact = async (emoji: string, openChat = false) => {
    if (openChat) {
      try {
        const res: any = await react({ data: { storyId: item.id, clipOnly: true } });
        if (res?.peerId && !res.skipped) {
          onClose();
          window.location.href = `/?section=Messages&dm=${res.peerId}`;
        }
      } catch {
        /* silent */
      }
      return;
    }
    setSent(emoji);
    // Floating burst from the reaction stack upward.
    const burst = Array.from({ length: 5 }, (_, k) => ({
      id: Date.now() + k,
      emoji,
      x: Math.round((Math.random() - 0.5) * 120),
    }));
    setFloats((f) => [...f, ...burst]);
    window.setTimeout(() => {
      setFloats((f) => f.filter((x) => !burst.some((b) => b.id === x.id)));
    }, 2200);
    try {
      await react({ data: { storyId: item.id, emoji } });
    } catch {
      /* silent */
    }
  };



  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex h-full w-full max-w-[440px] flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-3">
          {group.items.map((s, i) => (
            <span key={s.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: i < ii ? "100%" : i === ii ? `${elapsed * 100}%` : "0%" }}
              />
            </span>
          ))}
        </div>

        {/* Header */}
        <div className="absolute left-0 right-0 top-6 z-20 flex items-center gap-2.5 px-4 pt-2">
          <a
            href={`/profile/${group.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-w-0 items-center gap-2.5 active:scale-[0.98] transition-transform"
          >
            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-[#E5484D]">
              <AvatarImage src={group.avatarUrl} alt={group.displayName} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-white">{group.displayName}</p>
              <p className="text-[11px] text-white/55">{timeAgo(item.createdAt)} ago</p>
            </div>
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close story"
            className="ml-auto grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Media */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          {item.mediaType === "video" ? (
            <video
              key={item.id}
              ref={videoRef}
              src={item.mediaUrl}
              poster={item.posterUrl ?? undefined}
              autoPlay
              muted={false}
              playsInline
              preload="auto"
              className="max-h-full w-full object-contain"
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setElapsed(Math.min(1, v.currentTime / v.duration));
              }}
              onEnded={next}
            />
          ) : (
            <img loading="lazy"
              key={item.id}
              src={item.mediaUrl}
              alt=""
              decoding="async"
              fetchPriority="high"
              className="max-h-full w-full object-contain"
            />
          )}

          <button
            type="button"
            aria-label="Previous"
            onClick={prev}
            className="absolute inset-y-0 left-0 w-1/3"
          />
          <button
            type="button"
            aria-label="Next"
            onClick={next}
            className="absolute inset-y-0 right-0 w-1/3"
          />
        </div>

        {/* Floating reactions — drift from the stack upward */}
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 h-1/2 overflow-hidden">
          {floats.map((f, idx) => (
            <span
              key={f.id}
              className="absolute bottom-0 left-1/2 text-[26px] story-float"
              style={{
                ["--tx" as never]: `${f.x}px`,
                animationDelay: `${idx * 90}ms`,
              }}

            >
              {f.emoji}
            </span>
          ))}
        </div>

        {/* Reaction stack */}

        {!group.isMe && (
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6">
            <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-3 backdrop-blur-md">
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onReact(r)}
                  className={`grid h-11 w-11 place-items-center rounded-full text-[19px] transition-transform active:scale-90 ${
                    sent === r ? "scale-110 bg-[#E5484D]/25" : "hover:bg-white/10"
                  }`}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onReact("💬", true)}
                aria-label="Reply in chat"
                className="ml-1 grid h-11 w-11 place-items-center rounded-full bg-[#E5484D] text-white active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>

            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
