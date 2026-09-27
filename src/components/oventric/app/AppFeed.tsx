import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  Share2,
  Play,
  Loader2,
  ShoppingBag,
  MoreHorizontal,
  Eye,
  EyeOff,
  Link2,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppSheet } from "@/components/oventric/app/AppSheet";
import { listPosts, toggleLike, setPostSaved as setPostSavedFn, deletePost as deletePostFn, updatePostText as updatePostTextFn } from "@/lib/posts.functions";
import { listFollowing, listFollowers } from "@/lib/follows.functions";
import { listProducts } from "@/lib/marketplace.functions";
import { ProductQuickView } from "./ProductQuickView";
import { EDIT_WINDOW_MS } from "@/lib/post-edit";
import { togglePostSet, getSavedPosts } from "@/components/oventric/PostActionsMenu";
import { ReportModal } from "@/components/oventric/ReportModal";
import { CommentsSheet } from "@/components/oventric/feed/CommentsSheet";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";

type Post = Awaited<ReturnType<typeof listPosts>>["posts"][number];

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

/** Native app feed: X-style vertical timeline of compact post cards. */
export function AppFeed() {
  const fetchPosts = useServerFn(listPosts);
  const like = useServerFn(toggleLike);
  const saveFn = useServerFn(setPostSavedFn);
  const deleteFn = useServerFn(deletePostFn);
  const updateText = useServerFn(updatePostTextFn);
  const navigate = useNavigate();
  const { openGate } = useAuthGate() as any;
  const { baseCurrency } = useOnboarding();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : getSavedPosts(),
  );
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const [menuFor, setMenuFor] = useState<Post | null>(null);
  const [reportFor, setReportFor] = useState<Post | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<{ id: string; text: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [followingIds, setFollowingIds] = useState<Set<string> | null>(null);
  const [followerIds, setFollowerIds] = useState<Set<string> | null>(null);
  const loadFollowing = useServerFn(listFollowing);
  const loadFollowers = useServerFn(listFollowers);

  const saveEdit = async () => {
    if (!editingPost) return;
    const { id, text } = editingPost;
    setEditSaving(true);
    try {
      await updateText({ data: { id, text: text.trim() } });
      setPosts((xs) => xs!.map((x) => (x.id === id ? { ...x, text: text.trim() } : x)));
      setEditingPost(null);
      toast.success("Post updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update this post");
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    fetchPosts()
      .then((r) => setPosts(r.posts.filter((p) => !p.repost_of || p.text || p.media_url)))
      .catch(() => setPosts([]));
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setUserId(data.session?.user.id ?? null);
    });
  }, [fetchPosts]);

  // Both sides of the user's network power the Following tab (same as web).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      loadFollowing({ data: { userId } }),
      loadFollowers({ data: { userId } }),
    ])
      .then(([following, followers]) => {
        if (cancelled) return;
        setFollowingIds(new Set((following ?? []).map((r: any) => r.userId ?? r.user_id ?? r.id)));
        setFollowerIds(new Set((followers ?? []).map((r: any) => r.userId ?? r.user_id ?? r.id)));
      })
      .catch(() => {
        setFollowingIds(new Set());
        setFollowerIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [userId, loadFollowing, loadFollowers]);

  const onLike = async (p: Post) => {
    if (!signedIn) return openGate?.("generic");
    haptic("select");
    const next = !p.viewer_liked;
    setPosts((xs) =>
      xs!.map((x) =>
        x.id === p.id ? { ...x, viewer_liked: next, likes_count: x.likes_count + (next ? 1 : -1) } : x,
      ),
    );
    try {
      await like({ data: { postId: p.id, like: next } });
    } catch {
      setPosts((xs) =>
        xs!.map((x) =>
          x.id === p.id ? { ...x, viewer_liked: !next, likes_count: x.likes_count + (next ? -1 : 1) } : x,
        ),
      );
    }
  };

  const onShare = async (p: Post) => {
    const url = `${window.location.origin}/post/${p.id}`;
    haptic("light");
    try {
      if (navigator.share) await navigator.share({ title: p.author_name, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* dismissed */
    }
  };

  const openAuthor = (p: Post) => {
    if (p.author_slug || p.author_id)
      navigate({ to: "/profile/$id", params: { id: p.author_slug ?? p.author_id } });
  };

  if (!posts) {
    return (
      <div className="flex h-[calc(100dvh-80px)] items-center justify-center bg-[#070A08]">
        <Loader2 className="h-6 w-6 animate-spin text-[#E5484D]" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-80px)] items-center justify-center bg-[#070A08] px-8 text-center text-[13px] text-white/50">
        No posts yet — tap + to share the first one.
      </div>
    );
  }

  const visiblePosts = posts
    .filter((p) => !hidden.has(p.id))
    .filter((p) => {
      if (tab !== "following") return true;
      if (!followingIds || !followerIds) return true; // still loading
      return followingIds.has(p.author_id) || followerIds.has(p.author_id);
    });

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#070A08] pb-24">
      {/* Timeline header + tabs */}
      <div className="sticky top-0 z-10 border-b border-white/5 bg-[#070A08]/90 backdrop-blur">
        <div className="flex items-center justify-center gap-8 py-2.5">
          {(
            [
              { key: "foryou", label: "For you" },
              { key: "following", label: "Following" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                haptic("select");
                setTab(t.key);
              }}
              className="relative pb-1 text-[13px] font-bold tracking-wide"
              style={{ color: tab === t.key ? "#ffffff" : "rgba(255,255,255,0.4)" }}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute -bottom-[1px] left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-[#E5484D]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {visiblePosts.length === 0 && (
        <div className="flex items-center justify-center px-8 py-20 text-center text-[13px] text-white/50">
          {tab === "following"
            ? "No posts from people you follow yet — follow creators to fill this feed."
            : "No posts yet — tap + to share the first one."}
        </div>
      )}

      <div className="divide-y divide-white/5">
        {visiblePosts.map((p) => {
          const img = p.media_type === "video" ? p.poster_url : p.media_url;
          return (
            <article key={p.id} className="px-4 py-3 active:bg-white/[0.02]">
              {/* Header row */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => openAuthor(p)}
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
                  aria-label={`Open ${p.author_name}`}
                >
                  {p.author_avatar_url ? (
                    <img src={p.author_avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center bg-[#E5484D] text-[12px] font-bold"
                      style={{ color: "#ffffff" }}
                    >
                      {p.initials}
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <button
                      onClick={() => openAuthor(p)}
                      className="truncate text-[14px] font-bold"
                      style={{ color: "#ffffff" }}
                    >
                      {p.author_name}
                    </button>
                    <span className="shrink-0 text-[12px] text-white/40">· {ago(p.created_at)}</span>
                  </div>

                  {/* Text — long posts truncate with a View more toggle */}
                  {p.text &&
                    (p.text.length > 240 ? (
                      <div className="mt-0.5">
                        <p
                          className={`whitespace-pre-line text-[14px] leading-snug text-white/90 ${
                            expanded.has(p.id) ? "" : "line-clamp-5"
                          }`}
                        >
                          {p.text}
                        </p>
                        <button
                          onClick={() =>
                            setExpanded((s) => {
                              const n = new Set(s);
                              if (n.has(p.id)) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                          className="mt-1 text-[13px] font-semibold text-[#E5484D]"
                        >
                          {expanded.has(p.id) ? "Show less" : "View more"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-0.5 whitespace-pre-line text-[14px] leading-snug text-white/90">
                        {p.text}
                      </p>
                    ))}

                  {/* Media */}
                  {img && (
                    <button
                      onClick={() => navigate({ to: "/post/$id", params: { id: p.id } })}
                      className="relative mt-2.5 block w-full overflow-hidden rounded-2xl border border-white/10"
                      aria-label="Open post"
                    >
                      <img src={img} alt="" loading="lazy" className="w-full object-cover" />
                      {p.media_type === "video" && (
                        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 backdrop-blur">
                          <Play className="h-5 w-5 fill-current" style={{ color: "#ffffff" }} />
                        </span>
                      )}
                    </button>
                  )}

                  {/* Product attachment — rich card, matches the web feed */}
                  {p.product_attachments?.[0] && (() => {
                    const pa = p.product_attachments![0];
                    if (pa.available === false) {
                      return (
                        <div className="mt-2.5 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04]">
                            <ShoppingBag className="h-4 w-4 text-white/20" />
                          </div>
                          <p className="text-[12px] font-semibold text-white/60">
                            This product is no longer available
                          </p>
                        </div>
                      );
                    }
                    const priceLabel = computeDisplayPrice(
                      {
                        price_usd: pa.priceUsd,
                        original_currency: (pa.originalCurrency ?? "USD") as any,
                        original_amount: pa.originalAmount ?? pa.priceUsd,
                        fx_snapshot: pa.fxSnapshot ?? null,
                      },
                      baseCurrency,
                    ).formatted;
                    return (
                      <button
                        onClick={() =>
                          navigate({ to: "/product/$id", params: { id: pa.id } })
                        }
                        className="mt-2.5 flex w-full items-stretch overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left active:bg-white/[0.06]"
                      >
                        <div className="w-20 shrink-0 bg-neutral-900">
                          {pa.coverUrl ? (
                            <img
                              src={pa.coverUrl}
                              alt={pa.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ShoppingBag className="h-5 w-5 text-white/10" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-1 text-[13px] font-bold text-white">
                              {pa.name}
                            </p>
                            <span className="shrink-0 text-[13px] font-black text-[#E5484D]">
                              {priceLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/45">
                            {pa.shortDescription || pa.vendor}
                          </p>
                          {!!pa.cashbackPct && pa.cashbackPct > 0 && (
                            <span className="mt-1 inline-block rounded-md border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              {pa.cashbackPct}% cashback
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })()}

                  {/* Action row */}
                  <div className="mt-2 flex items-center justify-between pr-2">
                    <button
                      onClick={() => setCommentsFor(p)}
                      className="flex items-center gap-1.5 text-white/45 active:text-[#E5484D]"
                      aria-label="Comments"
                    >
                      <MessageCircle className="h-[18px] w-[18px]" />
                      <span className="text-[12px] font-medium">{compact(p.comments_count)}</span>
                    </button>
                    <span className="flex items-center gap-1.5 text-white/45" aria-label="Views">
                      <Eye className="h-[18px] w-[18px]" />
                      <span className="text-[12px] font-medium">{compact(p.views_count)}</span>
                    </span>
                    <button
                      onClick={() => onLike(p)}
                      className={`flex items-center gap-1.5 ${p.viewer_liked ? "text-[#E5484D]" : "text-white/45"} active:text-[#E5484D]`}
                      aria-label="Like"
                    >
                      <Heart className={`h-[18px] w-[18px] ${p.viewer_liked ? "fill-[#E5484D]" : ""}`} />
                      <span className="text-[12px] font-medium">{compact(p.likes_count)}</span>
                    </button>
                    <button
                      onClick={() => onShare(p)}
                      className="flex items-center gap-1.5 text-white/45 active:text-[#E5484D]"
                      aria-label="Share"
                    >
                      <Share2 className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setMenuFor(p)}
                  className="-mr-2 shrink-0 rounded-full p-1.5 text-white/40 active:bg-white/10"
                  aria-label="More options"
                >
                  <MoreHorizontal className="h-[18px] w-[18px]" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {menuFor && (() => {
        const post = menuFor;
        const isOwn = !!userId && post.author_id === userId;
        const saved = savedIds.has(post.id);
        const run = (fn: () => void) => {
          setMenuFor(null);
          fn();
        };
        const toggleSave = () => {
          if (!signedIn) return openGate?.("generic");
          haptic("light");
          const next = !saved;
          setSavedIds((s) => {
            const n = new Set(s);
            if (next) n.add(post.id);
            else n.delete(post.id);
            return n;
          });
          togglePostSet("saved", post.id, next);
          saveFn({ data: { postId: post.id, saved: next } })
            .then(() => toast.success(next ? "Saved to your bookmarks." : "Removed from saved."))
            .catch(() => {
              setSavedIds((s) => {
                const n = new Set(s);
                if (next) n.delete(post.id);
                else n.add(post.id);
                return n;
              });
              togglePostSet("saved", post.id, !next);
              toast.error("Couldn't update your saved posts");
            });
        };
        const hide = (msg: string) => {
          haptic("select");
          setHidden((s) => new Set(s).add(post.id));
          togglePostSet("hidden", post.id, true);
          toast.success(msg);
        };
        const items: { icon: React.ElementType; label: string; sub?: string; danger?: boolean; action: () => void }[] = [
          { icon: Bookmark, label: saved ? "Unsave" : "Save", sub: "Add this to your saved items", action: toggleSave },
          {
            icon: ThumbsDown,
            label: "See less content like this",
            action: () => {
              togglePostSet("interested", post.id, false);
              hide("Thanks — we'll show less like this.");
            },
          },
          { icon: EyeOff, label: "Hide post", action: () => hide("Post hidden from your feed.") },
          {
            icon: ThumbsUp,
            label: "Interested",
            action: () => {
              haptic("select");
              togglePostSet("interested", post.id, true);
              togglePostSet("hidden", post.id, false);
              toast.success("Got it — we'll show more like this.");
            },
          },
          {
            icon: Share2,
            label: "Share",
            action: () => {
              haptic("light");
              void onShare(post);
            },
          },
          {
            icon: Link2,
            label: "Copy link",
            action: () => {
              haptic("light");
              navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`).then(() => toast.success("Link copied"));
            },
          },
          { icon: Eye, label: "View post", action: () => navigate({ to: "/post/$id", params: { id: post.id } }) },
          { icon: Flag, label: "Report this", danger: true, action: () => setReportFor(post) },
        ];
        if (isOwn) {
          const withinEditWindow =
            Date.now() - new Date(post.created_at).getTime() < EDIT_WINDOW_MS;
          if (withinEditWindow) {
            items.push({
              icon: Pencil,
              label: "Edit post",
              sub: "You can edit within 10 minutes of sharing",
              action: () => setEditingPost({ id: post.id, text: post.text ?? "" }),
            });
          }
          items.push({
            icon: Trash2,
            label: "Delete post",
            danger: true,
            action: () => {
              if (!window.confirm("Delete this post permanently?")) return;
              deleteFn({ data: { id: post.id } })
                .then(() => {
                  setPosts((xs) => xs!.filter((x) => x.id !== post.id));
                  toast.success("Post deleted.");
                })
                .catch(() => toast.error("Couldn't delete this post"));
            },
          });
        }
        return (
          <AppSheet open onClose={() => setMenuFor(null)}>
            <div className="px-2 pb-10 pt-1">
              <div className="px-4 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-white/40">
                More options
              </div>
              {items.map(({ icon: Icon, label, sub, danger, action }) => (
                <button
                  key={label}
                  onClick={() => run(action)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left active:bg-white/10"
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${danger ? "text-[#ff6369]" : "text-white/50"}`} />
                  <span className="min-w-0">
                    <span className={`block text-[14px] font-medium ${danger ? "text-[#ff6369]" : "text-white/85"}`}>
                      {label}
                    </span>
                    {sub ? <span className="block text-[11.5px] text-white/40">{sub}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </AppSheet>
        );
      })()}

      <ReportModal
        open={!!reportFor}
        onClose={() => setReportFor(null)}
        target="post"
        targetKind="post"
        targetId={reportFor?.id}
        onReported={(id) => {
          toast.success("Report submitted. Thank you.");
          setHidden((s) => new Set(s).add(id));
          togglePostSet("hidden", id, true);
        }}
      />

      {editingPost && (
        <AppSheet open onClose={() => (editSaving ? null : setEditingPost(null))}>
          <div className="px-4 pb-10 pt-1">
            <div className="px-1 pb-1 pt-2 text-[15px] font-bold" style={{ color: "#ffffff" }}>
              Edit post
            </div>
            <p className="px-1 pb-3 text-[12px] text-white/40">
              You can edit a post within 10 minutes of sharing it.
            </p>
            <textarea
              value={editingPost.text}
              onChange={(e) =>
                setEditingPost((prev) => (prev ? { ...prev, text: e.target.value } : prev))
              }
              rows={5}
              maxLength={4000}
              autoFocus
              className="w-full resize-none rounded-[10px] border border-white/10 bg-white/[0.06] p-3 text-[14px] leading-snug outline-none focus:border-[#E5484D]"
              style={{ color: "#ffffff" }}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditingPost(null)}
                className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white/60 active:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving || !editingPost.text.trim()}
                onClick={() => void saveEdit()}
                className="flex items-center gap-1.5 rounded-[10px] bg-[#E5484D] px-4 py-2 text-[13px] font-semibold hover:brightness-95 disabled:opacity-50"
                style={{ color: "#ffffff" }}
              >
                {editSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </AppSheet>
      )}

      {commentsFor && (
        <CommentsSheet
          postId={commentsFor.id}
          postAuthorName={commentsFor.author_name}
          onClose={() => setCommentsFor(null)}
          viewerName="You"
          viewerInitials="OV"
        />
      )}
    </div>
  );
}
