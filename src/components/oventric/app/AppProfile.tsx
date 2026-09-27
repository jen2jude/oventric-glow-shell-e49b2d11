import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Flag,
  Link2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Share2,
  ShoppingBag,
  UserPlus,
  UserCheck,
  Users,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProfileByIdOrSlug,
  getProfileSocialCounts,
  getProfileTab,
} from "@/lib/profiles.functions";
import {
  getFollowStatus,
  sendFollowRequest,
  unfollow,
  listIncomingFollowRequests,
} from "@/lib/follows.functions";
import { listPosts, type FeedPost } from "@/lib/posts.functions";
import { listProducts, type ProductDTO } from "@/lib/marketplace.functions";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { haptic } from "@/lib/haptics";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { ProductQuickView } from "./ProductQuickView";
import { AppSheet } from "./AppSheet";
import { ConnectionsDialog } from "@/components/oventric/profile/ConnectionsDialog";
import { FollowRequestsDrawer } from "@/components/oventric/FollowRequestsDrawer";
import { ReportModal } from "@/components/oventric/ReportModal";
import { ProfileServicesTab } from "@/components/oventric/profile/ProfileServicesTab";

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;
}

type Tab = "posts" | "shop" | "services" | "skills" | "about";

function priceOf(p: ProductDTO): string {
  return `$${p.priceUSD.toFixed(2)}`;
}

