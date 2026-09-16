import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Star, BadgeCheck, ShoppingBag, Loader2, Clock, Check } from "lucide-react";
import {
  sendFollowRequest,
  unfollow,
  getFollowStatus,
  type FollowStatus,
} from "@/lib/follows.functions";
import { getTopSellers, type TopSellerDTO } from "@/lib/marketplace.functions";

type Tab = "top" | "rising" | "followed";

const TABS: { key: Tab; label: string }[] = [
  { key: "top", label: "Top Sellers" },
  { key: "rising", label: "Rising Stars" },
  { key: "followed", label: "Most Followed" },
];

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

/** Full-screen Top Sellers leaderboard — live sales / rating / follower rankings. */
export function TopSellersPanel({
  onClose,
  onOpenShop,
}: {
  onClose: () => void;
  onOpenShop: (slug: string) => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("top");
  const [statuses, setStatuses] = useState<Record<string, FollowStatus>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const fetchSellers = useServerFn(getTopSellers);
  const fetchStatus = useServerFn(getFollowStatus);
  const follow = useServerFn(sendFollowRequest);
  const unfollowFn = useServerFn(unfollow);

  // Hardware / gesture back closes the panel and returns to the previous page.
  useEffect(() => {
    window.history.pushState({ oventricTopSellers: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ["top-sellers", kind],
    queryFn: () => fetchSellers(),
  });

  const all: TopSellerDTO[] = data ?? [];

  const list = useMemo(() => {
    const bySales = [...all].sort((a, b) => b.salesCount - a.salesCount || b.productsCount - a.productsCount);
    if (tab === "top") return bySales.slice(0, 10);
    if (tab === "rising") return bySales.slice(10, 20);
    return [...all].sort((a, b) => b.followersCount - a.followersCount).slice(0, 10);
  }, [all, tab]);

  // Load live follow state for whoever is visible.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = list.filter((s) => statuses[s.id] === undefined);
      if (missing.length === 0) return;
      const results = await Promise.all(
        missing.map(async (s) => {
          try {
            const r = await fetchStatus({ data: { targetId: s.id } });
            return [s.id, r.status] as const;
          } catch {
            return [s.id, "none"] as const;
          }
        }),
      );
      if (!cancelled) setStatuses((p) => ({ ...p, ...Object.fromEntries(results) }));
    })();
    return () => {
      cancelled = true;
    };
  }, [list, statuses, fetchStatus]);

  const toggleFollow = async (s: TopSellerDTO) => {
    const current = statuses[s.id] ?? "none";
    setBusy((b) => ({ ...b, [s.id]: true }));
    try {
      if (current === "following" || current === "mutual") {
        const r = await unfollowFn({ data: { targetId: s.id } });
        setStatuses((p) => ({ ...p, [s.id]: r.status }));
      } else if (current === "requested") {
        setStatuses((p) => ({ ...p, [s.id]: "requested" }));
      } else {
        const r = await follow({ data: { targetId: s.id } });
        setStatuses((p) => ({ ...p, [s.id]: r.status }));
      }
    } catch {
      /* keep previous state */
    } finally {
      setBusy((b) => ({ ...b, [s.id]: false }));
    }
  };

  const followLabel = (st: FollowStatus | undefined) => {
    if (st === "following" || st === "mutual") return "Following";
    if (st === "requested") return "Requested";
    return "Follow";
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0A0A0B]">
      <header className="flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.04] text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight text-white">Top Sellers</h1>
        <span className="w-9" />
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-[10px] px-4 py-3 text-[13px] font-bold transition-colors ${
              tab === t.key ? "bg-[#E5484D] text-white" : "bg-[#141416] text-white/55"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+96px)]">
        {isLoading ? (
          <div className="grid place-items-center py-20 text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-white/40">No sellers in this ranking yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {list.map((s, i) => {
              const rank = tab === "rising" ? i + 11 : i + 1;
              const st = statuses[s.id];
              const isFollowing = st === "following" || st === "mutual";
              const isRequested = st === "requested";
              return (
                <article
                  key={s.id}
                  className="relative rounded-[10px] border border-white/[0.05] bg-[#131316] p-3"
                >
                  <span
                    className={`absolute left-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full text-[11px] font-black ${
                      rank <= 3 ? "bg-[#E5484D] text-white" : "bg-white/[0.08] text-white/70"
                    }`}
                  >
                    {rank}
                  </span>

                  <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-[10.5px] font-bold text-white/70">
                    <ShoppingBag className="h-3 w-3 text-[#E5484D]" />
                    {compact(s.salesCount)}
                  </span>

                  <button
                    type="button"
                    onClick={() => navigate({ to: "/profile/$id", params: { id: s.slug } })}
                    className="mx-auto block h-14 w-14 overflow-hidden rounded-full border border-[#E5484D]/60 bg-black"
                  >
                    {s.avatarUrl ? (
                      <img loading="lazy" decoding="async" src={s.avatarUrl} alt={s.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-[13px] font-black text-white/40">
                        {s.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </button>

                  <div className="mt-2.5 flex items-center justify-center gap-1">
                    <p className="truncate text-[13.5px] font-bold text-white">{s.name}</p>
                    {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-sky-400 text-black" />}
                  </div>
                  <p className="line-clamp-1 text-center text-[11px] text-white/40">{s.bio || "Oventric seller"}</p>

                  <div className="mt-2.5 flex items-center justify-between gap-1 rounded-[10px] bg-white/[0.03] px-2.5 py-2">
                    <div className="text-center">
                      <p className="text-[12px] font-black text-white">{compact(s.followersCount)}</p>
                      <p className="text-[9px] uppercase tracking-wide text-white/35">Followers</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] font-black text-white">{s.productsCount}</p>
                      <p className="text-[9px] uppercase tracking-wide text-white/35">Products</p>
                    </div>
                    <div className="flex items-center gap-0.5 text-[11.5px] font-bold text-white/70">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {s.reviewsCount > 0 ? s.rating.toFixed(1) : "—"}
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleFollow(s)}
                      disabled={busy[s.id]}
                      className={`flex w-full items-center justify-center gap-1 rounded-[10px] border py-3 text-[11.5px] font-bold transition-colors disabled:opacity-60 ${
                        isFollowing
                          ? "border-transparent bg-[#E5484D] text-white"
                          : isRequested
                            ? "border-white/15 bg-white/[0.05] text-white/70"
                            : "border-[#E5484D]/40 bg-transparent text-[#E5484D]"
                      }`}
                    >
                      {busy[s.id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isFollowing ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : isRequested ? (
                        <Clock className="h-3.5 w-3.5" />
                      ) : null}
                      {followLabel(st)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenShop(s.slug)}
                      className="w-full rounded-[10px] border border-white/10 bg-white/[0.03] py-3 text-[11.5px] font-bold text-white"
                    >
                      View Shop
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
