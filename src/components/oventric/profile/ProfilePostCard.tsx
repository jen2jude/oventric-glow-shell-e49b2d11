import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { toggleLike } from "@/lib/posts.functions";
import type { ProfilePost } from "@/lib/profiles/mockProfiles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  post: ProfilePost;
  profileId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  itemSearch?: Record<string, unknown>;
}

/**
 * Feed-style post card used on the profile "Posts" wall — avatar + name +
 * time, post text, optional media, and a reaction row. Matches the app's
 * crimson accent and dark card treatment.
 */
export function ProfilePostCard({
  post,
  profileId,
  authorName,
  authorAvatarUrl,
  itemSearch,
}: Props) {
  const like = useServerFn(toggleLike);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSaved] = useState(false);

  const media = post.mediaUrls ?? [];
  const isVideo = post.mediaType === "video" && media.length === 1;

  const onLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      await like({ data: { postId: post.id, like: next } });
    } catch {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
    }
  };

  const onShare = async () => {
    const url = `${window.location.origin}/profile/${profileId}/item/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: authorName, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* user dismissed the share sheet */
    }
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-[#141418] md:web-card">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Link
          to="/profile/$id"
          params={{ id: profileId }}
          className="block h-11 w-11 shrink-0 overflow-hidden rounded-full"
          aria-label={`Open ${authorName}'s profile`}
        >
          <AvatarImage src={authorAvatarUrl} alt={authorName} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white md:text-slate-900">{authorName}</p>
          <p className="text-[11px] text-slate-500">{post.timeAgo}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white md:hover:bg-slate-100 md:hover:text-slate-900"
            aria-label="Post options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[120]">
            <DropdownMenuItem asChild>
              <Link
                to="/profile/$id/item/$kind/$itemId"
                params={{ id: profileId, kind: "post", itemId: post.id }}
                search={itemSearch as never}
              >
                Open post
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}>Copy / share link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {post.content && (
        <Link
          to="/profile/$id/item/$kind/$itemId"
          params={{ id: profileId, kind: "post", itemId: post.id }}
          search={itemSearch as never}
          className="block px-4 pt-3 text-[15px] leading-relaxed text-slate-200 md:text-slate-800"
        >
          {post.content}
        </Link>
      )}

      {media.length > 0 && (
        <div className="px-4 pt-3">
          {isVideo ? (
            <video
              src={media[0]}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-xl bg-black"
            />
          ) : media.length === 1 ? (
            <img loading="lazy" decoding="async"
              src={media[0]}
              alt=""
              className="w-full rounded-xl object-cover"
            />
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {media.slice(0, 4).map((m, i) => (
                <img loading="lazy" decoding="async"
                  key={m + i}
                  src={m}
                  alt=""
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="flex items-center gap-5 px-4 py-3">
        <button
          type="button"
          onClick={onLike}
          aria-pressed={liked}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 transition-colors hover:text-[#E5484D]"
        >
          <Heart
            className={`h-5 w-5 ${liked ? "fill-[#E5484D] text-[#E5484D]" : ""}`}
            aria-hidden
          />
          {likes}
        </button>
        <Link
          to="/profile/$id/item/$kind/$itemId"
          params={{ id: profileId, kind: "post", itemId: post.id }}
          search={itemSearch as never}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white md:hover:text-slate-900"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {post.comments}
        </Link>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white md:hover:text-slate-900"
        >
          <Share2 className="h-5 w-5" aria-hidden />
          Share
        </button>
        <button
          type="button"
          onClick={() => setSaved((s) => !s)}
          aria-pressed={saved}
          aria-label="Save post"
          className="ml-auto text-slate-400 hover:text-white md:hover:text-slate-900"
        >
          <Bookmark className={`h-5 w-5 ${saved ? "fill-current text-[#E5484D]" : ""}`} />
        </button>
      </footer>
    </article>
  );
}
