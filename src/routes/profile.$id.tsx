import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfileEcosystem } from "@/lib/ecosystem/useProfileEcosystem";

import {
  getCircleStatus,
  sendCircleRequest,
  cancelCircleRequest,
  type CircleStatus,
} from "@/lib/circles.functions";
import {
  getLiveProfileTab,
  getLiveReputation,
  getProfileByIdOrSlug,
  getProfileSocialCounts,
  updateMyProfile,
  type LiveReputation,
  type ProfileSocialCounts,
  type RealProfileView,
  type ProfileTabPage,
  type ProfileSortKey,
} from "@/lib/profiles.functions";
import type {
  ProfilePost,
  ProfileGroup,
  ProfileListing,
  ProfileBounty,
} from "@/lib/profiles/mockProfiles";
import {
  ArrowLeft,
  Star,
  MessageCircle,
  UserPlus,
  Check,
  Users,
  ShoppingBag,
  Target,
  Award,
  ShieldCheck,
  X,
  Flag,
  ExternalLink,
  Link2,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Clock,
  Loader2,
  Camera,
  Images,
  Pencil,
  Globe,
  Twitter,
  Instagram,
  Linkedin,
  Github,
  Youtube,
  Music2,
  Facebook,
  Send,
  FileText,
  MapPin,
  Share2,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";

import { openSocialLink, SOCIAL_LABELS } from "@/lib/profiles/socialDeepLinks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Renders the matching brand glyph for a social-link key. */
function SocialIcon({ kind }: { kind: string }) {
  const cls = "w-4 h-4";
  if (kind === "x") return <Twitter className={cls} />;
  if (kind === "instagram") return <Instagram className={cls} />;
  if (kind === "linkedin") return <Linkedin className={cls} />;
  if (kind === "github") return <Github className={cls} />;
  if (kind === "youtube") return <Youtube className={cls} />;
  if (kind === "tiktok") return <Music2 className={cls} />;
  if (kind === "facebook") return <Facebook className={cls} />;
  if (kind === "whatsapp") return <MessageCircle className={cls} />;
  if (kind === "telegram") return <Send className={cls} />;
  return <Globe className={cls} />;
}

/** Returns the emoji flag for a stored country name or ISO code. */
function CountryFlag({ country }: { country: string | null | undefined }) {
  const code = normalizeCountryCode(country);
  const flag = code ? COUNTRY_META[code]?.flag : undefined;
  if (!flag) return null;
  return <span className="leading-none">{flag}</span>;
}

import { listUserPhotos, type UserPhoto } from "@/lib/posts.functions";
import { ReelsGrid, useReels } from "@/components/oventric/feed/ReelsShelf";
import { PlayCircle } from "lucide-react";
import { getDashboardOverview, type DashboardOverview } from "@/lib/dashboard.functions";
import { ImageLightbox } from "@/components/oventric/feed/ImageLightbox";
import { PhotoBatches } from "@/components/oventric/PhotoBatches";
import { ProfileOverview } from "@/components/oventric/profile/ProfileOverview";
import { ProfilePostsFeed } from "@/components/oventric/profile/ProfilePostsFeed";
import { ProfileShopTab } from "@/components/oventric/profile/ProfileShopTab";
import { ProfileCoursesTab } from "@/components/oventric/profile/ProfileCoursesTab";
import { ProfileServicesTab } from "@/components/oventric/profile/ProfileServicesTab";
import { ProfileSkillsTab } from "@/components/oventric/profile/ProfileSkillsTab";
import { ProfileCollectionsTab } from "@/components/oventric/profile/ProfileCollectionsTab";
import { ProfileAboutTab } from "@/components/oventric/profile/ProfileAboutTab";

import { Header } from "@/components/oventric/Header";
import { SiteNavbar } from "@/components/oventric/desktop/SiteNavbar";

import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { normalizeCountryCode, COUNTRY_META } from "@/lib/currency/africa";
import {
  getProfile,
  computeStarBreakdown,
  getCircleMembersPreview,
} from "@/lib/profiles/mockProfiles";
import { ReportModal } from "@/components/oventric/ReportModal";
import { EditProfileModal } from "@/components/oventric/EditProfileModal";
import { CircleRequestsDrawer } from "@/components/oventric/CircleRequestsDrawer";
import { FollowRequestsDrawer } from "@/components/oventric/FollowRequestsDrawer";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { EarningsBreakdown } from "@/components/oventric/profile/EarningsBreakdown";
import {
  ConnectionsDialog,
  type ConnectionsTab,
} from "@/components/oventric/profile/ConnectionsDialog";

import { usePresence } from "@/hooks/use-presence";
import { FollowButton } from "@/components/oventric/FollowButton";
import { JoinCirclePickerModal } from "@/components/oventric/JoinCirclePickerModal";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { Button } from "@/components/ui/button";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

const profileSearchSchema = z.object({
  tab: fallback(z.string(), "overview").default("overview"),
  pages: fallback(z.number().int(), 1).default(1),
  y: fallback(z.number().int(), 0).default(0),
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "newest").default("newest"),
});

