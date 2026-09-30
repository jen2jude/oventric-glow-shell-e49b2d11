import { useProfileVisit } from "@/lib/seller-views";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  Sparkles,
  CalendarDays,
  Flag,
  Images,
  Link2,
  Loader2,
  PlayCircle,
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
import {
  listPosts,
  listUserPhotos,
  type FeedPost,
  type UserPhoto,
} from "@/lib/posts.functions";
import { listProducts, type ProductDTO } from "@/lib/marketplace.functions";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { haptic } from "@/lib/haptics";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { visibleProductPrice } from "@/lib/money-visibility";
import { ProductQuickView } from "./ProductQuickView";
import { AppSheet } from "./AppSheet";
import { ConnectionsDialog } from "@/components/oventric/profile/ConnectionsDialog";
import { FollowRequestsDrawer } from "@/components/oventric/FollowRequestsDrawer";
import { ReportModal } from "@/components/oventric/ReportModal";
import { ProfilePostsFeed } from "@/components/oventric/profile/ProfilePostsFeed";
import { ProfileServicesTab } from "@/components/oventric/profile/ProfileServicesTab";
import { ProfileCollectionsTab } from "@/components/oventric/profile/ProfileCollectionsTab";
import { PhotoBatches } from "@/components/oventric/PhotoBatches";
import { ReelsGrid, useReels } from "@/components/oventric/feed/ReelsShelf";

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

