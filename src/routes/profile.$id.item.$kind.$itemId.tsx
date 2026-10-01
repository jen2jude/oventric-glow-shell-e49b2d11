import { useState } from "react";
import { createFileRoute, Link, useNavigate, notFound, useRouter } from "@tanstack/react-router";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Users,
  Award,
  Target,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  Compass,
  Heart,
  Share2,
  Check,
  Bookmark,
  Gavel,
  Hammer,
  Sparkles,
  Link2,
} from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { MobileNav } from "@/components/oventric/MobileNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { getProfile } from "@/lib/profiles/mockProfiles";
import { getProfileByIdOrSlug, type RealProfileView } from "@/lib/profiles.functions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { getLiveProfileItem, type ProfileItemKind } from "@/lib/profiles.functions";
import type {
  ProfilePost,
  ProfileGroup,
  ProfileListing,
  ProfileBounty,
} from "@/lib/profiles/mockProfiles";

const itemSearchSchema = z.object({
  tab: fallback(z.string(), "posts").default("posts"),
  pages: fallback(z.number().int(), 1).default(1),
  y: fallback(z.number().int(), 0).default(0),
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "newest").default("newest"),
});

const TAB_LABELS: Record<string, string> = {
  posts: "Posts",
  groups: "Groups",
  marketplace: "Marketplace",
  posted: "Bounties",
  solved: "Solved",
};

const VALID_KINDS: ProfileItemKind[] = ["post", "group", "listing", "bounty", "solved"];

function labelFor(kind: ProfileItemKind): string {
  switch (kind) {
    case "post":
      return "Post";
    case "group":
      return "Group";
    case "listing":
      return "Marketplace item";
    case "bounty":
      return "Bounty";
    case "solved":
      return "Solved bounty";
  }
}

export const Route = createFileRoute("/profile/$id/item/$kind/$itemId")({
  validateSearch: zodValidator(itemSearchSchema),
  loader: async ({ params }) => {
    if (!VALID_KINDS.includes(params.kind as ProfileItemKind)) throw notFound();
    const [{ item }, realRes] = await Promise.all([
      getLiveProfileItem({
        data: {
          idOrSlug: params.id,
          kind: params.kind as ProfileItemKind,
          itemId: params.itemId,
        },
      }),
      getProfileByIdOrSlug({ data: { idOrSlug: params.id } }).catch(() => ({
        profile: null as RealProfileView | null,
      })),
    ]);

    if (!item) throw notFound();
    return { item, kind: params.kind as ProfileItemKind, realProfile: realRes.profile };
  },
  head: ({ params, loaderData }) => {
    const label = VALID_KINDS.includes(params.kind as ProfileItemKind)
      ? labelFor(params.kind as ProfileItemKind)
      : "Item";
    const title = loaderData
      ? "content" in loaderData.item
        ? `Post by @${params.id}`
        : "title" in loaderData.item
          ? `${loaderData.item.title} — @${params.id}`
          : "name" in loaderData.item
            ? `${loaderData.item.name} — @${params.id}`
            : `${label} — @${params.id}`
      : `${label} — @${params.id}`;
    return {
      meta: [{ title }, { name: "robots", content: "noindex" }],
    };
  },
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: () => {
    // Params aren't reliably typed here — use window location as a best-effort hint.
    const kind =
      (typeof window !== "undefined"
        ? (window.location.pathname.split("/item/")[1]?.split("/")[0] as
            | ProfileItemKind
            | undefined)
        : undefined) ?? "post";
    return (
      <Shell>
        <ItemSkeleton kind={kind} />
      </Shell>
    );
  },
  errorComponent: ({ error, reset }) => (
    <Shell>
      <ErrorPanel
        title="We couldn't load this item"
        message={(error as Error).message || "Something went wrong while fetching this content."}
        onRetry={reset}
      />
    </Shell>
  ),
  notFoundComponent: () => {
    const { id, kind } = Route.useParams();
    const search = Route.useSearch();
    return (
      <Shell>
        <NotFoundPanel
          profileId={id}
          kind={VALID_KINDS.includes(kind as ProfileItemKind) ? (kind as ProfileItemKind) : "post"}
          back={{
            tab: search.tab,
            pages: search.pages,
            y: search.y,
            q: search.q,
            sort: search.sort,
          }}
        />
      </Shell>
    );
  },
  component: ItemDetail,
});

