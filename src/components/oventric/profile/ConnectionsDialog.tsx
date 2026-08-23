import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  MoreHorizontal,
  Loader2,
  UserRound,
  MessageCircle,
  Store,
  Ban,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { FollowButton } from "@/components/oventric/FollowButton";
import {
  listFollowers,
  listFollowing,
  listSuggestedFollows,
  unfollow,
  type PersonSummary,
} from "@/lib/follows.functions";
import { blockUser } from "@/lib/blocks.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePresence } from "@/hooks/use-presence";

export type ConnectionsTab = "all" | "following" | "followers" | "suggested";

const TABS: { key: ConnectionsTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "following", label: "Following" },
  { key: "followers", label: "Followers" },
  { key: "suggested", label: "Suggested" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whose connections we're browsing. */
  userId: string;
  name: string;
  viewerId: string | null;
  initialTab?: ConnectionsTab;
}

/**
 * Full-screen connections browser: All / Following / Followers / Suggested
 * with live search and per-row relationship actions.
 */
export function ConnectionsDialog({
  open,
  onOpenChange,
  userId,
  name,
  viewerId,
  initialTab = "followers",
}: Props) {
  const navigate = useNavigate();
  const presence = usePresence();
  const online = presence.online;
  const fetchFollowers = useServerFn(listFollowers);
  const fetchFollowing = useServerFn(listFollowing);
  const fetchSuggested = useServerFn(listSuggestedFollows);
  const unfollowFn = useServerFn(unfollow);
  const block = useServerFn(blockUser);

  const [tab, setTab] = useState<ConnectionsTab>(initialTab);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followers, setFollowers] = useState<PersonSummary[] | null>(null);
  const [following, setFollowing] = useState<PersonSummary[] | null>(null);
  const [suggested, setSuggested] = useState<PersonSummary[] | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f1, f2] = await Promise.all([
        fetchFollowers({ data: { userId } }),
        fetchFollowing({ data: { userId } }),
      ]);
      setFollowers(f1);
      setFollowing(f2);
    } catch {
      setError("Couldn't load connections right now.");
    } finally {
      setLoading(false);
    }
  }, [fetchFollowers, fetchFollowing, userId]);

  useEffect(() => {
    if (!open) return;
    setHidden(new Set());
    loadCore();
  }, [open, loadCore]);

  useEffect(() => {
    if (!open || tab !== "suggested" || suggested !== null) return;
    let cancelled = false;
    setLoading(true);
    fetchSuggested({ data: { limit: 30 } })
      .then((rows) => {
        if (!cancelled) setSuggested(rows);
      })
      .catch(() => {
        if (!cancelled) setSuggested([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab, suggested, fetchSuggested]);

  const all = useMemo(() => {
    const map = new Map<string, PersonSummary>();
    (followers ?? []).forEach((p) => map.set(p.userId, p));
    (following ?? []).forEach((p) => map.set(p.userId, p));
    return [...map.values()];
  }, [followers, following]);

  const followingIds = useMemo(
    () => new Set((following ?? []).map((p) => p.userId)),
    [following],
  );

  const source =
    tab === "all"
      ? all
      : tab === "followers"
        ? (followers ?? [])
        : tab === "following"
          ? (following ?? [])
          : (suggested ?? []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return source
      .filter((p) => !hidden.has(p.userId))
      .filter(
        (p) =>
          !needle ||
          p.displayName.toLowerCase().includes(needle) ||
          (p.username ?? "").toLowerCase().includes(needle),
      );
  }, [source, q, hidden]);

  const counts: Record<ConnectionsTab, number> = {
    all: all.length,
    following: following?.length ?? 0,
    followers: followers?.length ?? 0,
    suggested: suggested?.length ?? 0,
  };

  const doUnfollow = async (p: PersonSummary) => {
    setBusyId(p.userId);
    try {
      await unfollowFn({ data: { targetId: p.userId } });
      setFollowing((cur) => (cur ?? []).filter((x) => x.userId !== p.userId));
      toast.success(`Unfollowed ${p.displayName}`);
    } catch {
      toast.error("Couldn't unfollow right now");
    } finally {
      setBusyId(null);
    }
  };

  const doBlock = async (p: PersonSummary) => {
    setBusyId(p.userId);
    try {
      await block({ data: { targetId: p.userId } });
      setHidden((s) => new Set(s).add(p.userId));
      toast.success(`Blocked ${p.displayName}`);
    } catch {
      toast.error("Couldn't block this member");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name}'s connections`}
      className="fixed inset-0 z-[80] flex flex-col bg-[#0A0A0B] text-white"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close connections"
          className="grid h-11 w-11 place-items-center rounded-full text-slate-300 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-center text-base font-black">{name}</h2>
        <span className="h-11 w-11" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={active}
              className={`shrink-0 rounded-full px-4 py-3 text-sm font-bold transition-colors ${
                active
                  ? "bg-[#E5484D] text-white"
                  : "bg-white/8 text-slate-300 hover:bg-white/12"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search people"
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <p className="px-4 pb-2 text-sm font-black text-white">
        {tab === "suggested"
          ? `${counts.suggested} suggested`
          : `${counts[tab].toLocaleString()} ${tab === "all" ? "connections" : tab}`}
      </p>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-8">
        {error ? (
          <div className="p-6 text-center text-sm text-slate-400">
            {error}
            <button
              onClick={loadCore}
              className="ml-2 font-bold text-[#E5484D] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading people…
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            {q ? "No one matches that search." : "Nothing to show here yet."}
          </p>
        ) : (
          <ul>
            {rows.map((p) => {
              const to = p.slug || p.userId;
              return (
                <li
                  key={p.userId}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04]"
                >
                  <Link
                    to="/profile/$id"
                    params={{ id: to }}
                    onClick={() => onOpenChange(false)}
                    className="relative shrink-0"
                    aria-label={`Open ${p.displayName}'s profile`}
                  >
                    <span className="block h-12 w-12 overflow-hidden rounded-full">
                      <AvatarImage src={p.avatarUrl} alt={p.displayName} />
                    </span>
                    {online.has(p.userId) && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#0A0A0B]" />
                    )}
                  </Link>
                  <Link
                    to="/profile/$id"
                    params={{ id: to }}
                    onClick={() => onOpenChange(false)}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate text-[15px] font-bold text-white">
                      {p.displayName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {p.username ? `@${p.username}` : (p.bio ?? "Oventric member")}
                    </span>
                    <span
                      className={`block truncate text-[11px] font-semibold ${
                        online.has(p.userId) ? "text-emerald-400" : "text-slate-600"
                      }`}
                    >
                      {online.has(p.userId)
                        ? "Online now"
                        : (presence.lastSeenLabel(p.userId) ?? "Offline")}
                    </span>
                  </Link>

                  {tab === "following" && viewerId === userId ? (
                    <button
                      type="button"
                      disabled={busyId === p.userId}
                      onClick={() => doUnfollow(p)}
                      className="shrink-0 rounded-[10px] bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/16 disabled:opacity-60"
                    >
                      {busyId === p.userId ? "…" : "Unfollow"}
                    </button>
                  ) : tab === "followers" || tab === "suggested" ? (
                    viewerId && viewerId !== p.userId ? (
                      <FollowButton
                        targetId={p.userId}
                        compact
                        className="!px-3 !py-1.5 !text-xs shrink-0"
                      />
                    ) : null
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`More options for ${p.displayName}`}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={6}
                        collisionPadding={12}
                        className="z-[120] w-52"
                      >
                        <DropdownMenuItem
                          onClick={() => {
                            onOpenChange(false);
                            navigate({ to: "/profile/$id", params: { id: to } });
                          }}
                        >
                          <UserRound className="mr-2 h-4 w-4" /> See profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            onOpenChange(false);
                            navigate({
                              to: "/",
                              search: { section: "Messages", dm: p.userId } as never,
                            });
                          }}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" /> Send message
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            onOpenChange(false);
                            navigate({
                              to: "/profile/$id",
                              params: { id: to },
                              search: { tab: "marketplace" } as never,
                            });
                          }}
                        >
                          <Store className="mr-2 h-4 w-4" /> View shop
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-[#E5484D] focus:text-[#E5484D]"
                          disabled={!viewerId || viewerId === p.userId}
                          onClick={() => doBlock(p)}
                        >
                          <Ban className="mr-2 h-4 w-4" /> Block user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {tab === "following" && viewerId !== userId && followingIds.has(p.userId) && null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
