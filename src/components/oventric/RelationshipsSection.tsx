import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Users, UserPlus, AlertTriangle, RefreshCw, Clock, Wifi } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { FollowButton } from "@/components/oventric/FollowButton";
import { listFollowers, listFollowing, type PersonSummary } from "@/lib/follows.functions";
import { usePresence } from "@/hooks/use-presence";
import { PersonQuickView } from "@/components/oventric/profile/PersonQuickView";

export type RelationshipTab = "followers" | "following";

const TABS: { key: RelationshipTab; label: string }[] = [
  { key: "followers", label: "Followers" },
  { key: "following", label: "Following" },
];

const PAGE = 9;

interface Props {
  userId: string;
  name: string;
  viewerId: string | null;
  tab: RelationshipTab;
  onTabChange: (tab: RelationshipTab) => void;
  counts?: { followers: number; following: number };
}

export function RelationshipsSection({ userId, name, viewerId, tab, onTabChange, counts }: Props) {
  const presence = usePresence();
  const online = presence.online;
  const fetchFollowers = useServerFn(listFollowers);
  const fetchFollowing = useServerFn(listFollowing);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<
    Record<RelationshipTab, { people: PersonSummary[] | null; error: string | null }>
  >({
    followers: { people: null, error: null },
    following: { people: null, error: null },
  });
  const [visible, setVisible] = useState<Record<RelationshipTab, number>>({
    followers: PAGE,
    following: PAGE,
  });
  /** When on, people who are online right now float to the top of the list. */
  const [onlineFirst, setOnlineFirst] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Record<RelationshipTab, number | null>>({
    followers: null,
    following: null,
  });
  const [quickView, setQuickView] = useState<PersonSummary | null>(null);
  const [, forceTick] = useState(0);

  const load = useCallback(
    async (which: RelationshipTab) => {
      setState((s) => ({ ...s, [which]: { people: null, error: null } }));
      try {
        const rows =
          which === "followers"
            ? await fetchFollowers({ data: { userId } })
            : await fetchFollowing({ data: { userId } });
        setState((s) => ({ ...s, [which]: { people: rows, error: null } }));
        setUpdatedAt((u) => ({ ...u, [which]: Date.now() }));
      } catch {
        setState((s) => ({
          ...s,
          [which]: { people: [], error: "Couldn't load this list right now." },
        }));
      }
    },
    [fetchFollowers, fetchFollowing, userId],
  );

  useEffect(() => {
    setState({
      followers: { people: null, error: null },
      following: { people: null, error: null },
    });
    setVisible({ followers: PAGE, following: PAGE });
  }, [userId]);

  useEffect(() => {
    if (state[tab].people === null && !state[tab].error) load(tab);
  }, [tab, state, load]);

  // Keep the "updated x ago" label honest without refetching.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End")
      return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.key === tab);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? TABS.length - 1
          : (idx + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    onTabChange(TABS[next].key);
    requestAnimationFrame(() => {
      const btn = tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next];
      btn?.focus();
    });
  };

  const current = state[tab];
  const ordered = (() => {
    const list = current.people ?? [];
    if (!onlineFirst) return list;
    return [...list].sort((a, b) => {
      const ao = online.has(a.userId) ? 0 : 1;
      const bo = online.has(b.userId) ? 0 : 1;
      return ao - bo;
    });
  })();
  const shown = ordered.slice(0, visible[tab]);
  const remaining = Math.max(0, ordered.length - shown.length);

  return (
    <section
      id="relationships"
      data-testid="profile-relationships"
      aria-labelledby="relationships-heading"
      className="profile-card-safe mt-5 rounded-xl border border-white/10 bg-[#1E1E24] md:bg-white md:border-slate-200 md:shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <h2
          id="relationships-heading"
          className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300 md:text-slate-900"
        >
          <Users className="w-4 h-4 text-emerald-400 md:text-emerald-600" aria-hidden />{" "}
          Relationships
        </h2>
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Followers and following"
          onKeyDown={onTabKeyDown}
          className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-white/5 p-1 md:border-slate-200 md:bg-slate-100"
        >
          {TABS.map((t) => {
            const active = t.key === tab;
            const count = t.key === "followers" ? counts?.followers : counts?.following;
            return (
              <button
                key={t.key}
                role="tab"
                id={`rel-tab-${t.key}`}
                aria-selected={active}
                aria-controls={`rel-panel-${t.key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => onTabChange(t.key)}
                className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                  active
                    ? "bg-emerald-500 text-black"
                    : "text-slate-400 hover:text-white md:text-slate-600 md:hover:text-slate-900"
                }`}
              >
                {t.label}
                {typeof count === "number" && (
                  <span className={active ? "ml-1 opacity-80" : "ml-1 text-slate-500"}>
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-6">
        <button
          type="button"
          role="switch"
          aria-checked={onlineFirst}
          onClick={() => setOnlineFirst((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
            onlineFirst
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 md:text-emerald-700"
              : "border-white/10 bg-white/5 text-slate-400 md:border-slate-200 md:bg-slate-100 md:text-slate-600"
          }`}
        >
          <Wifi className="h-3.5 w-3.5" aria-hidden />
          Online first
          <span
            className={`ml-0.5 h-3.5 w-6 rounded-full transition-colors ${
              onlineFirst ? "bg-emerald-500" : "bg-slate-600 md:bg-slate-300"
            }`}
            aria-hidden
          >
            <span
              className={`block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                onlineFirst ? "translate-x-2.5" : "translate-x-0"
              }`}
            />
          </span>
        </button>
        <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {updatedAt[tab] ? `Updated ${relativeTime(updatedAt[tab] as number)}` : "Updating…"}
          <button
            type="button"
            onClick={() => load(tab)}
            className="ml-1 rounded px-1.5 py-0.5 font-bold text-emerald-400 hover:text-emerald-300 md:text-emerald-600 md:hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
          >
            Refresh
          </button>
        </p>
      </div>

      <div
        role="tabpanel"
        id={`rel-panel-${tab}`}
        aria-labelledby={`rel-tab-${tab}`}
        tabIndex={0}
        className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded-b-xl"
      >
        {current.error ? (
          <div className="rounded-[10px] border border-red-500/30 bg-red-500/5 p-5 text-center md:border-red-200 md:bg-red-50">
            <AlertTriangle
              className="mx-auto mb-2 h-4 w-4 text-red-300 md:text-red-500"
              aria-hidden
            />
            <p className="text-sm font-semibold text-red-200 md:text-red-700">{current.error}</p>
            <button
              onClick={() => load(tab)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
            </button>
          </div>
        ) : current.people === null ? (
          <ul
            className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
            aria-busy="true"
            aria-label="Loading people"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="flex animate-pulse items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:border-slate-200 md:bg-slate-50"
              >
                <span className="h-11 w-11 shrink-0 rounded-full bg-white/10 md:bg-slate-200" />
                <span className="min-w-0 flex-1">
                  <span className="mb-2 block h-3 w-2/3 rounded bg-white/10 md:bg-slate-200" />
                  <span className="block h-2.5 w-1/3 rounded bg-white/10 md:bg-slate-200" />
                </span>
              </li>
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <div className="rounded-[10px] border border-white/10 bg-white/[0.02] p-8 text-center md:border-slate-200 md:bg-slate-50">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 md:border-emerald-200 md:bg-emerald-50 md:text-emerald-600">
              <UserPlus className="h-4 w-4" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-slate-200 md:text-slate-900">
              {tab === "followers"
                ? `${name} has no followers yet`
                : `${name} isn't following anyone yet`}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              {tab === "followers"
                ? "People who follow this profile will be listed here."
                : "Profiles this member follows will be listed here."}
            </p>
          </div>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => {
                const isOnline = online.has(p.userId);
                return (
                  <li
                    key={p.userId}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-emerald-500/40 md:border-slate-200 md:bg-white md:hover:border-emerald-400 md:hover:shadow-sm"
                  >
                    <Link
                      to="/profile/$id"
                      params={{ id: p.slug || p.userId }}
                      className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                      aria-label={`Open ${p.displayName}'s profile`}
                    >
                      <span className="block h-11 w-11 overflow-hidden rounded-full">
                        <AvatarImage src={p.avatarUrl} alt={p.displayName} />
                      </span>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[#1E1E24] md:ring-white ${
                          isOnline ? "bg-emerald-400" : "bg-slate-500"
                        }`}
                        aria-hidden
                      />
                      <span className="sr-only">{isOnline ? "Online" : "Offline"}</span>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/profile/$id"
                        params={{ id: p.slug || p.userId }}
                        className="block truncate text-sm font-bold text-white hover:text-emerald-300 md:text-slate-900 md:hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 rounded"
                      >
                        {p.displayName}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setQuickView(p)}
                        aria-haspopup="dialog"
                        className="block truncate text-left text-[11px] text-slate-500 hover:text-emerald-400 md:hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 rounded"
                      >
                        {p.username
                          ? `@${p.username}`
                          : isOnline
                            ? "Online now"
                            : (presence.lastSeenLabel(p.userId) ?? "Offline")}{" "}
                        ·
                        Quick view
                      </button>
                    </div>
                    {viewerId && viewerId !== p.userId && (
                      <div className="shrink-0">
                        <FollowButton
                          targetId={p.userId}
                          compact
                          className="!px-3 !py-1.5 !text-xs"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="pt-3 text-center">
              {remaining > 0 ? (
                <button
                  onClick={() => setVisible((v) => ({ ...v, [tab]: v[tab] + PAGE }))}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white md:border-slate-200 md:text-slate-600 md:hover:bg-slate-50 md:hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                >
                  Show more ({remaining} left)
                </button>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Showing all {shown.length} {tab === "followers" ? "followers" : "following"}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <PersonQuickView
        person={quickView}
        isOnline={quickView ? online.has(quickView.userId) : false}
        viewerId={viewerId}
        onClose={() => setQuickView(null)}
      />
    </section>
  );
}

/** Compact "x ago" label for the list's last refresh time. */
function relativeTime(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
