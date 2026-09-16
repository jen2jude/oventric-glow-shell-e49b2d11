import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, MessageCircle, ShoppingBag, Users, Wrench } from "lucide-react";
import { getLiveProfileTab, type RealProfileView } from "@/lib/profiles.functions";
import type {
  ProfileGroup,
  ProfileListing,
  ProfilePost,
} from "@/lib/profiles/mockProfiles";
import type { EcosystemSectionKey } from "@/lib/ecosystem/sections";

type PreviewKey = "marketplace" | "services" | "courses" | "posts" | "groups";

interface Props {
  /** Slug or user id used for data fetching. */
  idOrSlug: string;
  /** Profile id used when linking to the item detail route. */
  profileId: string;
  name: string;
  /** Section -> item count, so empty modules never render. */
  counts: Partial<Record<EcosystemSectionKey, number>>;
  isOwner: boolean;
  price: (usd: number) => string;
  itemSearch: Record<string, unknown>;
  onOpenSection: (key: string) => void;
  realProfile?: RealProfileView | null;
}


/** Section shell: title on the left, a "see all" affordance on the right. */
function Module({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 md:mt-0 md:rounded-[10px] md:border md:border-slate-200 md:bg-white md:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 md:text-slate-500">
          {title}
        </h2>
        {action && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#E5484D] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5484D]/60 rounded"
          >
            {action} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Horizontal, snap-scrolling rail — the mobile-native way to preview a set. */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 no-scrollbar md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
      {children}
    </div>
  );
}

function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" }) {
  return (
    <span
      className={`inline-flex items-center rounded-[10px] border px-3 py-1.5 text-xs font-bold ${
        tone === "accent"
          ? "border-[#E5484D]/30 bg-[#E5484D]/12 text-[#E5484D]"
          : "border-white/10 bg-white/[0.05] text-slate-200 md:border-slate-200 md:bg-slate-50 md:text-slate-700"
      }`}
    >
      {label}
    </span>
  );
}

/** Curated snapshot of a person's Oventric presence: who they are, what they
 * are into, what they make, and what they sell — each as a small preview that
 * hands off to the full section. */
