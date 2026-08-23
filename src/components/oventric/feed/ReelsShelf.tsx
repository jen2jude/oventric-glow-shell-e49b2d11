import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Play, Eye } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { StoryViewerModal } from "@/components/oventric/feed/StoryViewerModal";
import { listReels, type ReelItem, type StoryGroup } from "@/lib/stories.functions";

export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 >= 100_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 >= 100 ? 1 : 0)}K`;
  return String(n);
}

/** Load reels (all-time stories) — optionally scoped to one author. */
export function useReels(enabled: boolean, slugOrId?: string, limit?: number) {
  const load = useServerFn(listReels);
  const [reels, setReels] = useState<ReelItem[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    (async () => {
      try {
        const r = await load({ data: { slugOrId, limit } });
        if (!cancel) setReels(r.reels);
      } catch {
        if (!cancel) setReels([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [enabled, load, slugOrId, limit]);
  return reels;
}

/** Each reel becomes its own single-item "group" so the story viewer can play it. */
export function reelsToGroups(reels: ReelItem[], meId?: string | null): StoryGroup[] {
  return reels.map((r) => ({
    userId: r.userId,
    slug: r.slug,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    isMe: !!meId && r.userId === meId,
    allViewed: false,
    items: [
      {
        id: r.id,
        mediaUrl: r.mediaUrl,
        mediaType: r.mediaType,
        posterUrl: r.posterUrl,
        createdAt: r.createdAt,
        expiresAt: r.createdAt,
        viewed: false,
      },
    ],
  }));
}

function Thumb({ reel }: { reel: ReelItem }) {
  return reel.mediaType === "video" ? (
    reel.posterUrl ? (
      <img
        loading="lazy"
        decoding="async"
        src={reel.posterUrl}
        alt=""
        className="h-full w-full object-cover"
      />
    ) : (
      <video
        src={`${reel.mediaUrl}#t=0.1`}
        muted
        playsInline
        preload="none"
        className="h-full w-full object-cover"
      />
    )
  ) : (
    <img
      loading="lazy"
      decoding="async"
      src={reel.mediaUrl}
      alt=""
      className="h-full w-full object-cover"
    />
  );
}

function ViewsBadge({ count }: { count: number }) {
  return (
    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
      <Eye className="h-3 w-3" strokeWidth={2.4} />
      {formatViews(count)}
    </span>
  );
}

/** Horizontal Discover rail of reels with live view counts. */
export function ReelsRail({ reels, meId }: { reels: ReelItem[]; meId?: string | null }) {
  const [at, setAt] = useState<number | null>(null);
  const groups = useMemo(() => reelsToGroups(reels, meId), [reels, meId]);
  if (reels.length === 0) return null;
  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {reels.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setAt(i)}
            className="relative h-[210px] w-[132px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#141416] text-left active:scale-[0.98]"
          >
            <Thumb reel={r} />
            <ViewsBadge count={r.viewCount} />
            {r.mediaType === "video" && (
              <span className="absolute right-2 top-2 rounded-full bg-black/55 p-1 backdrop-blur-sm">
                <Play className="h-3 w-3 fill-white text-white" />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5">
              <span className="flex items-center gap-1.5">
                <span className="h-6 w-6 overflow-hidden rounded-full ring-1 ring-[#E5484D]">
                  <AvatarImage src={r.avatarUrl} alt={r.displayName} />
                </span>
                <span className="truncate text-[11.5px] font-semibold text-white">
                  {r.displayName.split(" ")[0]}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
      {at !== null && (
        <StoryViewerModal groups={groups} startIndex={at} onClose={() => setAt(null)} />
      )}
    </>
  );
}

/** Clean 3-up grid of a member's reels for their profile. */
export function ReelsGrid({ reels, meId }: { reels: ReelItem[]; meId?: string | null }) {
  const [at, setAt] = useState<number | null>(null);
  const groups = useMemo(() => reelsToGroups(reels, meId), [reels, meId]);
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 md:gap-3">
        {reels.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setAt(i)}
            className="relative aspect-[9/16] overflow-hidden rounded-[10px] border border-white/10 md:border-slate-200 bg-[#141416] md:bg-slate-100 active:scale-[0.98]"
          >
            <Thumb reel={r} />
            <ViewsBadge count={r.viewCount} />
            {r.mediaType === "video" && (
              <span className="absolute right-2 top-2 rounded-full bg-black/55 p-1 backdrop-blur-sm">
                <Play className="h-3 w-3 fill-white text-white" />
              </span>
            )}
          </button>
        ))}
      </div>
      {at !== null && (
        <StoryViewerModal groups={groups} startIndex={at} onClose={() => setAt(null)} />
      )}
    </>
  );
}
