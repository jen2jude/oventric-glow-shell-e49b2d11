import { ShowcaseEngagement } from "@/components/oventric/creators/ShowcaseEngagement";
import { useRef } from "react";
import { logCreatorEvent, useWatchTime } from "@/lib/creator-events";
import { useNavigate } from "@tanstack/react-router";
import { Download, Eye } from "lucide-react";
import { CreatorPostActions, CreatorPostDetails, CreatorProductAttachment, CreatorResourceCard } from "@/components/oventric/creators/CreatorResourceCard";
import { AppSheet } from "@/components/oventric/app/AppSheet";
import type { CreatorPostDTO } from "@/lib/creators.functions";
import { haptic } from "@/lib/haptics";

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Creator showcase detail panel — slides up when a creator post's media or CTA
 * is tapped. The video restarts with sound at the top; creator identity,
 * caption and stats sit below; the final button downloads free assets
 * instantly or sends paid ones to checkout.
 */
export function CreatorPostSheet({
  post,
  onClose,
}: {
  post: CreatorPostDTO | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const asset = post?.asset ?? null;
  const media = post?.media[0] ?? null;
  const isVideo = media?.type === "video";
  const videoRef = useRef<HTMLVideoElement>(null);
  useWatchTime(videoRef, post?.id, !!post && isVideo);
  const links: { href: string; label: string; kind: "link_click" | "full_video_click" }[] = [];
  if (post?.fullVideoUrl) links.push({ href: post.fullVideoUrl, label: "Full video", kind: "full_video_click" });
  if (post?.communityLink) links.push({ href: post.communityLink, label: "Community", kind: "link_click" });
  if (post?.externalUrl && !post.externalEmbedUrl) links.push({ href: post.externalUrl, label: "Watch", kind: "link_click" });
  for (const w of post?.author.workLinks ?? []) if (w && !links.some((l) => l.href === w)) links.push({ href: w, label: "View work", kind: "link_click" });

  return (
    <AppSheet
      open={!!post}
      onClose={onClose}
      tall
      header={
        post && media ? (
          /* Pinned media — stays put and keeps playing while the body scrolls */
          <div className="bg-black">
            {isVideo ? (
              <video
                ref={videoRef}
                key={post.id}
                src={media.url}
                poster={media.posterUrl ?? undefined}
                autoPlay
                controls
                playsInline
                className="max-h-[40dvh] w-full object-contain"
              />
            ) : (
              <img
                src={media.posterUrl ?? media.url}
                alt={post.title}
                className="max-h-[40dvh] w-full object-cover"
              />
            )}
          </div>
        ) : undefined
      }
    >
      {post && (
        <div className="pb-8" data-post-origin>
          <div className="px-4 pt-4">
            {/* Creator identity */}
            <button
              onClick={() => {
                haptic("select");
                if (post.author.slug) {
                  onClose();
                  navigate({ to: "/profile/$id", params: { id: post.author.slug } });
                }
              }}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10">
                {post.author.avatarUrl ? (
                  <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center bg-[#E5484D] text-[14px] font-bold"
                    style={{ color: "#ffffff" }}
                  >
                    {post.author.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="line-clamp-1 text-[14px] font-bold text-white">{post.author.name}</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-white/40">
                  {ago(post.createdAt)} · {compact(post.viewCount)} views
                </span>
              </span>
            </button>

            {/* Creator fields */}
            {post.fields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {post.fields.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-[#E5484D]/30 bg-[#E5484D]/10 px-2.5 py-1 text-[10px] font-bold text-[#FF7A7E]"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}

            {/* Post details */}
            <h2 className="mt-3 text-[16px] font-bold leading-snug text-white">{post.title}</h2>
            {post.caption && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">{post.caption}</p>
            )}

            {/* Stats */}
            <div className="mt-3 flex items-center gap-4 text-[11px] font-semibold text-white/40">
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> {compact(post.viewCount)} views
              </span>
              {asset && (
                <span className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" /> {compact(asset.downloadCount)} downloads
                </span>
              )}
            </div>

            <CreatorPostDetails post={post} dark />
            <ShowcaseEngagement postId={post.id} authorId={post.author.userId} dark />
            <CreatorPostActions post={post} dark />

            {links.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
                {links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { haptic("select"); logCreatorEvent(post.id, l.kind, { target: l.href }); }}
                    className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/70"
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            )}

            <CreatorProductAttachment post={post} dark />
            <CreatorResourceCard post={post} dark onDone={onClose} />
          </div>
        </div>
      )}
    </AppSheet>
  );
}