export const Route = createFileRoute("/profile/$id")({
  validateSearch: zodValidator(profileSearchSchema),
  head: ({ params }) => ({
    meta: [
      { title: `@${params.id} · Oventric` },
      {
        name: "description",
        content: `Profile, listings, and bounties for ${params.id} on Oventric.`,
      },
      { property: "og:title", content: `@${params.id} · Oventric` },
      {
        property: "og:description",
        content: `Profile, listings, and bounties for ${params.id} on Oventric.`,
      },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: `https://oventric.com/profile/${params.id}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type Tab =
  | "posts"
  | "groups"
  | "marketplace"
  | "services"
  | "skills"
  | "collections"
  | "courses"
  | "posted"
  | "solved";
const TAB_KEYS: Tab[] = [
  "posts",
  "groups",
  "marketplace",
  "services",
  "skills",
  "collections",
  "courses",
  "posted",
  "solved",
];
const isTab = (v: string): v is Tab => (TAB_KEYS as string[]).includes(v);

type SortOption = { value: ProfileSortKey; label: string };
const SORT_OPTIONS_BY_TAB: Record<Tab, SortOption[]> = {
  posts: [
    { value: "newest", label: "Newest" },
    { value: "most_liked", label: "Most liked" },
    { value: "most_commented", label: "Most commented" },
  ],
  groups: [
    { value: "newest", label: "Newest" },
    { value: "most_members", label: "Most members" },
    { value: "alpha", label: "A – Z" },
  ],
  marketplace: [
    { value: "newest", label: "Newest" },
    { value: "price_low", label: "Price: low to high" },
    { value: "price_high", label: "Price: high to low" },
    { value: "most_sold", label: "Most sold" },
    { value: "alpha", label: "A – Z" },
  ],
  services: [
    { value: "newest", label: "Newest" },
    { value: "price_low", label: "Price: low to high" },
    { value: "price_high", label: "Price: high to low" },
    { value: "alpha", label: "A – Z" },
  ],
  courses: [
    { value: "newest", label: "Newest" },
    { value: "price_low", label: "Price: low to high" },
    { value: "price_high", label: "Price: high to low" },
    { value: "alpha", label: "A – Z" },
  ],

  posted: [
    { value: "newest", label: "Newest" },
    { value: "highest_bounty", label: "Highest bounty" },
    { value: "lowest_bounty", label: "Lowest bounty" },
    { value: "most_applicants", label: "Most applicants" },
  ],
  solved: [
    { value: "newest", label: "Newest" },
    { value: "highest_bounty", label: "Highest bounty" },
    { value: "lowest_bounty", label: "Lowest bounty" },
  ],
  skills: [{ value: "newest", label: "Newest" }],
  collections: [{ value: "newest", label: "Newest" }],
};
const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  posts: "Search posts…",
  groups: "Search groups…",
  marketplace: "Search listings…",
  services: "Search services…",
  skills: "Search skills…",
  collections: "Search boards…",
  courses: "Search courses…",
  posted: "Search bounties…",
  solved: "Search solved bounties…",
};

function ProfilePage() {
  const { id } = Route.useParams();
  const isAppShellView = useIsAppShell();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const profile = useMemo(() => getProfile(id), [id]);
  const { require, baseCurrency } = useOnboarding();

  const tab: Tab = isTab(search.tab) ? search.tab : "posts";
  useEffect(() => {
    // If user comes from a shop link with specific tab, we might want to respect it
    // but typically profile has its own tab state.
  }, [search.tab]);

  // "Overview" is the curated landing view of the identity hub; every other

  // value maps to a live data tab.
  const overviewMode = !isTab(search.tab) && search.tab !== "photos";
  const desiredPages = Math.max(1, Math.min(200, search.pages || 1));
  const restoreY = Math.max(0, search.y || 0);
  const q = (search.q || "").trim();
  const sort = SORT_OPTIONS_BY_TAB[tab].some((o) => o.value === search.sort)
    ? (search.sort as ProfileSortKey)
    : "newest";
  const [photosMode, setPhotosMode] = useState(search.tab === "photos");
  const [aboutMode, setAboutMode] = useState(false);
  useEffect(() => {
    if (search.tab === "photos") {
      setAboutMode(false);
      setPhotosMode(true);
    }
  }, [search.tab, id]);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<ConnectionsTab>("followers");
  const presence = usePresence();
  const onlineUsers = presence.online;
  const openRelationships = (which: ConnectionsTab) => {
    setConnectionsTab(which);
    setConnectionsOpen(true);
  };


  // Search state to hand off to item detail pages so their back link returns
  // to the exact tab, pagination depth, and scroll position we're in.
  const itemSearch = { tab, pages: desiredPages, y: restoreY, q, sort };

  /** Shares the profile via the native share sheet, falling back to copy. */
  const shareProfile = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.origin + `/profile/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Oventric profile", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch {
      /* user dismissed the share sheet */
    }
  }, [id]);

  const [circle, setCircle] = useState<CircleStatus>("none");
  const [circleBusy, setCircleBusy] = useState(false);
  const [circleError, setCircleError] = useState<string | null>(null);
  const [circleMeta, setCircleMeta] = useState<{
    sentAt: string | null;
    acceptedAt: string | null;
    canceledAt: string | null;
  }>({ sentAt: null, acceptedAt: null, canceledAt: null });
  const [dmOpen, setDmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [joinCircleOpen, setJoinCircleOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [followRequestsOpen, setFollowRequestsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mpLastRefreshed, setMpLastRefreshed] = useState<number | null>(null);
  const [mpRefreshing, setMpRefreshing] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const mpPagesRef = useRef(1);

  // Per-tab paginated data. Items accumulate on "Load more".
  type TabState = {
    items: ProfileTabPage["items"];
    page: number;
    total: number | null;
    hasMore: boolean;
    loading: boolean;
    error: string | null;
  };
  const emptyTabState: TabState = {
    items: [],
    page: 0,
    total: null,
    hasMore: true,
    loading: false,
    error: null,
  };
  const [tabData, setTabData] = useState<Record<Tab, TabState>>({
    posts: { ...emptyTabState },
    groups: { ...emptyTabState },
    marketplace: { ...emptyTabState },
    services: { ...emptyTabState },
    skills: { ...emptyTabState },
    collections: { ...emptyTabState },
    courses: { ...emptyTabState },
    posted: { ...emptyTabState },
    solved: { ...emptyTabState },
  });
  const PAGE_SIZE = 6;

  const fetchTab = useServerFn(getLiveProfileTab);
  const fetchStatus = useServerFn(getCircleStatus);
  const sendReq = useServerFn(sendCircleRequest);
  const cancelReq = useServerFn(cancelCircleRequest);
  const fetchRealProfile = useServerFn(getProfileByIdOrSlug);
  const fetchReputation = useServerFn(getLiveReputation);
  const fetchSocialCounts = useServerFn(getProfileSocialCounts);

  const [realProfile, setRealProfile] = useState<RealProfileView | null>(null);
  const isViewedUserOnline = !!realProfile?.userId && onlineUsers.has(realProfile.userId);
  const [realProfileLoaded, setRealProfileLoaded] = useState(false);
  const [liveRep, setLiveRep] = useState<LiveReputation | null>(null);
  const [socialCounts, setSocialCounts] = useState<ProfileSocialCounts | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setMeId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setMeId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const reloadSocialCounts = useCallback(() => {
    fetchSocialCounts({ data: { idOrSlug: id } })
      .then((c) => setSocialCounts(c))
      .catch(() => {});
  }, [fetchSocialCounts, id]);

  // ------- Avatar & cover image upload (own profile only) -------
  const updateProfileFn = useServerFn(updateMyProfile);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  // Instant local previews so the new image shows the moment it is uploaded,
  // even if the freshly signed URL has not been re-fetched yet.
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [localCoverPreview, setLocalCoverPreview] = useState<string | null>(null);
  const reloadRealProfile = useCallback(async () => {
    try {
      const p = await fetchRealProfile({ data: { idOrSlug: id } });
      setRealProfile(p.profile);
    } catch (e) {
      console.error("[profile] reload after upload failed", e);
    }
  }, [fetchRealProfile, id]);
  const handleImagePicked = useCallback(
    async (kind: "avatar" | "cover", file: File | null | undefined) => {
      if (!file || !meId) return;
      if (!file.type.startsWith("image/")) {
        alert("Please choose an image file.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert("Image is too large (max 8MB).");
        return;
      }
      const bucket = kind === "avatar" ? "avatars" : "profile-covers";
      const ext =
        (file.name.split(".").pop() || "jpg")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 6) || "jpg";
      const path = `${meId}/${crypto.randomUUID()}.${ext}`;
      setUploading(kind);
      try {
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (upErr) throw upErr;
        await updateProfileFn({
          data: kind === "avatar" ? { avatarPath: path } : { coverPath: path },
        });
        // Show the picked image immediately.
        const preview = URL.createObjectURL(file);
        if (kind === "avatar") {
          setLocalAvatarPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return preview;
          });
        } else {
          setLocalCoverPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return preview;
          });
        }
        await reloadRealProfile();
        try {
          window.dispatchEvent(
            new CustomEvent("oventric:profile-updated", { detail: { userId: meId } }),
          );
        } catch {
          /* noop */
        }
      } catch (e) {
        console.error("[profile] upload failed", e);
        alert(`Upload failed: ${e instanceof Error ? e.message : "Please try again."}`);
      } finally {
        setUploading(null);
      }
    },
    [meId, updateProfileFn, reloadRealProfile],
  );

  // Cross-component sync: whenever profile is updated elsewhere (Settings modal,
  // KYC edit, avatar change in Header, etc.), refetch so this page reflects it.
  useEffect(() => {
    const onUpdated = () => {
      void reloadRealProfile();
    };
    window.addEventListener("oventric:profile-updated", onUpdated);
    return () => window.removeEventListener("oventric:profile-updated", onUpdated);
  }, [reloadRealProfile]);

  useEffect(() => {
    let cancelled = false;
    setRealProfileLoaded(false);
    setRealProfile(null);
    (async () => {
      try {
        const [pRes, rRes, cRes] = await Promise.all([
          fetchRealProfile({ data: { idOrSlug: id } }),
          fetchReputation({ data: { idOrSlug: id } }),
          fetchSocialCounts({ data: { idOrSlug: id } }),
        ]);
        if (cancelled) return;
        setRealProfile(pRes.profile);
        setLiveRep(rRes.reputation);
        setSocialCounts(cRes);
      } catch (e) {
        console.error("[profile] real load failed", e);
      } finally {
        if (!cancelled) setRealProfileLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchRealProfile, fetchReputation, fetchSocialCounts]);

  // Realtime: keep followers / circle members counters in sync with reality.
  useEffect(() => {
    const uid =
      realProfile?.userId ??
      (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : (socialCounts?.userId ?? null));
    if (!uid) return;
    const ch = supabase
      .channel(`profile-social-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `followee_id=eq.${uid}` },
        () => reloadSocialCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${uid}` },
        () => reloadSocialCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_members", filter: `user_id=eq.${uid}` },
        () => reloadSocialCounts(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realProfile?.userId, id]);

  // Pending incoming follow-request count (own profile) — powers the RGB glow dot
  // on the "Follow Requests" trigger.
  const [pendingFollowReqCount, setPendingFollowReqCount] = useState(0);
  useEffect(() => {
    if (!meId) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("follow_requests")
        .select("id", { count: "exact", head: true })
        .eq("target_id", meId)
        .eq("status", "pending");
      if (!cancelled) setPendingFollowReqCount(count ?? 0);
    };
    load();
    const ch = supabase
      .channel(`follow-req-count-${meId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follow_requests", filter: `target_id=eq.${meId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [meId]);

  const isUuidId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isOwnProfile = !!(meId && (meId === id || (realProfile && meId === realProfile.userId)));
  // Adaptive ecosystem sections: a person's profile only shows the surfaces
  // they actually use (shop, services, courses, communities…).
  const { sections: ecosystemSections } = useProfileEcosystem(id, isOwnProfile);

  const fetchOverview = useServerFn(getDashboardOverview);
  useEffect(() => {
    if (!isOwnProfile) {
      setOverview(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await fetchOverview();
        if (alive) setOverview(res);
      } catch {
        if (alive) setOverview(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOwnProfile, fetchOverview]);

  const {
    containerRef: mainRef,
    getScrollY,
    setScrollY,
    pinAcrossChange,
    restore: restoreScroll,
    isRestored,
    markRestored,
  } = useScrollRestoration(tab);

  // Fetch a specific page (1-indexed). Returns the fetched response.
  const fetchOne = useCallback(
    async (
      which: Tab,
      pageNum: number,
      reset: boolean,
      filters: { q: string; sort: ProfileSortKey },
    ) => {
      const res = await fetchTab({
        data: {
          idOrSlug: id,
          tab: which,
          page: pageNum,
          pageSize: PAGE_SIZE,
          q: filters.q,
          sort: filters.sort,
        },
      });

      setTabData((s) => ({
        ...s,
        [which]: {
          items: reset ? res.items : [...s[which].items, ...res.items],
          page: res.page,
          total: res.total,
          hasMore: res.hasMore,
          loading: false,
          error: null,
        },
      }));
      return res;
    },
    [profile.id, fetchTab],
  );

  // Scroll read/write is provided by useScrollRestoration above.

  // Load next page for a tab (used by "Load more"). Syncs URL.
  const loadMore = useCallback(async () => {
    const current = tabData[tab];
    if (current.loading || !current.hasMore) return;
    setTabData((s) => ({ ...s, [tab]: { ...s[tab], loading: true, error: null } }));
    const nextPage = (current.page || 0) + 1;
    try {
      await fetchOne(tab, nextPage, false, { q, sort });
      const y = getScrollY();
      navigate({
        to: "/profile/$id",
        params: { id },
        search: (prev: Record<string, unknown>) => ({ ...prev, tab, pages: nextPage, y }),
        replace: true,
        resetScroll: false,
      });
    } catch (e) {
      console.error(e);
      setTabData((s) => ({
        ...s,
        [tab]: { ...s[tab], loading: false, error: "Couldn't load. Try again." },
      }));
    }
  }, [tab, tabData, fetchOne, navigate, id, q, sort, getScrollY]);

  // Scroll so the tab rail sits just under the sticky header — the tab
  // content then starts at the top of the viewport, ready to scroll.
  const tabsNavRef = useRef<HTMLElement | null>(null);
  const tabsTopY = useCallback((): number => {
    const nav = tabsNavRef.current;
    if (!nav) return getScrollY();
    const navTop = nav.getBoundingClientRect().top;
    const el = mainRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1) {
      return Math.max(0, el.scrollTop + (navTop - el.getBoundingClientRect().top) - 8);
    }
    return Math.max(0, window.scrollY + navTop - 64);
  }, [getScrollY, mainRef]);

  // Change tabs — snap the tab rail to the top so the new section starts there.
  const changeTab = useCallback(
    (next: Tab) => {
      const targetY = tabsTopY();
      pinAcrossChange(targetY);
      if (next === tab) {
        requestAnimationFrame(() => restoreScroll(targetY));
        return;
      }
      const nextSort = SORT_OPTIONS_BY_TAB[next].some((o) => o.value === sort) ? sort : "newest";
      navigate({
        to: "/profile/$id",
        params: { id },
        search: { tab: next, pages: 1, y: targetY, q, sort: nextSort },
        replace: true,
        resetScroll: false,
      });
    },
    [tab, navigate, id, tabsTopY, pinAcrossChange, restoreScroll, q, sort],
  );


  // Retry a failed tab: clear its cache so the load effect refetches up to
  // the current desiredPages (preserving pagination). Also reset scroll.
  const retryTab = useCallback(
    (which: Tab) => {
      markRestored(true); // don't try to restore old scroll
      setTabData((s) => ({ ...s, [which]: { ...emptyTabState } }));
      navigate({
        to: "/profile/$id",
        params: { id },
        search: (prev: Record<string, unknown>) => ({ ...prev, tab: which, y: 0 }),
        replace: true,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, id],
  );

  // Load (or reload) the active tab up to `desiredPages`, then restore scroll.
  useEffect(() => {
    let cancelled = false;
    if (tab === "skills" || tab === "collections") return;
    const state = tabData[tab];
    // Only trigger the initial hydration for this tab.
    if (state.page !== 0 || state.loading) return;
    (async () => {
      setTabData((s) => ({ ...s, [tab]: { ...s[tab], loading: true, error: null } }));
      try {
        let last = await fetchOne(tab, 1, true, { q, sort });
        for (let p = 2; p <= desiredPages && last.hasMore && !cancelled; p++) {
          last = await fetchOne(tab, p, false, { q, sort });
        }
        if (cancelled) return;
        // Restore scroll after content is on the page. Prefer the tab-switch
        // target (in-page tab change) over the URL-derived restoreY.
        requestAnimationFrame(() => {
          if (!isRestored()) {
            restoreScroll(restoreY);
          }
        });
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setTabData((s) => ({
          ...s,
          [tab]: { ...s[tab], loading: false, error: "Couldn't load. Try again." },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile.id, q, sort]);

  // Reset caches when navigating to a different profile.
  useEffect(() => {
    markRestored(false);
    setTabData({
      posts: { ...emptyTabState },
      groups: { ...emptyTabState },
      marketplace: { ...emptyTabState },
      services: { ...emptyTabState },
      skills: { ...emptyTabState },
      collections: { ...emptyTabState },
      courses: { ...emptyTabState },
      posted: { ...emptyTabState },
      solved: { ...emptyTabState },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // When search query or sort changes, invalidate the current tab so it
  // reloads with the new filters. Do not run this on tab switches: clearing
  // the newly active tab briefly shrinks the page and mobile browsers clamp
  // the scroll position upward before the new content renders.
  useEffect(() => {
    if (isRestored()) markRestored(true); // don't cancel a pending tab-switch restore
    setTabData((s) => ({ ...s, [tab]: { ...emptyTabState } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort]);

  // Persist scroll position into the URL (throttled) so reloads restore it.
  useEffect(() => {
    const el = mainRef.current;
    const usesMain = !!(el && el.scrollHeight > el.clientHeight + 1);
    const target: HTMLElement | Window = usesMain ? (el as HTMLElement) : window;
    let raf = 0;
    let lastWritten = restoreY;
    const readY = () => (usesMain ? (el as HTMLElement).scrollTop : window.scrollY);
    const onScroll = () => {
      if (!isRestored()) return;
      if (raf) return;
      raf = window.setTimeout(() => {
        raf = 0;
        const y = Math.round(readY());
        if (Math.abs(y - lastWritten) < 40) return;
        lastWritten = y;
        navigate({
          to: "/profile/$id",
          params: { id },
          search: (prev: Record<string, unknown>) => ({ ...prev, y }),
          replace: true,
          resetScroll: false,
        });
      }, 200) as unknown as number;
    };
    target.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    return () => {
      target.removeEventListener("scroll", onScroll as EventListener);
      if (raf) window.clearTimeout(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile.id]);

  // Report whether a real (non-anonymous) session exists. Never create an
  // anonymous session — that would make the app think the visitor is signed in
  // and skip the sign-in / sign-up gate entirely.
  const ensureSession = async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    return !!user && !(user as { is_anonymous?: boolean }).is_anonymous;
  };

  const circleTargetSlug = realProfile?.slug ?? profile.id;

  // Load initial status for this profile — keyed to the real profile slug once
  // it resolves so the button reflects the actual circle_requests row.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!(await ensureSession())) return;
        const res = await fetchStatus({ data: { targetSlug: circleTargetSlug } });
        if (cancelled) return;
        setCircle(res.status);
        setCircleMeta({
          sentAt: res.sentAt,
          acceptedAt: res.status === "accepted" ? res.updatedAt : null,
          canceledAt: null,
        });
      } catch (e) {
        console.error(e);
      }
    };
    void load();
    // Refetch when the tab regains focus so acceptance by the target user
    // flips the button from Pending → In Circle without a manual reload.
    const onFocus = () => void load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [circleTargetSlug, fetchStatus]);

  const rep = profile.reputation;
  const starBreakdown = useMemo(() => computeStarBreakdown(rep), [rep]);
  const circleMembers = useMemo(() => getCircleMembersPreview(profile), [profile]);
  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const price = (usd: number) =>
    `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: baseCurrency === "USD" ? 0 : 0 })}`;

  // Real-profile overlay. When we have a live row, prefer its identity fields
  // over the deterministic mock so the header shows the real person.
  // When the URL id is a raw UUID, don't derive garbage names/initials from
  // it — wait for the real row or show a clean placeholder.
  const hasRealProfile = !!realProfile;
  const identityPending = isUuidId && !realProfileLoaded && !hasRealProfile;
  const identityMissing = isUuidId && realProfileLoaded && !hasRealProfile;
  const displayName = hasRealProfile
    ? realProfile!.displayName || "Unnamed member"
    : isUuidId
      ? identityPending
        ? "Loading profile…"
        : "Profile unavailable"
      : profile.name;
  const displayInitials = (() => {
    if (hasRealProfile) {
      const source = realProfile!.displayName || "";
      const parts = source.trim().split(/\s+/).slice(0, 2);
      const s = parts.map((w) => w[0]?.toUpperCase() ?? "").join("");
      return s || "??";
    }
    if (isUuidId) return "··";
    return profile.initials;
  })();
  const displayBio = hasRealProfile ? (realProfile!.bio ?? "") : isUuidId ? "" : profile.bio;
  const displayRole = hasRealProfile
    ? realProfile!.username
      ? `@${realProfile!.username}`
      : "Member"
    : isUuidId
      ? ""
      : profile.role;
  const displayJoined = hasRealProfile
    ? new Date(realProfile!.joined).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : isUuidId
      ? "—"
      : profile.joined;
  const displayAvatar = realProfile?.avatarUrl ?? null;
  const displayTierLabel = hasRealProfile
    ? realProfile!.verificationTier === "TIER_0"
      ? "Unverified"
      : `${realProfile!.verificationTier.replace("_", " ")} Verified`
    : isUuidId
      ? "Unverified"
      : "Verified";

  const handleJoin = () => {
    require(1, async () => {
      setCircleBusy(true);
      setCircleError(null);
      try {
        await ensureSession();
        if (circle === "none") {
          const res = await sendReq({ data: { targetSlug: circleTargetSlug } });
          setCircle(res.status);
          setCircleMeta({ sentAt: res.sentAt, acceptedAt: null, canceledAt: null });
        } else if (circle === "pending") {
          const res = await cancelReq({ data: { targetSlug: circleTargetSlug } });
          setCircle(res.status);
          setCircleMeta((m) => ({
            sentAt: m.sentAt,
            acceptedAt: null,
            canceledAt: res.canceledAt,
          }));
        }
      } catch (e) {
        console.error(e);
        setCircleError("Something went wrong. Try again.");
      } finally {
        setCircleBusy(false);
      }
    });
  };
  const handleChat = () => require(1, () => setDmOpen(true));
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent fail
    }
  };

  // Track how many marketplace pages are currently loaded so background
  // refreshes rehydrate the same window the user is viewing.
  useEffect(() => {
    mpPagesRef.current = Math.max(1, tabData.marketplace.page || 1);
  }, [tabData.marketplace.page]);

  // Silently refetch all currently-loaded marketplace pages and replace items
  // in place. Used by the auto-refresh interval and the manual Refresh button.
  const refreshMarketplace = useCallback(async () => {
    setMpRefreshing(true);
    try {
      const pagesToLoad = mpPagesRef.current;
      const collected: ProfileTabPage["items"] = [];
      let last: ProfileTabPage | null = null;
      for (let p = 1; p <= pagesToLoad; p++) {
        const res: ProfileTabPage = await fetchTab({
          data: { idOrSlug: id, tab: "marketplace", page: p, pageSize: PAGE_SIZE, q, sort },
        });
        last = res;
        collected.push(...res.items);
        if (!res.hasMore) break;
      }

      setTabData((s) => ({
        ...s,
        marketplace: {
          items: collected,
          page: last?.page ?? s.marketplace.page,
          total: last?.total ?? s.marketplace.total,
          hasMore: last?.hasMore ?? s.marketplace.hasMore,
          loading: false,
          error: null,
        },
      }));
      setMpLastRefreshed(Date.now());
    } catch (e) {
      console.error(e);
    } finally {
      setMpRefreshing(false);
    }
  }, [id, q, sort, fetchTab]);

  // Seed the "last updated" timestamp when marketplace items first appear.
  useEffect(() => {
    if (tab === "marketplace" && tabData.marketplace.items.length > 0 && mpLastRefreshed === null) {
      setMpLastRefreshed(Date.now());
    }
  }, [tab, tabData.marketplace.items.length, mpLastRefreshed]);

  // Auto-refresh marketplace every 15s while the tab is active. Also drives a
  // 1s ticker so the "Xs ago" label stays accurate without extra state.
  useEffect(() => {
    if (tab !== "marketplace") return;
    const refresh = window.setInterval(() => {
      refreshMarketplace();
    }, 15000);
    const tick = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
    };
  }, [tab, refreshMarketplace]);

  const mpAgoLabel = (() => {
    if (mpLastRefreshed === null) return "syncing…";
    const s = Math.max(0, Math.floor((nowTick - mpLastRefreshed) / 1000));
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    return `${m}m ago`;
  })();

  return (
    <div
      className={`profile-render-safe relative min-h-screen overflow-x-hidden bg-[#121214] md:bg-slate-50 text-slate-200 md:text-slate-700 md:h-screen md:overflow-hidden ${!isAppShellView ? "oventric-web" : ""}`}
    >
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50  hidden md:block" />

      <div className="flex min-h-screen flex-col md:h-full md:min-h-0">
        <Header forceSiteNavbar={!isAppShellView} />
        <main ref={mainRef} className="flex-1 min-w-0 pb-20 md:overflow-y-auto md:pb-0">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-10">
            {/* Hero — the whole mobile profile surface is intentionally plain:
                 no animated gradients, filters, backdrop blur, blend modes,
                 compositor promotion, or clipped gradient layers. Those effects
                 were the source of Android/Chrome static-noise corruption on
                 Infinix and Redmi devices during pull-to-refresh / reload. */}
            {/* Hidden file inputs for avatar / cover uploads (own profile). */}
            {isOwnProfile && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none",
                    overflow: "hidden",
                  }}
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    handleImagePicked("avatar", f);
                    if (e.target) e.target.value = "";
                  }}
                />
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none",
                    overflow: "hidden",
                  }}
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    handleImagePicked("cover", f);
                    if (e.target) e.target.value = "";
                  }}
                />
              </>
            )}

            <section
              data-testid="profile-banner"
              className="profile-card-safe profile-standard-header mb-6 md:overflow-hidden md:rounded-[10px] md:border md:border-slate-200 md:bg-white md:shadow-sm"
            >
              {/* Cover image — full-bleed hero */}
              <div className="profile-cover-safe relative -mx-4 -mt-6 h-56 overflow-hidden border-b border-white/10 bg-[#18181d] sm:h-64 md:mx-0 md:mt-0 md:h-60 md:rounded-none md:border-0 md:border-b md:border-slate-200 md:bg-slate-100 lg:h-64">
                {realProfile?.coverUrl ? (
                  <ResponsiveImage
                    src={realProfile.coverUrl}
                    alt={`${displayName} cover`}
                    sizes="(min-width: 768px) 768px, 100vw"
                    className="block h-full w-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[linear-gradient(135deg,#1b1b20_0%,#26161a_55%,#3a1218_100%)]" />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#121214] via-[#121214]/60 to-transparent" />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-1/2 web-dark-band md:block"
                  style={{ maskImage: "linear-gradient(to top, black, transparent)", WebkitMaskImage: "linear-gradient(to top, black, transparent)", opacity: 0.85 }}
                />

                 <Button
                   variant="ghost"
                   size="icon"
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.history.length > 1)
                      window.history.back();
                    else navigate({ to: "/" });
                  }}
                  aria-label="Go back"
                   className="absolute left-3 top-3 h-10 w-10 rounded-[10px] border border-white/15 bg-black/45 text-white shadow-sm hover:bg-black/65 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                 </Button>

                {isOwnProfile && (
                   <Button
                     variant="ghost"
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploading === "cover"}
                    aria-label="Change cover image"
                     className="absolute right-3 top-3 h-10 rounded-[10px] border border-white/15 bg-black/45 px-3 text-xs font-bold text-white shadow-sm hover:bg-black/65 hover:text-white"
                  >
                    {uploading === "cover" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">
                      {uploading === "cover"
                        ? "Uploading…"
                        : realProfile?.coverUrl
                          ? "Change cover"
                          : "Add cover"}
                    </span>
                   </Button>
                )}
              </div>

              {/* Identity — avatar overlaps the cover from the left, app-style */}
               <div className="-mt-12 px-1 md:-mt-14 md:px-8 md:pb-7">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
                  <div className="relative shrink-0">
                     <div className="profile-avatar-safe flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#E5484D] text-3xl font-black text-white ring-[3px] ring-[#E5484D]/70 outline outline-4 outline-[#121214] sm:h-28 sm:w-28 md:h-32 md:w-32 md:rounded-[10px] md:ring-0 md:outline-white lg:h-36 lg:w-36">
                      {displayAvatar ? (
                        <ResponsiveImage
                          src={displayAvatar}
                          alt={`${displayName} avatar`}
                          sizes="128px"
                          className="block w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        displayInitials
                      )}
                    </div>
                    {isViewedUserOnline && (
                      <span
                        className="absolute top-1 left-1 h-4 w-4 rounded-full bg-emerald-400 border-[3px] border-[#121214]"
                        aria-label="Online now"
                      />
                    )}
                    <span
                      className="absolute bottom-0.5 right-0.5 grid h-7 w-7 place-items-center rounded-full bg-[#2f6fed] border-[3px] border-[#121214]"
                      aria-label={displayTierLabel}
                    >
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
                    </span>
                    {isOwnProfile && (
                       <Button
                         variant="ghost"
                         size="icon"
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploading === "avatar"}
                        aria-label="Change profile picture"
                         className="absolute -right-1 -top-1 h-8 w-8 rounded-[10px] border border-white/20 bg-black/70 text-white hover:bg-black hover:text-white"
                      >
                        {uploading === "avatar" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" strokeWidth={2.4} />
                        )}
                       </Button>
                    )}
                  </div>

                  {/* Quick actions, bottom-aligned against the cover edge */}
                   <div className="flex items-center justify-end gap-2 pb-1">
                    {!isOwnProfile && realProfile?.userId && (
                       <Button
                         variant="outline"
                         size="icon"
                        onClick={handleChat}
                        aria-label={`Message ${displayName}`}
                         className="h-10 w-10 rounded-[10px] border-white/12 bg-[#1A1A1F] text-slate-200 hover:bg-[#232329] hover:text-white md:border-slate-200 md:bg-white md:text-slate-700 md:hover:bg-slate-100 md:hover:text-slate-900"
                      >
                        <MessageCircle className="h-4 w-4" />
                       </Button>
                    )}
                     <Button
                       variant="outline"
                       size="icon"
                      onClick={shareProfile}
                      aria-label="Share profile"
                       className="h-10 w-10 rounded-[10px] border-white/12 bg-[#1A1A1F] text-slate-200 hover:bg-[#232329] hover:text-white md:border-slate-200 md:bg-white md:text-slate-700 md:hover:bg-slate-100 md:hover:text-slate-900"
                    >
                      <Share2 className="h-4 w-4" />
                     </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <Button
                           variant="outline"
                           size="icon"
                          aria-label="More profile options"
                           className="h-10 w-10 rounded-[10px] border-white/12 bg-[#1A1A1F] text-slate-200 hover:bg-[#232329] hover:text-white md:border-slate-200 md:bg-white md:text-slate-700 md:hover:bg-slate-100 md:hover:text-slate-900"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                         </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={handleCopyLink}>
                          {copied ? (
                            <Check className="mr-2 h-4 w-4" />
                          ) : (
                            <Link2 className="mr-2 h-4 w-4" />
                          )}
                          {copied ? "Link copied" : "Copy profile link"}
                        </DropdownMenuItem>
                        {isOwnProfile ? (
                          <>
                            <DropdownMenuItem onClick={() => setEditProfileOpen(true)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFollowRequestsOpen(true)}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Follow requests
                              {pendingFollowReqCount > 0 ? ` (${pendingFollowReqCount})` : ""}
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => setReportOpen(true)}>
                            <Flag className="mr-2 h-4 w-4" />
                            Report profile
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Name + role */}
                <div className="mt-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-2xl sm:text-3xl font-black leading-tight text-white md:text-slate-900">
                      {displayName}
                    </h1>
                    <ShieldCheck
                      className="h-5 w-5 shrink-0 text-[#2f6fed]"
                      aria-label={displayTierLabel}
                    />
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-slate-400 md:text-slate-500">
                    {(realProfile?.skills ?? []).slice(0, 3).join(" • ") ||
                      (realProfile?.username ? `@${realProfile.username}` : displayTierLabel)}
                  </p>
                  {realProfile?.username && (realProfile?.skills ?? []).length > 0 && (
                    <p className="text-xs font-semibold text-slate-500">@{realProfile.username}</p>
                  )}
                  {realProfile?.userId && (
                    <span
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        isViewedUserOnline
                          ? "bg-emerald-500/15 text-emerald-300 md:text-emerald-700"
                          : "bg-white/5 md:bg-slate-100 text-slate-400 md:text-slate-500"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isViewedUserOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                        }`}
                      />
                      {isViewedUserOnline
                        ? "Online now"
                        : (presence.lastSeenLabel(realProfile.userId) ?? "Offline")}
                    </span>
                  )}
                </div>

                {displayBio && (
                  <p className="profile-mid-safe mt-2.5 line-clamp-3 text-sm leading-relaxed text-slate-300 md:text-slate-600">
                    {displayBio}
                  </p>
                )}

                {(realProfile?.country?.trim() ||
                  realProfile?.address?.trim() ||
                  realProfile?.socialLinks?.website) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 md:text-slate-500">
                    {(realProfile?.country?.trim() || realProfile?.address?.trim()) && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {realProfile?.country?.trim() && (
                          <>
                            <CountryFlag country={realProfile.country} />
                            <span>{realProfile.country}</span>
                          </>
                        )}
                        {realProfile?.country?.trim() && realProfile?.address?.trim() && (
                          <span className="text-slate-600">·</span>
                        )}
                        {realProfile?.address?.trim() && (
                          <span className="max-w-[160px] truncate">{realProfile.address}</span>
                        )}
                      </span>
                    )}
                    {realProfile?.socialLinks?.website && (
                      <a
                        href={realProfile.socialLinks.website}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1.5 font-semibold text-[#2f6fed] hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {realProfile.socialLinks.website
                          .replace(/^https?:\/\//, "")
                          .replace(/\/$/, "")}
                      </a>
                    )}
                  </div>
                )}

                {/* Stat strip */}
                <div className="mt-4 grid grid-cols-4 divide-x divide-white/8 rounded-2xl border border-white/10 bg-[#141418] md:mt-6 md:divide-x md:divide-slate-100 md:rounded-[10px] md:border-slate-200 md:bg-slate-50">
                  <button
                    type="button"
                    onClick={() => openRelationships("followers")}
                    aria-controls="relationships"
                    className="px-2 py-3 text-center md:py-4"
                  >
                    <span className="block text-base font-black text-white md:text-slate-900">
                      {compactCount(socialCounts?.followers ?? 0)}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500">
                      Followers
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openRelationships("following")}
                    aria-controls="relationships"
                    className="px-2 py-3 text-center md:py-4"
                  >
                    <span className="block text-base font-black text-white md:text-slate-900">
                      {compactCount(socialCounts?.following ?? 0)}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500">
                      Following
                    </span>
                  </button>
                  <div className="px-2 py-3 text-center md:py-4">
                    <span className="block text-base font-black text-white md:text-slate-900">
                      {liveRep ? compactCount(liveRep.metrics.productsListed) : "…"}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500">Products</span>
                  </div>
                  <div className="px-2 py-3 text-center md:py-4">
                    <span className="block text-base font-black text-white md:text-slate-900">
                      {compactCount(
                        ecosystemSections.find((s) => s.key === "services")?.count ?? 0,
                      )}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500">Services</span>
                  </div>
                </div>

                {/* Connections entry — opens the All / Following / Followers / Suggested browser */}
                <button
                  type="button"
                  onClick={() => openRelationships("all")}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#141418] px-4 py-3 text-left hover:bg-[#1A1A1F] md:rounded-[10px] md:border-slate-200 md:bg-white md:hover:bg-slate-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E5484D]/15 text-[#E5484D]">
                    <Users className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-white md:text-slate-900">
                      Connections
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500">
                      {compactCount(socialCounts?.followers ?? 0)} followers ·{" "}
                      {compactCount(socialCounts?.following ?? 0)} following
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                </button>



                {/* Primary actions */}
                {!isOwnProfile && !identityMissing && realProfile?.userId && (
                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2 md:flex md:justify-end">
                    <FollowButton
                      targetId={realProfile.userId}
                      className="h-11 w-full justify-center rounded-[10px] border-transparent! bg-[#E5484D]! px-5 py-0 text-sm font-black text-white! hover:bg-[#C43D42]! md:w-44"
                    />
                    <Button
                      variant="outline"
                      onClick={handleChat}
                      aria-label={`Message ${displayName}`}
                      className="h-11 rounded-[10px] border-white/12 bg-[#1A1A1F] px-4 text-sm font-bold text-white hover:bg-[#232329] hover:text-white md:w-36 md:border-slate-300 md:bg-white md:text-slate-900 md:hover:bg-slate-100"
                    >
                      <MessageCircle className="h-4 w-4" /> Message
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setJoinCircleOpen(true)}
                      aria-label="Request to join one of this user's circles"
                      className="h-11 w-11 shrink-0 rounded-[10px] border-white/12 bg-[#1A1A1F] text-slate-300 hover:bg-[#232329] hover:text-white md:border-slate-300 md:bg-white md:text-slate-600 md:hover:bg-slate-100 md:hover:text-slate-900"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {isOwnProfile && (
                  <div className="mt-3 grid grid-cols-2 items-center gap-2 md:flex md:justify-end">
                    <Button
                      onClick={() => setEditProfileOpen(true)}
                      className="h-11 rounded-[10px] bg-[#E5484D] px-5 text-sm font-black text-white hover:bg-[#C43D42] md:w-44"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2.5} /> Edit profile
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate({ to: "/" })}
                      className="h-11 rounded-[10px] border-white/12 bg-[#1A1A1F] px-5 text-sm font-bold text-white hover:bg-[#232329] hover:text-white md:w-36 md:border-slate-300 md:bg-white md:text-slate-900 md:hover:bg-slate-100"
                    >
                      Back to feed
                    </Button>
                  </div>
                )}

                {/* About card */}
                {displayBio && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-[#141418] p-4 md:rounded-[10px] md:border-slate-200 md:bg-slate-50">
                    <h2 className="text-sm font-black text-white md:text-slate-900">
                      About {displayName.split(" ")[0]}
                    </h2>
                    <p
                      className={`mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300 md:text-slate-600 ${
                        aboutExpanded ? "" : "line-clamp-4"
                      }`}
                    >
                      {displayBio}
                    </p>
                    {displayBio.length > 160 && (
                      <button
                        type="button"
                        onClick={() => setAboutExpanded((v) => !v)}
                        className="mt-2 text-xs font-bold text-[#E5484D] hover:underline"
                      >
                        {aboutExpanded ? "Show less" : "Read more"}
                      </button>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 md:text-slate-500">
                      {displayJoined && (
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" /> Joined {displayJoined}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* What I'm into */}
                {((realProfile?.interests && realProfile.interests.length > 0) || isOwnProfile) && (
                  <div className="mt-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <h2 className="truncate text-sm font-black text-white md:text-slate-900">
                        What I&apos;m into
                      </h2>
                      {isOwnProfile && (
                        <button
                          type="button"
                          onClick={() => setEditProfileOpen(true)}
                          className="shrink-0 text-xs font-bold text-[#E5484D] hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
                      {(realProfile?.interests ?? []).map((s) => (
                        <span
                          key={s}
                          className="shrink-0 rounded-full border border-white/10 bg-[#1A1A1F] px-3.5 py-2 text-xs font-bold text-slate-200 md:border-slate-200 md:bg-slate-100 md:text-slate-700"
                        >
                          {s}
                        </span>
                      ))}
                      {isOwnProfile && (realProfile?.interests?.length ?? 0) === 0 && (
                        <button
                          type="button"
                          onClick={() => setEditProfileOpen(true)}
                          className="shrink-0 rounded-full border border-dashed border-[#E5484D]/60 bg-[#1A1A1F] px-3.5 py-2 text-xs font-bold text-[#E5484D] hover:bg-[#232329] md:bg-white"
                        >
                          + Add interests
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {realProfile?.socialLinks && Object.keys(realProfile.socialLinks).length > 0 && (
                  <div className="mt-4">
                    <h2 className="text-sm font-black text-white md:text-slate-900">Find me on</h2>
                    <div className="-mx-1 mt-2 flex flex-wrap items-center gap-2 px-1">
                      {Object.entries(realProfile.socialLinks).map(([key, url]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => openSocialLink(key, url)}
                          aria-label={SOCIAL_LABELS[key as keyof typeof SOCIAL_LABELS] ?? key}
                          title={SOCIAL_LABELS[key as keyof typeof SOCIAL_LABELS] ?? key}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-[#1A1A1F] text-slate-300 transition-colors hover:text-white hover:bg-[#232329] md:border-slate-300 md:bg-slate-100 md:text-slate-600 md:hover:bg-slate-200 md:hover:text-slate-900"
                        >
                          <SocialIcon kind={key} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {((realProfile?.skills && realProfile.skills.length > 0) || isOwnProfile) && (
                  <div className="mt-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <h2 className="truncate text-sm font-black text-white md:text-slate-900">
                        Skills
                      </h2>
                      {isOwnProfile && (
                        <button
                          type="button"
                          onClick={() => setEditProfileOpen(true)}
                          className="shrink-0 text-xs font-bold text-[#E5484D] hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <div className="-mx-1 mt-2 flex flex-wrap gap-2 px-1">
                      {(realProfile?.skills ?? []).map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-full border border-[#E5484D]/30 bg-[#E5484D]/12 px-3 py-1.5 text-xs font-bold text-[#E5484D]"
                        >
                          {s}
                        </span>
                      ))}
                      {isOwnProfile && (realProfile?.skills?.length ?? 0) === 0 && (
                        <button
                          type="button"
                          onClick={() => setEditProfileOpen(true)}
                          className="inline-flex items-center rounded-full border border-dashed border-[#E5484D]/60 bg-[#1A1A1F] px-3 py-1.5 text-xs font-bold text-[#E5484D] hover:bg-[#232329] md:bg-white"
                        >
                          + Add skills
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Tabs */}
            <nav
              ref={tabsNavRef}
              data-testid="profile-tabs"

              className="mt-5 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/10 md:sticky md:top-0 md:z-20 md:mt-8 md:rounded-t-[10px] md:border md:border-slate-200 md:bg-white md:px-5 md:shadow-sm"
            >
              <button
                key="overview"
                onClick={() => {
                  setPhotosMode(false);
                  setAboutMode(false);
                  const targetY = tabsTopY();
                  pinAcrossChange(targetY);
                  navigate({
                    to: "/profile/$id",
                    params: { id },
                    search: { tab: "overview", pages: 1, y: targetY, q: "", sort: "newest" },
                    replace: true,
                    resetScroll: false,
                  });
                }}

                className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  overviewMode && !photosMode && !aboutMode
                    ? "text-white md:text-slate-900 border-[#E5484D] md:rounded-full md:border-b-0 md:bg-crimson/10 md:text-crimson"
                    : "text-slate-400 md:text-slate-500 border-transparent hover:text-white md:rounded-full md:border-b-0 md:hover:bg-slate-100 md:hover:text-slate-900"
                }`}
              >
                Overview
              </button>
              {ecosystemSections
                .filter((s): s is typeof s & { key: Tab } => isTab(s.key))
                .map((section) => {
                  const key = section.key;
                  const label = section.label;
                  const count = tabData[key].total ?? section.count;

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setPhotosMode(false);
                        setAboutMode(false);
                        changeTab(key);
                      }}
                      className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                        tab === key && !photosMode && !aboutMode && !overviewMode
                          ? "text-white md:text-slate-900 border-[#E5484D] md:rounded-full md:border-b-0 md:bg-crimson/10 md:text-crimson"
                          : "text-slate-400 md:text-slate-500 border-transparent hover:text-white md:rounded-full md:border-b-0 md:hover:bg-slate-100 md:hover:text-slate-900"
                      }`}
                    >
                      {label}
                      <span className="text-xs text-slate-500 md:text-slate-500 ml-1">
                        ({count === null ? "…" : count})
                      </span>
                    </button>
                  );
                })}
              <button
                key="photos"
                onClick={() => {
                  const currentY = tabsTopY();
                  pinAcrossChange(currentY);
                  setAboutMode(false);
                  setPhotosMode(true);
                  requestAnimationFrame(() => restoreScroll(currentY));

                }}
                className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  photosMode && !aboutMode
                    ? "text-white md:text-slate-900 border-[#E5484D] md:rounded-full md:border-b-0 md:bg-crimson/10 md:text-crimson"
                    : "text-slate-400 md:text-slate-500 border-transparent hover:text-white md:rounded-full md:border-b-0 md:hover:bg-slate-100 md:hover:text-slate-900"
                }`}
              >
                Photos
              </button>
              <button
                key="about"
                onClick={() => {
                  const currentY = tabsTopY();
                  pinAcrossChange(currentY);
                  setPhotosMode(false);
                  setAboutMode(true);
                  requestAnimationFrame(() => restoreScroll(currentY));
                }}
                className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  aboutMode
                    ? "text-white md:text-slate-900 border-[#E5484D] md:rounded-full md:border-b-0 md:bg-crimson/10 md:text-crimson"
                    : "text-slate-400 md:text-slate-500 border-transparent hover:text-white md:rounded-full md:border-b-0 md:hover:bg-slate-100 md:hover:text-slate-900"
                }`}
              >
                About
              </button>
            </nav>

            {/* Search + sort */}
            {!overviewMode && !photosMode && !aboutMode && tab !== "skills" && tab !== "collections" && (
              <TabFilters
                tab={tab}
                q={q}
                sort={sort}
                onChangeQ={(next) => {
                  navigate({
                    to: "/profile/$id",
                    params: { id },
                    search: (prev: Record<string, unknown>) => ({
                      ...prev,
                      q: next,
                      pages: 1,
                      y: 0,
                    }),
                    replace: true,
                  });
                }}
                onChangeSort={(next) => {
                  navigate({
                    to: "/profile/$id",
                    params: { id },
                    search: (prev: Record<string, unknown>) => ({
                      ...prev,
                      sort: next,
                      pages: 1,
                      y: 0,
                    }),
                    replace: true,
                  });
                }}
              />
            )}

            {/* Live refresh indicator for the marketplace tab */}
            {!overviewMode && tab === "marketplace" && (
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <div className="inline-flex items-center gap-1.5 text-slate-400 md:text-slate-500">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      mpRefreshing ? "bg-emerald-400 animate-pulse" : "bg-emerald-500"
                    }`}
                    aria-hidden
                  />
                  <span className="font-semibold text-emerald-300 md:text-emerald-700">
                    Live prices
                  </span>
                  <span className="text-slate-500 md:text-slate-500">
                    · Last updated {mpAgoLabel}
                  </span>
                </div>
                <button
                  onClick={refreshMarketplace}
                  disabled={mpRefreshing}
                  className="text-slate-400 md:text-slate-500 hover:text-emerald-400 md:text-emerald-600 disabled:opacity-50 font-semibold"
                  aria-label="Refresh marketplace prices"
                >
                  {mpRefreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            )}

            {/* Tab content */}
            <section data-testid="profile-tab-content" className="mt-5 space-y-3 md:mt-0 md:min-h-72 md:rounded-b-[10px] md:border md:border-t-0 md:border-slate-200 md:bg-white md:p-6 md:shadow-sm lg:p-8">
              {aboutMode ? (
                <ProfileAboutTab
                  idOrSlug={id}
                  name={displayName}
                  isOwner={isOwnProfile}
                  price={price}
                />
              ) : overviewMode && !photosMode ? (
                <ProfileOverview
                  idOrSlug={id}
                  profileId={profile.id}
                  name={displayName}
                  counts={Object.fromEntries(
                    ecosystemSections.map((sct) => [sct.key, sct.count ?? 0]),
                  )}
                  isOwner={isOwnProfile}
                  price={price}
                  itemSearch={itemSearch}
                  onOpenSection={(key) => {
                    if (key === "about") {
                      const currentY = tabsTopY();
                      pinAcrossChange(currentY);
                      setPhotosMode(false);
                      setAboutMode(true);
                      requestAnimationFrame(() => restoreScroll(currentY));
                      return;
                    }
                    if (isTab(key)) changeTab(key);
                  }}
                  realProfile={realProfile}
                />

              ) : photosMode ? (
                <ProfilePhotosGallery slug={id} />
              ) : tab === "collections" ? (
                <ProfileCollectionsTab
                  idOrSlug={id}
                  name={displayName}
                  isOwner={isOwnProfile}
                />
              ) : tab === "skills" ? (
                <ProfileSkillsTab
                  name={displayName}
                  isOwner={isOwnProfile}
                  skills={realProfile?.skills ?? []}
                  skillLevels={realProfile?.skillLevels ?? {}}
                  tools={realProfile?.tools ?? []}
                />
              ) : tab === "posts" && realProfile?.userId ? (
                <ProfilePostsFeed
                  wallUserId={realProfile.userId}
                  wallOwnerName={displayName}
                  viewerId={meId ?? null}
                />
              ) : (
                (() => {
                  const st = tabData[tab];
                  const initialLoading = st.loading && st.items.length === 0;
                  const isEmpty = !st.loading && st.items.length === 0 && !st.error;

                  if (st.error && st.items.length === 0) {
                    return (
                      <ErrorState
                        label="Couldn't load this tab"
                        hint={`We'll refetch ${desiredPages > 1 ? `pages 1–${desiredPages}` : "page 1"} of ${tabNoun(tab)}.`}
                        onRetry={() => retryTab(tab)}
                      />
                    );
                  }
                  if (initialLoading) return <TabSkeleton variant={tab} />;
                  if (tab === "courses") {
                    return (
                      <ProfileCoursesTab
                        items={st.items as ProfileListing[]}
                        total={st.total ?? st.items.length}
                        isOwner={isOwnProfile}
                        price={price}
                        slug={id}
                      />
                    );
                  }
                  if (tab === "services") {
                    return (
                      <ProfileServicesTab
                        items={st.items as ProfileListing[]}
                        isOwner={isOwnProfile}
                        price={price}
                        onPublished={() => retryTab("services")}
                      />
                    );
                  }
                  if (isEmpty) {
                    const empty = emptyContentFor(
                      tab,
                      profile.name,
                      q,
                      () => {
                        navigate({
                          to: "/profile/$id",
                          params: { id },
                          search: (prev: Record<string, unknown>) => ({
                            ...prev,
                            q: "",
                            pages: 1,
                            y: 0,
                          }),
                          replace: true,
                        });
                      },
                      () => {
                        navigate({ to: "/", search: { section: "Circles" } as never });
                      },
                    );
                    return <EmptyState {...empty} />;
                  }

                  return (
                    <>
                      {tab === "marketplace" ? (
                        <ProfileShopTab
                          items={st.items as ProfileListing[]}
                          total={st.total ?? st.items.length}
                          isOwner={isOwnProfile}
                          price={price}
                          shopSlug={id}
                        />
                      ) : (() => {
                        // Uniform grid tiles across every tab. Tiles deep-link to the
                        // profile item detail route so the panel loads instantly with
                        // its own skeleton while the URL stays shareable.
                        type TileConfig = {
                          key: string;
                          kind: "post" | "group" | "listing" | "bounty" | "solved";
                          itemId: string;
                          academy?: boolean;
                          coverUrl?: string | null;
                          placeholderIcon: React.ReactNode;
                          badge?: { label: string; tone: "emerald" | "purple" | "sky" | "amber" };
                          title: string;
                          subtitle?: string;
                          priceLabel?: string;
                        };
                        let tiles: TileConfig[] = [];
                        if (tab === "groups") {

                          tiles = (st.items as ProfileGroup[]).map((g) => ({
                            key: g.id,
                            kind: "group" as const,
                            itemId: g.id,
                            placeholderIcon: (
                              <Users className="w-8 h-8 text-emerald-300 md:text-emerald-700/70" />
                            ),
                            title: g.name,
                            subtitle: `${g.tag} · ${g.members.toLocaleString()} member${g.members === 1 ? "" : "s"}`,
                          }));
                        } else if (tab === "posted") {
                          tiles = (st.items as ProfileBounty[]).map((b) => ({
                            key: b.id,
                            kind: "bounty" as const,
                            itemId: b.id,
                            coverUrl: b.coverUrl ?? null,
                            placeholderIcon: (
                              <Target className="w-8 h-8 text-emerald-300 md:text-emerald-700/70" />
                            ),
                            badge: {
                              label: b.status === "open" ? "Awaiting solve" : "In progress",
                              tone: b.status === "open" ? ("emerald" as const) : ("amber" as const),
                            },
                            title: b.title,
                            subtitle: `${b.applicants ?? 0} applicant${(b.applicants ?? 0) === 1 ? "" : "s"}`,
                            priceLabel: price(b.amountUsd),
                          }));
                        } else if (tab === "solved") {
                          tiles = (st.items as ProfileBounty[]).map((b) => ({
                            key: b.id,
                            kind: "solved" as const,
                            itemId: b.id,
                            coverUrl: b.coverUrl ?? null,
                            placeholderIcon: <Award className="w-8 h-8 text-purple-300/70" />,
                            badge: { label: "Settled", tone: "purple" as const },
                            title: b.title,
                            subtitle: b.proof || undefined,
                            priceLabel: price(b.amountUsd),
                          }));
                        }

                        const toneRing: Record<string, string> = {
                          emerald:
                            "border-emerald-500/30 text-emerald-300 md:text-emerald-700 bg-emerald-500/10 md:bg-emerald-50",
                          purple: "border-purple-500/30 text-purple-300 bg-purple-500/10",
                          sky: "border-sky-500/30 text-sky-300 md:text-sky-700 bg-sky-500/10",
                          amber:
                            "border-amber-500/30 text-amber-300 md:text-amber-600 bg-amber-500/10",
                        };

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {tiles.map((t) => (
                              <Link
                                key={t.key}
                                {...(t.academy
                                  ? ({
                                      to: "/",
                                      search: { section: "Academy", course: t.itemId },
                                    } as any)
                                  : ({
                                      to: "/profile/$id/item/$kind/$itemId",
                                      params: { id: profile.id, kind: t.kind, itemId: t.itemId },
                                      search: itemSearch,
                                    } as any))}
                                className="group block bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl overflow-hidden hover:border-emerald-500/40 md:hover:border-emerald-300 transition-colors"
                              >
                                <div className="relative aspect-[4/3] bg-neutral-900 overflow-hidden">
                                  {t.coverUrl ? (
                                    <img
                                      src={t.coverUrl}
                                      alt={t.title}
                                      loading="lazy"
                                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                                      {t.placeholderIcon}
                                    </div>
                                  )}
                                  {t.badge && (
                                    <span
                                      className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                        toneRing[t.badge.tone]
                                      }`}
                                    >
                                      {t.badge.label}
                                    </span>
                                  )}
                                  {t.priceLabel && (
                                    <span className="absolute top-2 right-2 text-[11px] font-black px-2 py-0.5 rounded-full bg-black/70 text-white">
                                      {t.priceLabel}
                                    </span>
                                  )}
                                </div>
                                <div className="p-3">
                                  <div className="text-white md:text-slate-900 font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                                    {t.title}
                                  </div>
                                  {t.subtitle && (
                                    <div className="mt-1 text-[11px] text-slate-500 md:text-slate-500 line-clamp-1">
                                      {t.subtitle}
                                    </div>
                                  )}
                                </div>
                              </Link>
                            ))}
                          </div>
                        );
                      })()}


                      {/* Pagination footer */}
                      <div className="pt-2 flex items-center justify-center">
                        {st.hasMore ? (
                          <button
                            onClick={() => loadMore()}
                            disabled={st.loading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border border-white/10 md:border-slate-200 text-sm text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:bg-slate-100 md:hover:bg-slate-100 disabled:opacity-50"
                          >
                            {st.loading
                              ? "Loading…"
                              : `Load more (${(st.total ?? 0) - st.items.length} left)`}
                          </button>
                        ) : (
                          <div className="text-[11px] text-slate-500 md:text-slate-500">
                            You've reached the end · {st.items.length} of {st.total}
                          </div>
                        )}
                      </div>
                      {st.error && st.items.length > 0 && (
                        <div className="flex items-center justify-center gap-2 text-[11px] text-red-300">
                          <span>{st.error}</span>
                          <button
                            onClick={() => retryTab(tab)}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-400 md:text-emerald-600 hover:text-emerald-300 md:text-emerald-700"
                          >
                            <RefreshCw className="w-3 h-3" /> Try again
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </section>

            {realProfile?.userId && (
              <ConnectionsDialog
                open={connectionsOpen}
                onOpenChange={setConnectionsOpen}
                userId={realProfile.userId}
                name={displayName}
                viewerId={meId ?? null}
                initialTab={connectionsTab}
              />
            )}


            <EarningsBreakdown isOwner={isOwnProfile} />

          </div>
        </main>
        {/* Mobile footer nav is rendered globally in __root.tsx */}
      </div>

      {realProfile?.userId && (
        <ProfileMessageModal
          open={dmOpen}
          onClose={() => setDmOpen(false)}
          recipient={{
            userId: realProfile.userId,
            displayName,
            avatarUrl: realProfile.avatarUrl,
            slug: realProfile.slug,
          }}
        />
      )}
      <CircleRequestsDrawer open={requestsOpen} onClose={() => setRequestsOpen(false)} />
      <FollowRequestsDrawer
        open={followRequestsOpen}
        onClose={() => setFollowRequestsOpen(false)}
      />
      {isOwnProfile && realProfile && (
        <EditProfileModal
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          userId={realProfile.userId}
          initial={{
            displayName: realProfile.displayName,
            bio: realProfile.bio,
            avatarUrl: realProfile.avatarUrl,
            coverUrl: realProfile.coverUrl,
            socialLinks: realProfile.socialLinks,
            skills: realProfile.skills,
            interests: realProfile.interests,
          }}
          onSaved={reloadRealProfile}
        />
      )}
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={profile.name}
        targetId={`profile-${profile.id}`}
        targetKind="profile"
      />
      {realProfile?.userId && (
        <JoinCirclePickerModal
          open={joinCircleOpen}
          onClose={() => setJoinCircleOpen(false)}
          userId={realProfile.userId}
          userName={realProfile.displayName || profile.name}
        />
      )}
    </div>
  );
}

/** 2.4K-style compact numbers for the identity stat strip. */
function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function relTime(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function absTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function CircleStatusNote({
  status,
  meta,
  firstName,
}: {
  status: CircleStatus;
  meta: { sentAt: string | null; acceptedAt: string | null; canceledAt: string | null };
  firstName: string;
}) {
  const sent = relTime(meta.sentAt);
  const accepted = relTime(meta.acceptedAt);
  const canceled = relTime(meta.canceledAt);

  if (status === "accepted") {
    return (
      <div className="text-[11px] text-emerald-300 md:text-emerald-700/90 sm:text-center leading-snug px-1 space-y-0.5">
        {accepted && (
          <div>
            <span title={absTime(meta.acceptedAt)}>Accepted {accepted}</span>
          </div>
        )}
        {sent && (
          <div className="text-slate-500 md:text-slate-500">
            <span title={absTime(meta.sentAt)}>Request sent {sent}</span>
          </div>
        )}
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="text-[11px] text-slate-400 md:text-slate-500 sm:text-center leading-snug px-1 space-y-0.5">
        {sent && (
          <div>
            <span title={absTime(meta.sentAt)}>Sent {sent}</span>
          </div>
        )}
        <div className="text-slate-500 md:text-slate-500">
          Waiting on {firstName} to accept from their inbox.
        </div>
      </div>
    );
  }

  // status === "none"
  if (canceled) {
    return (
      <div className="text-[11px] text-slate-500 md:text-slate-500 sm:text-center leading-snug px-1">
        <span title={absTime(meta.canceledAt)}>Request canceled {canceled}</span>
      </div>
    );
  }
  return null;
}

function TabFilters({
  tab,
  q,
  sort,
  onChangeQ,
  onChangeSort,
}: {
  tab: Tab;
  q: string;
  sort: ProfileSortKey;
  onChangeQ: (next: string) => void;
  onChangeSort: (next: ProfileSortKey) => void;
}) {
  const [draft, setDraft] = useState(q);
  // Keep the local input in sync when the URL changes externally (e.g. tab switch).
  useEffect(() => {
    setDraft(q);
  }, [q, tab]);
  // Debounce URL writes so every keystroke doesn't hit the server.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (draft.trim() !== q) onChangeQ(draft.trim());
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const options = SORT_OPTIONS_BY_TAB[tab];

  return (
    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="relative flex-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER[tab]}
          className="w-full bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 rounded-[10px] px-3 py-2 pr-8 text-sm text-slate-200 md:text-slate-700 placeholder:text-slate-500 md:text-slate-500 focus:outline-none focus:border-emerald-500/40 md:border-emerald-300"
          aria-label={SEARCH_PLACEHOLDER[tab]}
        />
        {draft && (
          <button
            type="button"
            onClick={() => setDraft("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 md:text-slate-500 hover:text-slate-200 md:text-slate-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 md:text-slate-500">
          Sort
        </span>
        <select
          value={sort}
          onChange={(e) => onChangeSort(e.target.value as ProfileSortKey)}
          className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-[10px] px-3 py-2 text-sm text-slate-200 md:text-slate-700 focus:outline-none focus:border-emerald-500/40 md:border-emerald-300"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ProfilePhotosGallery({ slug }: { slug: string }) {
  const fetchPhotos = useServerFn(listUserPhotos);
  const [photos, setPhotos] = useState<UserPhoto[] | null>(null);
  const [filter, setFilter] = useState<"all" | "avatar" | "cover" | "post" | "reels">("all");
  const reels = useReels(true, slug, 60);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetchPhotos({ data: { slugOrId: slug } });
        if (!cancel) setPhotos(r.photos);
      } catch {
        if (!cancel) setPhotos([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fetchPhotos, slug]);

  if (photos === null) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 md:text-slate-500" />
      </div>
    );
  }
  const filtered =
    filter === "all" || filter === "reels" ? photos : photos.filter((p) => p.source === filter);
  const chip = (v: typeof filter, label: string) => (
    <button
      key={v}
      onClick={() => setFilter(v)}
      className={`px-3 py-1 rounded-full text-xs border ${filter === v ? "bg-emerald-500/20 md:bg-emerald-100 border-emerald-500/40 md:border-emerald-300 text-emerald-300 md:text-emerald-700" : "border-white/10 md:border-slate-200 text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {chip("all", "All")}
        {chip("reels", "Reels")}
        {chip("post", "Posts")}
        {chip("avatar", "Profile")}
        {chip("cover", "Cover")}
      </div>
      {filter === "reels" ? (
        reels === null ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : reels.length === 0 ? (
          <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl py-16 px-6 text-center">
            <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-[#E5484D]/10 border border-[#E5484D]/30 text-[#E5484D] flex items-center justify-center">
              <PlayCircle className="w-4 h-4" />
            </div>
            <div className="text-sm text-slate-200 md:text-slate-700 font-semibold">
              No reels yet
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Short videos and stories stay here after 24 hours and keep collecting views.
            </p>
          </div>
        ) : (
          <ReelsGrid reels={reels} />
        )
      ) : filtered.length === 0 ? (
        <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl py-16 px-6 text-center">
          <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-emerald-500/10 md:bg-emerald-50 border border-emerald-500/30 text-emerald-300 md:text-emerald-700 flex items-center justify-center">
            <Images className="w-4 h-4" />
          </div>
          <div className="text-sm text-slate-200 md:text-slate-700 font-semibold">
            No photos yet
          </div>
          <p className="mt-1 text-xs text-slate-500 md:text-slate-500 max-w-sm mx-auto">
            Photos from posts, profile picture and cover image will show up here.
          </p>
        </div>
      ) : (
        <PhotoBatches photos={filtered} />
      )}

    </div>
  );
}

type StateAction = { label: string; onClick: () => void };

function EmptyState({
  title,
  hint,
  primary,
  secondary,
}: {
  title: string;
  hint?: string;
  primary?: StateAction;
  secondary?: StateAction;
}) {
  return (
    <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-8 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-emerald-500/10 md:bg-emerald-50 border border-emerald-500/30 text-emerald-300 md:text-emerald-700 flex items-center justify-center">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="text-sm text-slate-200 md:text-slate-700 font-semibold">{title}</div>
      {hint && (
        <p className="mt-1 text-xs text-slate-500 md:text-slate-500 max-w-sm mx-auto">{hint}</p>
      )}
      {(primary || secondary) && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {primary && (
            <button
              onClick={primary.onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors"
            >
              {primary.label}
            </button>
          )}
          {secondary && (
            <button
              onClick={secondary.onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-white/10 md:border-slate-200 text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:bg-slate-100 md:hover:bg-slate-100 text-xs transition-colors"
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorState({
  label,
  hint,
  onRetry,
}: {
  label: string;
  hint?: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-red-500/30 rounded-xl p-6 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="text-sm text-red-200 font-semibold">{label}</div>
      {hint && <p className="mt-1 text-xs text-slate-500 md:text-slate-500">{hint}</p>}
      <div className="mt-4 flex items-center justify-center">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    </div>
  );
}

function TabSkeleton({ variant: _variant }: { variant: Tab }) {
  // One shared tile skeleton so every tab loads with the same rhythm as the grid.
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl overflow-hidden animate-pulse"
        >
          <div className="aspect-[4/3] bg-white/[0.04]" />
          <div className="p-3">
            <div className="h-3 w-11/12 bg-white/5 md:bg-slate-100 rounded mb-2" />
            <div className="h-3 w-7/12 bg-white/5 md:bg-slate-100 rounded mb-2" />
            <div className="h-2.5 w-1/2 bg-white/5 md:bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function emptyContentFor(
  tab: Tab,
  name: string,
  q: string,
  onClearSearch: () => void,
  onJoinCircle: () => void,
): {
  title: string;
  hint?: string;
  primary?: StateAction;
  secondary?: StateAction;
} {
  if (q && q.trim().length > 0) {
    return {
      title: `No ${tabNoun(tab)} match “${q.trim()}”.`,
      hint: "Try a different keyword or clear the search to see everything.",
      primary: { label: "Clear search", onClick: onClearSearch },
    };
  }
  switch (tab) {
    case "posts":
      return {
        title: `${name} hasn't posted yet`,
        hint: "New posts from this creator will show up here.",
      };
    case "groups":
      return {
        title: `${name} hasn't joined any circle yet`,
        hint: "Click below to explore circles and request to join.",
        primary: { label: "Click here to join a circle", onClick: onJoinCircle },
      };
    case "marketplace":
      return {
        title: `${name} has no listings yet`,
        hint: "Products and services offered by this creator will land here.",
      };
    case "posted":
      return {
        title: "No open bounties",
        hint: "Active bounties this creator has posted will show up here.",
      };
    case "services":
      return {
        title: `${name} offers no services yet`,
        hint: "Services this creator offers will appear here.",
      };
    case "courses":
      return {
        title: `${name} hasn't published a course`,
        hint: "Courses published by this creator will appear here.",
      };
    case "solved":
      return {
        title: "No solved bounties yet",
        hint: "Completed bounties with delivered proof will appear on this tab.",
      };
    case "collections":
      return {
        title: "No boards yet",
        hint: `${name} hasn't published a curated board yet.`,
      };
    case "skills":
      return {
        title: "No skills added yet",
        hint: `${name} hasn't listed skills or tools yet.`,
      };
  }
}

function tabNoun(tab: Tab): string {
  switch (tab) {
    case "posts":
      return "posts";
    case "groups":
      return "groups";
    case "marketplace":
      return "listings";
    case "services":
      return "services";
    case "courses":
      return "courses";
    case "posted":
      return "bounties";
    case "solved":
      return "solved bounties";
    case "skills":
      return "skills";
    case "collections":
      return "boards";
  }
}

function HeaderStat({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 md:border-slate-200 bg-white/[0.04] px-2 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:text-slate-500">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`mt-1 truncate text-sm font-black ${muted ? "text-slate-500 md:text-slate-500" : "text-white md:text-slate-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