export function ProfileOverview({
  idOrSlug,
  profileId,
  name,
  counts,
  isOwner,
  price,
  itemSearch,
  onOpenSection,
  realProfile,
}: Props) {

  const navigate = useNavigate();
  const fetchTab = useServerFn(getLiveProfileTab);

  const fetchRef = useRef(fetchTab);
  fetchRef.current = fetchTab;
  const [data, setData] = useState<Partial<Record<PreviewKey, unknown[]>>>({});

  const wanted = useMemo(() => {
    const keys: PreviewKey[] = [];
    if ((counts.marketplace ?? 0) > 0) keys.push("marketplace");
    if ((counts.services ?? 0) > 0) keys.push("services");
    if ((counts.courses ?? 0) > 0) keys.push("courses");
    if ((counts.posts ?? 0) > 0) keys.push("posts");
    if ((counts.groups ?? 0) > 0) keys.push("groups");
    return keys;
  }, [counts]);

  const wantedKey = wanted.join(",");

  useEffect(() => {
    if (!idOrSlug || wanted.length === 0) return;
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        wanted.map(async (key) => {
          try {
            const res = await fetchRef.current({
              data: { idOrSlug, tab: key, page: 1, pageSize: 6, q: "", sort: "newest" },
            });
            return [key, res.items] as const;
          } catch {
            return [key, []] as const;
          }
        }),
      );
      if (cancelled) return;
      setData(Object.fromEntries(results) as Partial<Record<PreviewKey, unknown[]>>);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idOrSlug, wantedKey]);

  const listingCard = (l: ProfileListing, kind: "listing", label: string, free = false) => (
    <Link
      key={l.id}
      to="/profile/$id/item/$kind/$itemId"
      params={{ id: profileId, kind, itemId: l.id }}
      search={itemSearch as never}
      className="group w-[46%] min-w-[150px] max-w-[200px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141418] md:w-auto md:min-w-0 md:max-w-none md:rounded-[10px] md:border-slate-200 md:bg-slate-50"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900 md:bg-slate-100">
        {l.coverUrl ? (
          <img loading="lazy" decoding="async"
            src={l.coverUrl}
            alt={l.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-7 w-7 text-white/25 md:text-slate-400" />
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-white md:text-slate-900">
          {l.title}
        </p>
        <p className="mt-1 text-xs font-black text-[#E5484D]">
          {free && l.priceUsd <= 0 ? "Free" : price(l.priceUsd)}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
    </Link>
  );

  const shop = (data.marketplace ?? []) as ProfileListing[];
  const services = (data.services ?? []) as ProfileListing[];
  const courses = (data.courses ?? []) as ProfileListing[];
  const posts = (data.posts ?? []) as ProfilePost[];
  const groups = (data.groups ?? []) as ProfileGroup[];

  const interests = realProfile?.interests ?? [];

  return (
    <div data-testid="profile-overview" className="space-y-6 pb-2 md:grid md:grid-cols-2 md:items-start md:gap-5 md:space-y-0 lg:grid-cols-2">
      {interests.length > 0 && (
        <Module title="What I'm into">
          <div className="-mx-1 flex flex-wrap gap-2 px-1">
            {interests.map((tag) => (
              <Chip key={tag} label={`#${tag}`} tone="accent" />
            ))}
          </div>
        </Module>
      )}


      {shop.length > 0 && (
        <Module
          title={`From ${name.split(" ")[0] || name}'s shop`}
          action="View shop"
          onAction={() => navigate({ to: "/shop/$id", params: { id: profileId } })}
        >
          <Rail>{shop.slice(0, 6).map((l) => listingCard(l, "listing", "Product"))}</Rail>
        </Module>
      )}

      {services.length > 0 && (
        <Module
          title="Services offered"
          action="View services"
          onAction={() => onOpenSection("services")}
        >
          <Rail>{services.slice(0, 6).map((l) => listingCard(l, "listing", "Service"))}</Rail>
        </Module>
      )}

      {courses.length > 0 && (
        <Module title="Courses" action="View courses" onAction={() => onOpenSection("courses")}>
          <Rail>{courses.slice(0, 6).map((l) => listingCard(l, "listing", "Course", true))}</Rail>
        </Module>
      )}

      {posts.length > 0 && (
        <Module title="Recent posts" action="View posts" onAction={() => onOpenSection("posts")}>
          <div className="space-y-2">
            {posts.slice(0, 3).map((p) => (
              <Link
                key={p.id}
                to="/profile/$id/item/$kind/$itemId"
                params={{ id: profileId, kind: "post", itemId: p.id }}
                search={itemSearch as never}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#141418] p-3 md:rounded-[10px] md:border-slate-200 md:bg-slate-50"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/[0.06] md:bg-slate-100">
                  <MessageCircle className="h-4 w-4 text-[#E5484D]" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm text-slate-200 md:text-slate-700">
                    {p.content}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    {p.timeAgo} · {p.likes} reactions · {p.comments} comments
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Module>
      )}

      {groups.length > 0 && (
        <Module title="Communities" action="View all" onAction={() => onOpenSection("groups")}>
          <Rail>
            {groups.slice(0, 6).map((g) => (
              <Link
                key={g.id}
                to="/profile/$id/item/$kind/$itemId"
                params={{ id: profileId, kind: "group", itemId: g.id }}
                search={itemSearch as never}
                className="w-[60%] min-w-[180px] max-w-[240px] shrink-0 snap-start rounded-2xl border border-white/10 bg-[#141418] p-3 md:w-auto md:min-w-0 md:max-w-none md:rounded-[10px] md:border-slate-200 md:bg-slate-50"
              >
                <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-white/[0.06] md:bg-slate-100">
                  <Users className="h-4 w-4 text-[#E5484D]" />
                </span>
                <p className="mt-2 line-clamp-1 text-sm font-bold text-white md:text-slate-900">
                  {g.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {g.tag} · {g.members.toLocaleString()} members
                </p>
              </Link>
            ))}
          </Rail>
        </Module>
      )}

      {isOwner && wanted.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-6 text-center md:border-slate-300">
          <Wrench className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-2 text-sm font-bold text-white md:text-slate-900">
            Your overview is empty
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Add a bio, skills, interests, and listings to complete your snapshot.
          </p>

        </div>
      )}
    </div>
  );
}