type Tab =
  | "posts"
  | "shop"
  | "services"
  | "collections"
  | "photos"
  | "skills"
  | "about";

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
  const { homeCurrency, balancesHidden } = useOnboarding();
  const currency = (homeCurrency ?? "USD") as Currency;
  const priceOf = (p: ProductDTO) => visibleProductPrice({ price_usd: p.priceUSD, original_currency: p.originalCurrency, original_amount: p.originalAmount, fx_snapshot: p.fxSnapshot }, currency, balancesHidden);

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
  useProfileVisit(userId);

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
  const pendingFollowReqCount = followReqData?.length ?? 0;

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
      <div className="h-dvh overflow-y-auto overscroll-contain bg-[#0A0A0B] pb-32 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
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
      <div className="flex h-dvh flex-col items-center justify-center gap-3 overflow-y-auto overscroll-contain bg-[#0A0A0B] px-8 pb-32 text-center [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
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
    <div className="h-dvh overflow-y-auto overscroll-contain bg-[#0A0A0B] pb-32 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
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
          </div>
          <div className="flex items-center gap-2 pb-1">
            {products.length > 0 && (
              <button
                onClick={() => {
                  haptic("select");
                  navigate({ to: "/shop/$id", params: { id: profile.userId } });
                }}
                className="flex items-center gap-1.5 rounded-full border border-[#E5484D]/40 bg-[#E5484D]/10 px-3.5 py-2 text-xs font-semibold text-[#E5484D]"
              >
                <ShoppingBag className="h-3.5 w-3.5" /> View shop
              </button>
            )}
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
            <button
              onClick={() => {
                haptic("select");
                setMenuOpen(true);
              }}
              aria-label="More options"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15"
            >
              <MoreHorizontal className="h-4 w-4 text-white/80" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <h1 className="text-lg font-bold text-white">{profile.displayName}</h1>
          {verified && <BadgeCheck className="h-4.5 w-4.5 text-[#E5484D]" />}
          {profile.isCreator && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#E5484D] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" title="Oventric creator">
              <Sparkles className="h-3 w-3" /> Creator
            </span>
          )}
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
          <button
            onClick={() => {
              setConnectionsTab("followers");
              setConnectionsOpen(true);
            }}
            className="text-white/50"
          >
            <b className="text-white">{compact(counts?.followers ?? 0)}</b>{" "}
            Followers
          </button>
          <button
            onClick={() => {
              setConnectionsTab("following");
              setConnectionsOpen(true);
            }}
            className="text-white/50"
          >
            <b className="text-white">{compact(counts?.following ?? 0)}</b>{" "}
            Following
          </button>
          <span className="text-white/50">
            <b className="text-white">{posts.length}</b> Posts
          </span>
          <span className="text-white/50">
            <b className="text-white">{products.length}</b> Products
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex overflow-x-auto no-scrollbar border-b border-white/[0.06]">
        {(
          [
            ["posts", "Posts"],
            ["shop", "Shop"],
            ["services", "Services"],
            ["collections", "Collections"],
            ["photos", "Photos"],
            ["skills", "Skills"],
            ["about", "About"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              haptic("select");
              setTab(key);
            }}
            className={`relative flex-1 shrink-0 px-4 py-2.5 text-[13px] font-semibold ${
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

      {/* Posts — same wall feed and composer as the Newsfeed */}
      {tab === "posts" && profile.userId && (
        <div className="px-3 pt-3">
          <ProfilePostsFeed
            wallUserId={profile.userId}
            wallOwnerName={profile.displayName}
            viewerId={me ?? null}
          />
        </div>
      )}

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

      {/* Services */}
      {tab === "services" && (
        <div className="p-4">
          <ProfileServicesTab
            items={services}
            isOwner={isOwn}
            price={(usd) => (usd <= 0 ? "Free" : `$${usd.toFixed(2)}`)}
          />
        </div>
      )}

      {/* Skills */}
      {/* Collections — curated boards + saved items */}
      {tab === "collections" && (
        <div className="px-4 pt-4">
          <ProfileCollectionsTab
            idOrSlug={idOrSlug}
            name={profile.displayName}
            isOwner={isOwn}
          />
        </div>
      )}

      {/* Photos — every image they've uploaded across the platform */}
      {tab === "photos" && <AppPhotosGallery idOrSlug={idOrSlug} />}

      {tab === "skills" && (
        <div className="space-y-5 p-4">
          {profile.skills.length === 0 && profile.tools.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-white/35">
              No skills listed yet.
            </p>
          ) : null}
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
        </div>
      )}

      {/* About */}
      {tab === "about" && (
        <div className="space-y-5 p-4">
          {profile.interests.length === 0 &&
          !Object.values(profile.socialLinks ?? {}).some(Boolean) ? (
            <p className="px-4 py-10 text-center text-xs text-white/35">
              Nothing here yet.
            </p>
          ) : null}
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
        </div>
      )}

      <ProductQuickView
        productId={quickViewId}
        currency={currency}
        onClose={() => setQuickViewId(null)}
      />

      {/* More options */}
      <AppSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="space-y-1 p-4">
          <button
            onClick={() => {
              setMenuOpen(false);
              void shareProfile();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold text-white/85 active:bg-white/[0.04]"
          >
            <Share2 className="h-4 w-4 text-white/50" /> Share profile
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              setConnectionsTab("all");
              setConnectionsOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold text-white/85 active:bg-white/[0.04]"
          >
            <Users className="h-4 w-4 text-white/50" /> Connections
          </button>
          {isOwn && (
            <button
              onClick={() => {
                setMenuOpen(false);
                setFollowReqOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold text-white/85 active:bg-white/[0.04]"
            >
              <UserPlus className="h-4 w-4 text-white/50" /> Follow requests
              {pendingFollowReqCount > 0 && (
                <span className="ml-auto rounded-full bg-[#E5484D] px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingFollowReqCount}
                </span>
              )}
            </button>
          )}
          {!isOwn && (
            <button
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold text-[#E5484D] active:bg-white/[0.04]"
            >
              <Flag className="h-4 w-4" /> Report profile
            </button>
          )}
        </div>
      </AppSheet>

      {userId && (
        <ConnectionsDialog
          open={connectionsOpen}
          onOpenChange={setConnectionsOpen}
          userId={userId}
          name={profile.displayName}
          viewerId={me}
          initialTab={connectionsTab}
        />
      )}
      <FollowRequestsDrawer
        open={followReqOpen}
        onClose={() => setFollowReqOpen(false)}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target="profile"
        targetKind="profile"
        targetId={userId ?? idOrSlug}
        onReported={() => setReportOpen(false)}
      />
    </div>
  );
}

/** Photos tab — every image the member has uploaded (posts, avatar, cover) plus reels. */
function AppPhotosGallery({ idOrSlug }: { idOrSlug: string }) {
  const fetchPhotos = useServerFn(listUserPhotos);
  const [photos, setPhotos] = useState<UserPhoto[] | null>(null);
  const [filter, setFilter] = useState<"all" | "avatar" | "cover" | "post" | "reels">(
    "all",
  );
  const reels = useReels(true, idOrSlug, 60);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) {
          if (!cancel) setPhotos([]);
          return;
        }
        const r = await fetchPhotos({ data: { slugOrId: idOrSlug } });
        if (!cancel) setPhotos(r.photos);
      } catch {
        if (!cancel) setPhotos([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fetchPhotos, idOrSlug]);

  if (photos === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      </div>
    );
  }

  const filtered =
    filter === "all" || filter === "reels"
      ? photos
      : photos.filter((p) => p.source === filter);

  const chip = (v: typeof filter, label: string) => (
    <button
      key={v}
      onClick={() => {
        haptic("select");
        setFilter(v);
      }}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        filter === v
          ? "border-[#E5484D]/50 bg-[#E5484D]/15 text-[#E5484D]"
          : "border-white/10 text-white/45"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {chip("all", "All")}
        {chip("reels", "Reels")}
        {chip("post", "Posts")}
        {chip("avatar", "Profile")}
        {chip("cover", "Cover")}
      </div>
      {filter === "reels" ? (
        reels === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : reels.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5484D]/30 bg-[#E5484D]/10 text-[#E5484D]">
              <PlayCircle className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold text-white/80">No reels yet</div>
            <p className="mx-auto mt-1 max-w-sm text-xs text-white/40">
              Short videos and stories stay here after 24 hours and keep collecting views.
            </p>
          </div>
        ) : (
          <ReelsGrid reels={reels} />
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5484D]/30 bg-[#E5484D]/10 text-[#E5484D]">
            <Images className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold text-white/80">No photos yet</div>
          <p className="mx-auto mt-1 max-w-sm text-xs text-white/40">
            Photos from posts, profile picture and cover image will show up here.
          </p>
        </div>
      ) : (
        <PhotoBatches photos={filtered} dense />
      )}
    </div>
  );
}