function ItemSkeleton({ kind }: { kind: ProfileItemKind }) {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-32 bg-white/5 rounded mb-4" />
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-40 bg-white/5 rounded" />
          <div className="h-2 w-24 bg-white/5 rounded" />
        </div>
      </div>
      <div className="h-2 w-16 bg-emerald-500/20 rounded mb-3" />
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-6 space-y-4">
        {kind === "listing" || kind === "bounty" || kind === "solved" ? (
          <>
            <div className="h-6 w-3/4 bg-white/5 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-white/5 rounded-[10px]" />
              <div className="h-16 bg-white/5 rounded-[10px]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-white/5 rounded" />
              <div className="h-3 w-5/6 bg-white/5 rounded" />
              <div className="h-3 w-2/3 bg-white/5 rounded" />
            </div>
            <div className="h-10 w-full bg-white/5 rounded-[10px]" />
          </>
        ) : kind === "group" ? (
          <>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-1/2 bg-white/5 rounded" />
                <div className="h-3 w-1/3 bg-white/5 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-white/5 rounded" />
              <div className="h-3 w-4/5 bg-white/5 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-28 bg-white/5 rounded-[10px]" />
              <div className="h-9 w-40 bg-white/5 rounded-[10px]" />
            </div>
          </>
        ) : (
          <>
            <div className="h-3 w-40 bg-white/5 rounded" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-white/5 rounded" />
              <div className="h-3 w-11/12 bg-white/5 rounded" />
              <div className="h-3 w-3/4 bg-white/5 rounded" />
            </div>
            <div className="flex gap-5 pt-3 border-t border-white/5">
              <div className="h-3 w-16 bg-white/5 rounded" />
              <div className="h-3 w-20 bg-white/5 rounded" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorPanel({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const handleRetry = async () => {
    setRetrying(true);
    try {
      onRetry();
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <div className="bg-[#1E1E24] border border-red-500/30 rounded-xl p-8 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
        <AlertTriangle className="w-5 h-5 text-red-300" />
      </div>
      <div className="text-white font-semibold text-sm mb-1">{title}</div>
      <div className="text-xs text-slate-400 mb-5 max-w-md mx-auto">{message}</div>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border border-white/15 text-white hover:bg-white/5 text-xs font-semibold disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

const NOT_FOUND_COPY: Record<
  ProfileItemKind,
  { icon: React.ReactNode; title: string; body: string; back: string }
> = {
  post: {
    icon: <MessageCircle className="w-5 h-5 text-slate-300" />,
    title: "This post is gone",
    body: "The author may have deleted it, or it was removed by moderation. Their other posts are still on their profile.",
    back: "Back to posts",
  },
  group: {
    icon: <Users className="w-5 h-5 text-slate-300" />,
    title: "This group isn't available",
    body: "It may have been archived, made private, or renamed. Explore other communities on this profile.",
    back: "Back to groups",
  },
  listing: {
    icon: <ShoppingBag className="w-5 h-5 text-slate-300" />,
    title: "This listing is unavailable",
    body: "It may have sold out, been unpublished, or removed by the seller. Check the marketplace tab for active items.",
    back: "Back to marketplace",
  },
  bounty: {
    icon: <Target className="w-5 h-5 text-slate-300" />,
    title: "This bounty was closed",
    body: "It was withdrawn, awarded, or moved to solved. Open bounties are still available on the profile.",
    back: "Back to bounties",
  },
  solved: {
    icon: <Award className="w-5 h-5 text-slate-300" />,
    title: "This solved record is hidden",
    body: "The solver or poster may have taken it down. Their other completed work is still visible.",
    back: "Back to solved bounties",
  },
};

function NotFoundPanel({
  profileId,
  kind,
  back,
}: {
  profileId: string;
  kind: ProfileItemKind;
  back: { tab: string; pages: number; y: number; q: string; sort: string };
}) {
  const copy = NOT_FOUND_COPY[kind];
  return (
    <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-8 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        {copy.icon}
      </div>
      <div className="text-white font-semibold text-sm mb-1">{copy.title}</div>
      <div className="text-xs text-slate-400 mb-5 max-w-md mx-auto leading-relaxed">
        {copy.body}
      </div>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Link
          to="/profile/$id"
          params={{ id: profileId }}
          search={back}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {copy.back}
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border border-white/15 text-white hover:bg-white/5 text-xs font-semibold"
        >
          <Compass className="w-3.5 h-3.5" /> Explore feed
        </Link>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="page-light relative h-screen overflow-hidden bg-[#121214] text-slate-200">
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50  hidden md:block" />

      <div className="flex h-full flex-col">
        <Header forceSiteNavbar={!useIsAppShell()} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="max-w-3xl mx-auto w-full px-4 py-6">{children}</div>
        </main>
        <MobileNav onCreate={() => {}} active="Feed" onSelect={() => navigate({ to: "/" })} />
      </div>
    </div>
  );
}

function ItemDetail() {
  const { id, kind } = Route.useParams();
  const backSearch = Route.useSearch();
  const { item, realProfile } = Route.useLoaderData();
  const mock = getProfile(id);
  const isUuidId = UUID_RE.test(id);
  const realName = (realProfile?.displayName ?? "").trim() || (realProfile?.username ?? "").trim();
  const displayName = realName || (isUuidId ? "Member" : mock.name);
  const displayRole = realProfile ? realName || "Member" : isUuidId ? "" : mock.role;

  const displayInitials = (() => {
    const source = realName || (isUuidId ? "" : mock.name);
    const parts = source.trim().split(/\s+/).slice(0, 2);
    const s = parts.map((w: string) => w[0]?.toUpperCase() ?? "").join("");
    return s || (isUuidId ? "··" : mock.initials);
  })();
  const profile = mock;
  const { baseCurrency, require } = useOnboarding();

  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const price = (usd: number) =>
    `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const tabLabel = TAB_LABELS[backSearch.tab] ?? "Profile";

  return (
    <Shell>
      <Link
        to="/profile/$id"
        params={{ id }}
        search={{
          tab: backSearch.tab,
          pages: backSearch.pages,
          y: backSearch.y,
          q: backSearch.q,
          sort: backSearch.sort,
        }}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to {displayName}
        <span className="text-slate-600">·</span>
        <span className="text-slate-500">{tabLabel}</span>
      </Link>

      {/* Author strip */}
      <Link to="/profile/$id" params={{ id }} className="flex items-center gap-3 mb-4 group">
        {realProfile?.avatarUrl ? (
          <img loading="lazy" decoding="async"
            src={realProfile.avatarUrl}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-full bg-gradient-to-br ${profile.avatarGradient} flex items-center justify-center text-white font-bold text-xs shrink-0`}
          >
            {displayInitials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm truncate group-hover:text-emerald-300">
            {displayName}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{displayRole}</div>
        </div>
      </Link>

      <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-2">
        {labelFor(kind as ProfileItemKind)}
      </div>

      {kind === "post" && (
        <PostView post={item as ProfilePost} authorName={displayName} require={require} />
      )}
      {kind === "group" && <GroupView group={item as ProfileGroup} require={require} />}
      {kind === "listing" && (
        <ListingView
          listing={item as ProfileListing}
          price={price}
          onBuy={() => require(2, () => alert("Proceed to checkout (mock)"))}
        />
      )}
      {kind === "bounty" && (
        <BountyView bounty={item as ProfileBounty} price={price} require={require} />
      )}
      {kind === "solved" && (
        <SolvedView bounty={item as ProfileBounty} price={price} require={require} />
      )}
    </Shell>
  );
}

type Require = (step: 0 | 1 | 2 | 3 | 4 | 5, cb: () => void) => void;

function copyCurrentUrl() {
  if (typeof window === "undefined") return;
  navigator.clipboard?.writeText(window.location.href).then(
    () => toast.success("Link copied", { description: "Share it anywhere." }),
    () => toast.error("Couldn't copy link"),
  );
}

function PostView({
  post,
  authorName,
  require,
}: {
  post: ProfilePost;
  authorName: string;
  require: Require;
}) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const toggleLike = () =>
    require(1, () => {
      setLiked((prev) => {
        const next = !prev;
        setLikes((n) => n + (next ? 1 : -1));
        if (next)
          toast("Liked", {
            description: `You liked @${authorName}'s post.`,
            icon: <Heart className="w-4 h-4 text-rose-400" />,
          });
        return next;
      });
    });
  return (
    <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-6">
      <div className="text-xs text-slate-500 mb-3">
        {authorName} · {post.timeAgo}
      </div>
      <p className="text-base text-slate-100 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-2 flex-wrap">
        <button
          onClick={toggleLike}
          aria-pressed={liked}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold border transition-colors ${
            liked
              ? "bg-rose-500/15 border-rose-400/40 text-rose-300"
              : "bg-transparent border-white/10 text-slate-300 hover:bg-white/5"
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? "fill-rose-400 text-rose-400" : ""}`} />
          {liked ? "Liked" : "Like"} · {likes}
        </button>
        <button
          onClick={() =>
            require(1, () => toast("Comments", { description: "Threaded replies open soon." }))
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold border border-white/10 text-slate-300 hover:bg-white/5"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Comment · {post.comments}
        </button>
        <button
          onClick={copyCurrentUrl}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold border border-white/10 text-slate-300 hover:bg-white/5"
        >
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      </div>
    </article>
  );
}

function GroupView({ group, require }: { group: ProfileGroup; require: Require }) {
  const [joined, setJoined] = useState(false);
  const toggleJoin = () =>
    require(1, () => {
      setJoined((prev) => {
        const next = !prev;
        toast(next ? "Joined group" : "Left group", {
          description: next ? `Welcome to ${group.name}.` : `You left ${group.name}.`,
          icon: next ? <Check className="w-4 h-4 text-emerald-400" /> : undefined,
        });
        return next;
      });
    });
  return (
    <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-black">
          <Users className="w-7 h-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-white text-xl font-black">{group.name}</h1>
          <div className="text-xs text-slate-500 mt-0.5">
            {group.tag} · {(group.members + (joined ? 1 : 0)).toLocaleString()} members
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">
        A working community of practitioners shipping in the {group.tag.toLowerCase()} space. Weekly
        threads, live jams, and open bounties.
      </p>
      <div className="mt-5 flex gap-2 flex-wrap">
        <button
          onClick={toggleJoin}
          aria-pressed={joined}
          className={`px-4 py-2 rounded-[10px] text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
            joined
              ? "bg-emerald-500/15 border border-emerald-400/40 text-emerald-300"
              : "bg-emerald-500 hover:bg-emerald-400 text-black"
          }`}
        >
          {joined ? (
            <>
              <Check className="w-4 h-4" /> Joined
            </>
          ) : (
            <>Join group</>
          )}
        </button>
        <button
          onClick={() =>
            require(2, () =>
              toast("Message sent to admins", { description: "They'll respond in-thread." }))
          }
          className="px-4 py-2 rounded-[10px] border border-white/15 text-white hover:bg-white/5 text-sm font-semibold inline-flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4" /> Message admins
        </button>
        <button
          onClick={copyCurrentUrl}
          className="px-4 py-2 rounded-[10px] border border-white/15 text-white hover:bg-white/5 text-sm font-semibold inline-flex items-center gap-2"
        >
          <Link2 className="w-4 h-4" /> Share
        </button>
      </div>
    </article>
  );
}

function ListingView({
  listing,
  price,
  onBuy,
}: {
  listing: ProfileListing;
  price: (u: number) => string;
  onBuy: () => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-6">
      <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
        {listing.category}
      </div>
      <h1 className="text-white text-2xl font-black mt-1">{listing.title}</h1>
      <div className="mt-4 flex items-end gap-4">
        <div className="text-white font-black text-3xl">{price(listing.priceUsd)}</div>
        <div className="text-xs text-slate-500 mb-1 inline-flex items-center gap-1">
          <ShoppingBag className="w-3.5 h-3.5" /> {listing.sales} sold
        </div>
      </div>
      <p className="text-sm text-slate-300 mt-5 leading-relaxed">
        Production-tested asset from this creator's marketplace catalog. Includes source files,
        setup guide, and 30 days of update access.
      </p>
      <div className="mt-6 flex gap-2 flex-wrap">
        <button
          onClick={onBuy}
          className="flex-1 min-w-[180px] px-4 py-2.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm"
        >
          Buy Now — {price(listing.priceUsd)}
        </button>
        <button
          onClick={() => {
            setSaved((s) => !s);
            toast(saved ? "Removed from saved" : "Saved for later", {
              icon: <Bookmark className="w-4 h-4 text-emerald-400" />,
            });
          }}
          aria-pressed={saved}
          className={`px-3 py-2.5 rounded-[10px] border text-sm font-semibold inline-flex items-center gap-2 ${
            saved
              ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
              : "border-white/15 text-white hover:bg-white/5"
          }`}
        >
          <Bookmark className={`w-4 h-4 ${saved ? "fill-emerald-400 text-emerald-400" : ""}`} />
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}

function BountyView({
  bounty,
  price,
  require,
}: {
  bounty: ProfileBounty;
  price: (u: number) => string;
  require: Require;
}) {
  const [applied, setApplied] = useState(false);
  const [watching, setWatching] = useState(false);
  const [bidOpen, setBidOpen] = useState(false);
  const [bid, setBid] = useState("");

  const submitBid = () => {
    const amount = Number(bid);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid bid amount");
      return;
    }
    require(2, () => {
      setBidOpen(false);
      setBid("");
      setApplied(true);
      toast("Bid submitted", {
        description: `Your bid of ${price(amount)} is in escrow queue.`,
        icon: <Gavel className="w-4 h-4 text-emerald-400" />,
      });
    });
  };

  return (
    <article className="bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-6">
      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-300 mb-2">
        <Target className="w-3.5 h-3.5" /> [ACTIVE · {price(bounty.amountUsd)}]
      </div>
      <h1 className="text-white text-2xl font-black leading-tight">{bounty.title}</h1>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-black/30 border border-white/5 rounded-[10px] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Escrow</div>
          <div className="text-white font-black text-lg mt-1">{price(bounty.amountUsd)}</div>
        </div>
        <div className="bg-black/30 border border-white/5 rounded-[10px] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Applicants</div>
          <div className="text-white font-black text-lg mt-1">
            {(bounty.applicants ?? 0) + (applied ? 1 : 0)}
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-300 mt-5 leading-relaxed">
        Open bounty. Escrow is funded and released on approved delivery. Post-submission review
        window is 72 hours.
      </p>

      {bidOpen && (
        <div className="mt-5 bg-black/40 border border-white/10 rounded-[10px] p-3">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">
            Your bid (USD)
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              placeholder={String(bounty.amountUsd)}
              className="flex-1 bg-black/50 border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
            />
            <button
              onClick={submitBid}
              className="px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold"
            >
              Submit
            </button>
            <button
              onClick={() => setBidOpen(false)}
              className="px-3 py-2 rounded-[10px] border border-white/10 text-slate-300 hover:bg-white/5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2 flex-wrap">
        <button
          disabled={applied}
          onClick={() =>
            require(2, () => {
              setApplied(true);
              toast("Application sent", {
                description: "The poster will review your submission.",
                icon: <Hammer className="w-4 h-4 text-emerald-400" />,
              });
            })
          }
          className={`flex-1 min-w-[180px] px-4 py-2.5 rounded-[10px] font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors ${
            applied
              ? "bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 cursor-default"
              : "bg-emerald-500 hover:bg-emerald-400 text-black"
          }`}
        >
          {applied ? (
            <>
              <Check className="w-4 h-4" /> Applied
            </>
          ) : (
            <>
              <Hammer className="w-4 h-4" /> Apply to solve
            </>
          )}
        </button>
        <button
          onClick={() => setBidOpen((o) => !o)}
          className="px-4 py-2.5 rounded-[10px] border border-white/15 text-white hover:bg-white/5 text-sm font-semibold inline-flex items-center gap-2"
        >
          <Gavel className="w-4 h-4" /> {bidOpen ? "Close bid" : "Place bid"}
        </button>
        <button
          onClick={() => {
            setWatching((w) => !w);
            toast(watching ? "Stopped watching" : "Watching bounty", {
              icon: <Bookmark className="w-4 h-4 text-emerald-400" />,
            });
          }}
          aria-pressed={watching}
          className={`px-3 py-2.5 rounded-[10px] border text-sm font-semibold inline-flex items-center gap-2 ${
            watching
              ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
              : "border-white/15 text-white hover:bg-white/5"
          }`}
        >
          <Bookmark className={`w-4 h-4 ${watching ? "fill-emerald-400 text-emerald-400" : ""}`} />
          {watching ? "Watching" : "Watch"}
        </button>
      </div>
    </article>
  );
}

function SolvedView({
  bounty,
  price,
  require,
}: {
  bounty: ProfileBounty;
  price: (u: number) => string;
  require: Require;
}) {
  return (
    <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-2 text-[11px] font-bold text-purple-300 mb-2">
        <Award className="w-3.5 h-3.5" /> [SOLVED · {price(bounty.amountUsd)}]
      </div>
      <h1 className="text-white text-2xl font-black leading-tight">{bounty.title}</h1>
      {bounty.proof && (
        <div className="mt-5 bg-black/30 border border-white/5 rounded-[10px] p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
            Technical execution proof
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{bounty.proof}</p>
          <button
            onClick={() =>
              toast("Opening artifact", { description: "Artifact viewer launching soon." })
            }
            className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
          >
            View artifact <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="mt-6 flex gap-2 flex-wrap">
        <button
          onClick={() =>
            require(2, () =>
              toast("Tip sent", {
                description: `You tipped the solver ${price(Math.max(5, Math.round(bounty.amountUsd * 0.05)))}.`,
                icon: <Sparkles className="w-4 h-4 text-purple-300" />,
              }))
          }
          className="flex-1 min-w-[180px] px-4 py-2.5 rounded-[10px] bg-purple-500 hover:bg-purple-400 text-black font-semibold text-sm inline-flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> Tip the solver
        </button>
        <button
          onClick={copyCurrentUrl}
          className="px-4 py-2.5 rounded-[10px] border border-white/15 text-white hover:bg-white/5 text-sm font-semibold inline-flex items-center gap-2"
        >
          <Share2 className="w-4 h-4" /> Share proof
        </button>
      </div>
      <div className="mt-5 text-xs text-slate-500">Payout released and dispute window cleared.</div>
    </article>
  );
}
