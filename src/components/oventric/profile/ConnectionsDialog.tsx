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
  UsersRound,
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
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange, open]);

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

  const onlineCount = rows.filter((person) => online.has(person.userId)).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name}'s connections`}
      className="web-connections fixed inset-0 z-[80] overflow-y-auto bg-muted/95 px-3 py-3 text-foreground sm:px-6 sm:py-8"
    >
      <div className="mx-auto flex min-h-[min(760px,calc(100dvh-1.5rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[10px] border border-border bg-background shadow-xl sm:min-h-0 sm:max-h-[calc(100dvh-4rem)]">
        <header className="border-b border-border px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
              <UsersRound className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-wallet-display truncate text-xl font-bold sm:text-2xl">Connections</h2>
              <p className="truncate text-xs font-medium text-muted-foreground">{name}&apos;s network</p>
            </div>
            <div className="hidden items-center gap-2 text-xs font-bold text-muted-foreground sm:flex">
              <span className="size-2 rounded-full bg-online" aria-hidden />
              {onlineCount.toLocaleString()} online
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close connections"
              className="size-10 shrink-0 rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </Button>
          </div>

          <div role="tablist" aria-label="Connection lists" className="flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 border-b-2 pb-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label} <span className="ml-1 text-xs opacity-70">{counts[t.key].toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="border-b border-border bg-muted/40 p-3 sm:p-4">
          <label className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {error}
            <Button
              variant="link"
              onClick={loadCore}
              className="ml-1 h-auto p-0 font-bold text-primary"
            >
              Try again
            </Button>
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading people…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <UsersRound className="size-5" aria-hidden />
            </div>
            <p className="font-wallet-display text-sm font-semibold text-foreground">
              {q ? "No matching people" : "Nothing to show yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {q ? "Try another name or username." : "New connections will appear here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => {
              const to = p.slug || p.userId;
              return (
                <li
                  key={p.userId}
                  className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:gap-4 sm:px-5"
                >
                  <Link
                    to="/profile/$id"
                    params={{ id: to }}
                    onClick={() => onOpenChange(false)}
                    className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={`Open ${p.displayName}'s profile`}
                  >
                    <span className="block size-12 overflow-hidden rounded-full border-2 border-background shadow-sm sm:size-[52px]">
                      <AvatarImage src={p.avatarUrl} alt={p.displayName} />
                    </span>
                    {online.has(p.userId) && (
                      <span className="absolute bottom-0 right-0 size-3.5 rounded-full bg-online ring-2 ring-background" />
                    )}
                  </Link>
                  <Link
                    to="/profile/$id"
                    params={{ id: to }}
                    onClick={() => onOpenChange(false)}
                    className="min-w-0 flex-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <span className="font-wallet-display block truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary sm:text-[15px]">
                      {p.displayName}
                    </span>
                    <span className="block truncate text-xs font-medium text-muted-foreground">
                      {p.username ? `@${p.username}` : (p.bio ?? "Oventric member")}
                    </span>
                    <span
                      className={`block truncate text-[11px] font-semibold ${
                        online.has(p.userId) ? "text-online" : "text-muted-foreground"
                      }`}
                    >
                      {online.has(p.userId)
                        ? "Online now"
                        : (presence.lastSeenLabel(p.userId) ?? "Offline")}
                    </span>
                  </Link>

                  {tab === "following" && viewerId === userId ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId === p.userId}
                      onClick={() => doUnfollow(p)}
                      className="h-9 shrink-0 rounded-[10px] border-border px-3 text-xs font-bold text-foreground hover:bg-muted"
                    >
                      {busyId === p.userId ? "…" : "Unfollow"}
                    </Button>
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
                          className="grid size-10 shrink-0 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
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
                          className="text-destructive focus:text-destructive"
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

        <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {rows.length.toLocaleString()} {tab === "all" ? "connections" : tab}
          </p>
          {tab !== "suggested" && (
            <Button
              type="button"
              variant="link"
              onClick={() => setTab("suggested")}
              className="h-auto p-0 text-xs font-bold text-primary"
            >
              View suggestions
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