export function AppProfile({ idOrSlug }: { idOrSlug: string }) {
  const navigate = useNavigate();
  const { openGate } = useAuthGate();
  const [tab, setTab] = useState<Tab>("posts");
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [followReqOpen, setFollowReqOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<
    "all" | "following" | "followers" | "suggested"
  >("followers");
  const { baseCurrency } = useOnboarding();
  const currency = (baseCurrency ?? "USD") as Currency;

  const fetchProfile = useServerFn(getProfileByIdOrSlug);
  const fetchCounts = useServerFn(getProfileSocialCounts);
  const fetchFollowStatus = useServerFn(getFollowStatus);
  const followFn = useServerFn(sendFollowRequest);
  const unfollowFn = useServerFn(unfollow);
  const fetchPosts = useServerFn(listPosts);
  const fetchProducts = useServerFn(listProducts);
  const fetchServices = useServerFn(getProfileTab);
  const fetchFollowReqs = useServerFn(listIncomingFollowRequests);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["app-profile", idOrSlug],
    queryFn: () => fetchProfile({ data: { idOrSlug } }),
    staleTime: 60_000,
  });
  const profile = profileData?.profile ?? null;
  const userId = profile?.userId ?? null;

  const { data: counts } = useQuery({
    queryKey: ["app-profile-counts", idOrSlug],
    queryFn: () => fetchCounts({ data: { idOrSlug } }),
    staleTime: 60_000,
  });

  const { data: meData } = useQuery({
    queryKey: ["app-profile-me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: 300_000,
  });
  const me = meData ?? null;
  const isOwn = !!me && !!userId && me === userId;

  const { data: followData, refetch: refetchFollow } = useQuery({
    queryKey: ["app-profile-follow", userId],
    queryFn: () => fetchFollowStatus({ data: { targetId: userId! } }),
    enabled: !!userId && !!me && !isOwn,
    staleTime: 30_000,
  });
  const followStatus = followData?.status ?? "none";

  const { data: postsData } = useQuery({
    queryKey: ["app-profile-posts"],
    queryFn: () => fetchPosts(),
    staleTime: 60_000,
  });
  const posts = useMemo(
    () =>
      (postsData?.posts ?? []).filter((p: FeedPost) => p.author_id === userId),
    [postsData, userId],
  );

  const { data: productsData } = useQuery({
    queryKey: ["app-profile-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60_000,
  });
  const products = useMemo(
    () =>
      (productsData ?? []).filter(
        (p: ProductDTO) => p.sellerId === userId && p.status === "active",
      ),
    [productsData, userId],
  );

  const { data: servicesData } = useQuery({
    queryKey: ["app-profile-services", idOrSlug],
    queryFn: () =>
      fetchServices({
        data: { profileId: idOrSlug, tab: "services", page: 1, pageSize: 24 },
      }),
    staleTime: 60_000,
  });
  const services = (servicesData?.items ?? []) as ProfileListing[];

  const { data: followReqData } = useQuery({
    queryKey: ["app-profile-follow-requests"],
    queryFn: () => fetchFollowReqs(),
    enabled: isOwn,
    staleTime: 30_000,
  });
  const pendingFollowReqCount = followReqData?.requests?.length ?? 0;

  const shareProfile = async () => {
    const url = `${window.location.origin}/profile/${idOrSlug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile?.displayName ?? "Profile", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {
      /* dismissed */
    }
  };

  const toggleFollow = async () => {
    if (!userId) return;
    if (!me) {
      openGate("generic");
      return;
    }
    setFollowBusy(true);
    haptic("select");
    try {
      if (followStatus === "following" || followStatus === "mutual") {
        await unfollowFn({ data: { targetId: userId } });
      } else {
        await followFn({ data: { targetId: userId } });
      }
      await refetchFollow();
    } finally {
      setFollowBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[#0A0A0B] pb-32">
        <div className="h-28 bg-white/[0.04] animate-pulse" />
        <div className="px-4 pt-12 space-y-3">
          <div className="h-5 w-40 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-3 w-56 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-dvh bg-[#0A0A0B] pb-32 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-white/80 text-sm font-semibold">Profile not found</p>
        <p className="text-white/40 text-xs">
          This profile may have been removed or the link is wrong.
        </p>
        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-2 rounded-full bg-[#E5484D] px-5 py-2 text-xs font-semibold text-white"
        >
          Back home
        </button>
      </div>
    );
  }

  const verified =
    !!profile.verificationTier && profile.verificationTier !== "TIER_0";

  return (
    <div className="min-h-dvh bg-[#0A0A0B] pb-32">
      {/* Cover */}
      <div className="relative h-28 overflow-hidden">
        {profile.coverUrl ? (
          <img
            src={profile.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#E5484D]/40 via-[#17171B] to-[#0A0A0B]" />
        )}
        <button
          onClick={() => window.history.back()}
          aria-label="Back"
          className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 backdrop-blur"
        >
          <ArrowLeft className="h-4.5 w-4.5 text-white" />
        </button>
      </div>

      {/* Identity */}
      <div className="relative z-10 px-4">
        <div className="-mt-9 flex items-end justify-between">
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-full border-4 border-[#0A0A0B] bg-[#17171B] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center rounded-full bg-[#E5484D] text-2xl font-bold text-white">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {verified && (
              <span className="absolute -bottom-0.5 -right-0.5 z-10 grid h-6 w-6 place-items-center rounded-full border-[3px] border-[#0A0A0B] bg-[#1D9BF0]">
                <BadgeCheck className="h-3.5 w-3.5 text-white" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 pb-1">
            <button
              onClick={() => {
                haptic("select");
                navigate({ to: "/shop/$id", params: { id: profile.userId } });
              }}
              className="flex items-center gap-1.5 rounded-full border border-[#E5484D]/40 bg-[#E5484D]/10 px-3.5 py-2 text-xs font-semibold text-[#E5484D]"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> View shop
            </button>
            {!isOwn && (
              <>
                <button
                  onClick={() => navigate({ to: "/messages" })}
                  aria-label="Message"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15"
                >
                  <MessageCircle className="h-4 w-4 text-white/80" />
                </button>
                <button
                  onClick={toggleFollow}
                  disabled={followBusy}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold ${
                    followStatus === "following" || followStatus === "mutual"
                      ? "border border-white/15 text-white/80"
                      : followStatus === "requested"
                        ? "border border-white/15 text-white/50"
                        : "bg-[#E5484D] text-white"
                  }`}
                >
                  {followStatus === "following" || followStatus === "mutual" ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5" /> Following
                    </>
                  ) : followStatus === "requested" ? (
                    <>
                      <Clock className="h-3.5 w-3.5" /> Requested
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" /> Follow
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <h1 className="text-lg font-bold text-white">{profile.displayName}</h1>
          {verified && <BadgeCheck className="h-4.5 w-4.5 text-[#E5484D]" />}
        </div>
        {profile.username && (
          <p className="text-xs text-white/40">@{profile.username}</p>
        )}
        {profile.bio && (
          <p className="mt-2 text-[13px] leading-relaxed text-white/75">
            {profile.bio}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
          {profile.country && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {profile.country}
            </span>
          )}
          {profile.joined && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Joined{" "}
              {new Date(profile.joined).toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="mt-3 flex gap-5 text-[13px]">
          <span className="text-white/50">
            <b className="text-white">{compact(counts?.followers ?? 0)}</b>{" "}
            Followers
          </span>
          <span className="text-white/50">
            <b className="text-white">{compact(counts?.following ?? 0)}</b>{" "}
            Following
          </span>
          <span className="text-white/50">
            <b className="text-white">{posts.length}</b> Posts
          </span>
          <span className="text-white/50">
            <b className="text-white">{products.length}</b> Products
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex border-b border-white/[0.06]">
        {(
          [
            ["posts", "Posts"],
            ["shop", "Shop"],
            ["about", "About"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              haptic("select");
              setTab(key);
            }}
            className={`relative flex-1 py-2.5 text-[13px] font-semibold ${
              tab === key ? "text-white" : "text-white/40"
            }`}
          >
            {label}
            {tab === key && (
              <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-[#E5484D]" />
            )}
          </button>
        ))}
      </div>

      {/* Posts */}
      {tab === "posts" &&
        (posts.length === 0 ? (
          <p className="px-8 py-14 text-center text-xs text-white/35">
            No posts yet.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {posts.map((p: FeedPost) => (
              <button
                key={p.id}
                onClick={() => navigate({ to: "/post/$id", params: { id: p.id } })}
                className="block w-full px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-white">
                    {profile.displayName}
                  </span>
                  <span className="text-[11px] text-white/35">
                    {ago(p.created_at)}
                  </span>
                </div>
                {p.text && (
                  <p className="mt-1 text-[13px] leading-snug text-white/80 line-clamp-4">
                    {p.text}
                  </p>
                )}
                {p.media && p.media.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/[0.06]">
                    <img
                      src={p.media[0].poster_url ?? p.media[0].url}
                      alt=""
                      className="max-h-56 w-full object-cover"
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        ))}

      {/* Shop */}
      {tab === "shop" &&
        (products.length === 0 ? (
          <p className="px-8 py-14 text-center text-xs text-white/35">
            No products listed yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 p-3">
            {products.map((p: ProductDTO) => (
              <button
                key={p.id}
                onClick={() => {
                  haptic("select");
                  setQuickViewId(p.id);
                }}
                className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left"
              >
                <div className="aspect-square bg-white/[0.04]">
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <ShoppingBag className="h-6 w-6 text-white/20" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-[12px] font-semibold text-white line-clamp-1">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-[12px] font-bold text-[#E5484D]">
                    {p.priceUSD <= 0 ? (
                      <span className="text-emerald-400">Free</span>
                    ) : (
                      priceOf(p)
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ))}

      {/* About */}
      {tab === "about" && (
        <div className="space-y-5 p-4">
          {profile.skills.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
                Skills
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-[#E5484D]/25 bg-[#E5484D]/10 px-3 py-1 text-[11px] font-medium text-[#E5484D]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}
          {profile.tools.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
                Tools
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {profile.tools.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/70"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}
          {profile.interests.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
                Interests
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((i) => (
                  <span
                    key={i}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/70"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </section>
          )}
          {profile.socialLinks &&
            Object.values(profile.socialLinks).some(Boolean) && (
              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Links
                </h3>
                <div className="space-y-1.5">
                  {Object.entries(profile.socialLinks)
                    .filter(([, v]) => !!v)
                    .map(([k, v]) => (
                      <a
                        key={k}
                        href={v as string}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-[12px] text-[#E5484D]"
                      >
                        <Link2 className="h-3.5 w-3.5" /> {k}
                      </a>
                    ))}
                </div>
              </section>
            )}
          {profile.skills.length === 0 &&
            profile.tools.length === 0 &&
            profile.interests.length === 0 && (
              <p className="py-10 text-center text-xs text-white/35">
                Nothing shared here yet.
              </p>
            )}
        </div>
      )}

      <ProductQuickView
        productId={quickViewId}
        currency={currency}
        onClose={() => setQuickViewId(null)}
      />
    </div>
  );
}
