import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/oventric/Header";
import { useIsAppShell } from "@/hooks/use-launch-context";
import {
  Loader2,
  Package,
  Download,
  ExternalLink,
  MessageCircle,
  Phone,
  ShoppingBag,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Store,
  Pencil,
  Eye,
  LayoutDashboard,
  Target,
  GraduationCap,
  Wallet as WalletIcon,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Bell,
  Plus,
  TrendingUp,
  Activity as ActivityIcon,
} from "lucide-react";
import { CoursePublishWizard } from "@/components/oventric/CoursePublishWizard";
import { BountyEditorModal } from "@/components/oventric/BountyEditorModal";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyPurchases,
  listMyContactedSellers,
  listMyProducts,
  getOrderWithDownload,
  logProductContact,
  confirmOrderReceived,
  type PurchaseDTO,
  type ContactedSellerDTO,
  type ProductDTO,
} from "@/lib/marketplace.functions";
import {
  getDashboardOverview,
  listMyBounties,
  listMyCourses,
  getMyWalletSummary,
  getMySocial,
  type DashboardOverview,
  type DashboardBountyPosted,
  type DashboardBountySolved,
  type DashboardEnrolledCourse,
  type DashboardPublishedCourse,
  type DashboardWalletSummary,
  type DashboardSocial,
} from "@/lib/dashboard.functions";
import { toast } from "sonner";
import { EditListingModal } from "@/components/oventric/EditListingModal";
import { SellSwitcherModal } from "@/components/oventric/SellSwitcherModal";
import { listUserPhotos, type UserPhoto } from "@/lib/posts.functions";
import { PhotoBatches } from "@/components/oventric/PhotoBatches";
import { PhotoBatchManager } from "@/components/oventric/PhotoBatchManager";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { Images } from "lucide-react";
import {
  OverviewSkeleton,
  ListSkeleton,
  WalletSkeleton,
  SocialSkeleton,
  ListingsSkeleton,
  DigitalSkeleton,
  PhysicalSkeleton,
  PhotoGridSkeleton,
} from "@/components/oventric/skeletons";
import { formatMoney } from "@/lib/fx-display";
import { listMySales, type SaleDTO } from "@/lib/fulfilment.functions";
import { OrderFulfilmentRoadmap } from "@/components/oventric/OrderFulfilmentRoadmap";
import { QuickActions } from "@/components/oventric/dashboard/QuickActions";
import { AnalyticsWidget } from "@/components/oventric/dashboard/AnalyticsWidget";
import { AnalyticsCharts } from "@/components/oventric/dashboard/AnalyticsCharts";
import { NotificationsPanel } from "@/components/oventric/dashboard/NotificationsPanel";

import { SalesFulfilmentList } from "@/components/oventric/SalesFulfilmentList";
import { Truck } from "lucide-react";
import { SellerDashboard } from "@/components/oventric/dashboard/SellerDashboard";


function formatHomeCurrency(n: number, c: string): string {
  return formatMoney(Number.isFinite(n) ? n : 0, c);
}

const TAB_VALUES = [
  "overview",
  "bounties",
  "courses",
  "wallet",
  "social",
  "digital",
  "sales",
  "listings",
  "creator",
] as const;
type Tab = (typeof TAB_VALUES)[number];


export const Route = createFileRoute("/dashboard")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = typeof search.tab === "string" ? search.tab : undefined;
    return t && (TAB_VALUES as readonly string[]).includes(t) ? { tab: t as Tab } : {};
  },
  head: () => ({
    meta: [
      { title: "My Dashboard — Oventric" },
      {
        name: "description",
        content:
          "Manage your Oventric activity — purchases, listings, bounties, courses, wallet, and social.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const isAppShell = useIsAppShell();
  const navigate = useNavigate();
  const { tab: tabParam } = Route.useSearch();
  const purchasesFn = useServerFn(listMyPurchases);
  const contactsFn = useServerFn(listMyContactedSellers);
  const listingsFn = useServerFn(listMyProducts);
  const orderFn = useServerFn(getOrderWithDownload);
  const logFn = useServerFn(logProductContact);
  const confirmFn = useServerFn(confirmOrderReceived);
  const overviewFn = useServerFn(getDashboardOverview);
  const bountiesFn = useServerFn(listMyBounties);
  const coursesFn = useServerFn(listMyCourses);
  const walletFn = useServerFn(getMyWalletSummary);
  const socialFn = useServerFn(getMySocial);

  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>(tabParam ?? "overview");
  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [purchases, setPurchases] = useState<PurchaseDTO[] | null>(null);
  const [contacts, setContacts] = useState<ContactedSellerDTO[] | null>(null);
  const [listings, setListings] = useState<ProductDTO[] | null>(null);
  const [bounties, setBounties] = useState<{
    posted: DashboardBountyPosted[];
    solved: DashboardBountySolved[];
  } | null>(null);
  const [courses, setCourses] = useState<{
    enrolled: DashboardEnrolledCourse[];
    published: DashboardPublishedCourse[];
  } | null>(null);
  const [walletSummary, setWalletSummary] = useState<DashboardWalletSummary | null>(null);
  const [walletPage, setWalletPage] = useState(1);
  const [social, setSocial] = useState<DashboardSocial | null>(null);
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleDTO[] | null>(null);
  const salesFn = useServerFn(listMySales);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data.user) {
        navigate({ to: "/" });
        return;
      }
      setAuthChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

  const loadPurchases = useCallback(async () => {
    try {
      setPurchases(await purchasesFn());
    } catch (e) {
      toast.error((e as Error).message);
      setPurchases([]);
    }
  }, [purchasesFn]);

  const loadSales = useCallback(async () => {
    try {
      setSales(await salesFn());
    } catch (e) {
      toast.error((e as Error).message);
      setSales([]);
    }
  }, [salesFn]);

  const loadContacts = useCallback(async () => {
    try {
      setContacts(await contactsFn());
    } catch (e) {
      toast.error((e as Error).message);
      setContacts([]);
    }
  }, [contactsFn]);

  const loadListings = useCallback(async () => {
    try {
      setListings(await listingsFn());
    } catch (e) {
      toast.error((e as Error).message);
      setListings([]);
    }
  }, [listingsFn]);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await overviewFn());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [overviewFn]);

  const loadBounties = useCallback(async () => {
    try {
      setBounties(await bountiesFn());
    } catch (e) {
      toast.error((e as Error).message);
      setBounties({ posted: [], solved: [] });
    }
  }, [bountiesFn]);

  const loadCourses = useCallback(async () => {
    try {
      setCourses(await coursesFn());
    } catch (e) {
      toast.error((e as Error).message);
      setCourses({ enrolled: [], published: [] });
    }
  }, [coursesFn]);

  const loadWallet = useCallback(
    async (p?: number) => {
      try {
        setWalletSummary(await walletFn({ data: { page: p ?? walletPage } }));
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [walletFn, walletPage],
  );

  const loadSocial = useCallback(async () => {
    try {
      setSocial(await socialFn());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [socialFn]);

  useEffect(() => {
    if (!authChecked) return;
    if (tab === "overview" && overview === null) void loadOverview();
    if (tab === "digital" && purchases === null) void loadPurchases();
    if (tab === "sales" && sales === null) void loadSales();
    if (tab === "listings" && listings === null) void loadListings();
    if (tab === "bounties" && bounties === null) void loadBounties();
    if (tab === "courses" && courses === null) void loadCourses();
    if (tab === "wallet" && walletSummary === null) void loadWallet();
    if (tab === "social" && social === null) void loadSocial();
  }, [
    authChecked,
    tab,
    overview,
    purchases,
    sales,
    contacts,
    listings,
    bounties,
    courses,
    walletSummary,
    social,
    loadOverview,
    loadPurchases,
    loadSales,
    loadContacts,
    loadListings,
    loadBounties,
    loadCourses,
    loadWallet,
    loadSocial,
  ]);

  // Realtime: refresh contacts when a new contact log lands for this user
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel("dashboard-contacts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "product_contacts" },
        () => {
          void loadContacts();
        },
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        void loadPurchases();
        void loadSales();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, () => {
        void loadListings();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, () => {
        void loadOverview();
        if (walletSummary !== null) void loadWallet();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions" },
        () => {
          void loadOverview();
          if (walletSummary !== null) void loadWallet();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [
    authChecked,
    loadContacts,
    loadPurchases,
    loadSales,
    loadListings,
    loadOverview,
    loadWallet,
    walletSummary,
  ]);

  // Refresh triggers from child modals (bounty publish, course publish).
  useEffect(() => {
    if (!authChecked) return;
    const onBounties = () => {
      void loadBounties();
      void loadOverview();
    };
    const onCourses = () => {
      void loadCourses();
      void loadOverview();
    };
    window.addEventListener("oventric:bounties-refresh", onBounties);
    window.addEventListener("oventric:courses-refresh", onCourses);
    return () => {
      window.removeEventListener("oventric:bounties-refresh", onBounties);
      window.removeEventListener("oventric:courses-refresh", onCourses);
    };
  }, [authChecked, loadBounties, loadCourses, loadOverview]);

  const handleDownload = async (
    orderId: string,
    productId: string,
    externalUrl: string | null,
    hasFile: boolean,
  ) => {
    setDownloadingId(orderId);
    try {
      const res = await orderFn({ data: { orderId } });
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      } else if (externalUrl) {
        window.open(externalUrl, "_blank", "noopener,noreferrer");
      } else if (!hasFile) {
        toast.info("No file attached", {
          description: "This product has no downloadable file. Open the product page for details.",
        });
        navigate({ to: "/product/$id", params: { id: productId } });
      } else {
        toast.error("Download link unavailable", {
          description: "Order may still be processing. Please try again shortly.",
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const relogContact = async (productId: string, method: "call" | "whatsapp") => {
    try {
      await logFn({ data: { productId, method } });
    } catch {
      /* silent */
    }
  };

  const stats = useMemo(
    () => ({
      digital: purchases?.filter((p) => p.status === "paid").length ?? 0,
      pending: purchases?.filter((p) => p.status === "pending").length ?? 0,
      contacts: contacts?.length ?? 0,
      listings: listings?.length ?? 0,
      listingsPending: listings?.filter((l) => l.status === "pending").length ?? 0,
      listingsActive: listings?.filter((l) => l.status === "active").length ?? 0,
      listingsRejected: listings?.filter((l) => l.status === "rejected").length ?? 0,
    }),
    [purchases, contacts, listings],
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] md:bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0d] md:bg-slate-50 text-slate-200 md:text-slate-700">
      <Header 
        onOpenMessages={() => {}} 
        browserVisitorHeader={!isAppShell} 
        forceSiteNavbar={!isAppShell}
      />
      <div
        className="max-w-5xl mx-auto px-4 py-8"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingTop: "max(2rem, calc(env(safe-area-inset-top) + 1rem))",
          paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1rem))",
        }}
      >
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-2 text-sm text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back home
        </button>

        <header className="mb-6">
          <h1 className="text-white md:text-slate-900 text-3xl font-black">My Dashboard</h1>
          <p className="text-slate-400 md:text-slate-500 mt-1 text-sm">
            Your full Oventric hub — wallet, bounties, courses, marketplace and social.
          </p>
        </header>

        <Link
          to="/ads-manager"
          className="group mb-5 flex items-center justify-between gap-3 rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 active:bg-white/[0.03]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-white md:text-slate-900" />
            </div>
            <div className="min-w-0">
              <div className="text-white md:text-slate-900 text-sm font-semibold">Ads Manager</div>
              <div className="text-slate-400 md:text-slate-500 text-xs">
                Manage and track your ad campaigns.
              </div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 md:text-slate-500 shrink-0" />
        </Link>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 rounded-2xl bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 p-2.5 mb-6">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            <LayoutDashboard className="w-5 h-5 shrink-0" />{" "}
            <span className="truncate">Overview</span>
          </TabButton>
          <TabButton active={tab === "bounties"} onClick={() => setTab("bounties")}>
            <Target className="w-5 h-5 shrink-0" /> <span className="truncate">Bounties</span>
          </TabButton>
          <TabButton active={tab === "courses"} onClick={() => setTab("courses")}>
            <GraduationCap className="w-5 h-5 shrink-0" /> <span className="truncate">Courses</span>
          </TabButton>
          <TabButton active={tab === "wallet"} onClick={() => setTab("wallet")}>
            <WalletIcon className="w-5 h-5 shrink-0" /> <span className="truncate">Wallet</span>
          </TabButton>
          <TabButton active={tab === "digital"} onClick={() => setTab("digital")}>
            <Package className="w-5 h-5 shrink-0" /> <span className="truncate">Digital</span>
          </TabButton>
          <TabButton active={tab === "sales"} onClick={() => setTab("sales")}>
            <Truck className="w-5 h-5 shrink-0" /> <span className="truncate">Sales</span>
            {(sales?.filter(
              (s) => s.escrowStatus === "held" && s.requiresManualDelivery && !s.deliveredAt,
            ).length ?? 0) > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-black text-[11px] font-bold">
                {
                  sales!.filter(
                    (s) => s.escrowStatus === "held" && s.requiresManualDelivery && !s.deliveredAt,
                  ).length
                }
              </span>
            )}
          </TabButton>
          <TabButton active={tab === "listings"} onClick={() => setTab("listings")}>
            <Store className="w-5 h-5 shrink-0" /> <span className="truncate">Listings</span>
            {stats.listingsRejected > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white md:text-slate-900 text-[11px] font-bold">
                {stats.listingsRejected}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === "social"} onClick={() => setTab("social")}>
            <Users className="w-5 h-5 shrink-0" /> <span className="truncate">Social</span>
          </TabButton>
          <TabButton active={tab === "creator"} onClick={() => setTab("creator")}>
            <TrendingUp className="w-5 h-5 shrink-0" /> <span className="truncate">Creator Hub</span>
          </TabButton>
        </div>


        {tab === "overview" && <OverviewPane overview={overview} onGoto={setTab} />}
        {tab === "bounties" && <BountiesPane data={bounties} />}
        {tab === "courses" && <CoursesPane data={courses} />}
        {tab === "wallet" && (
          <WalletPane
            data={walletSummary}
            page={walletPage}
            onPage={(p) => {
              setWalletPage(p);
              void loadWallet(p);
            }}
          />
        )}
        {tab === "digital" && (
          <DigitalList
            rows={purchases}
            downloadingId={downloadingId}
            onDownload={handleDownload}
            onConfirm={async (orderId) => {
              try {
                await confirmFn({ data: { orderId } });
                toast.success("Thanks! Seller funds released.");
                await loadPurchases();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          />
        )}
        {tab === "sales" && (
          <SalesList
            rows={sales}
            onChanged={() => {
              void loadSales();
              void loadOverview();
            }}
          />
        )}
        {tab === "listings" && (
          <ListingsList
            rows={listings}
            counts={{
              pending: stats.listingsPending,
              active: stats.listingsActive,
              rejected: stats.listingsRejected,
            }}
            onEdit={(p) => setEditing(p)}
          />
        )}
        {tab === "social" && <SocialPane data={social} />}
        {tab === "creator" && <SellerDashboard />}

      </div>

      {editing && (
        <EditListingModal
          product={editing}
          onClose={() => setEditing(null)}
          onResubmitted={() => {
            void loadListings();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 flex items-center justify-between gap-3 md:block">
      {/* Mobile: single row — icon + label left, number in white right */}
      <div className="flex items-center gap-2 min-w-0 md:text-[10px] md:uppercase md:tracking-widest md:text-slate-500 md:font-bold">
        <Icon className={`w-4 h-4 shrink-0 ${accent} md:w-3.5 md:h-3.5`} />
        <span className="truncate text-sm text-slate-300 md:text-slate-600 font-medium md:text-[10px] md:uppercase md:tracking-widest md:text-slate-500 md:font-bold">
          {label}
        </span>
      </div>
      <div className="shrink-0 text-lg font-black text-white md:text-slate-900 md:mt-1 md:text-2xl">
        {value}
      </div>
    </div>
  );
}

function SimpleRowCard({
  icon: Icon,
  title,
  subtitle,
  value,
  onClick,
  href,
}: {
  icon: typeof Package;
  title: string;
  subtitle?: string;
  value?: string | number;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-[10px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-white md:text-slate-900" />
        </div>
        <div className="min-w-0">
          <div className="text-white md:text-slate-900 text-sm font-semibold truncate">{title}</div>
          {subtitle ? (
            <div className="text-slate-400 md:text-slate-500 text-xs truncate">{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {value !== undefined ? (
          <span className="text-sm font-black text-white md:text-slate-900">{value}</span>
        ) : null}
        <ArrowUpRight className="w-4 h-4 text-slate-400 md:text-slate-500" />
      </div>
    </>
  );
  const cls =
    "group flex items-center justify-between gap-3 rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 active:bg-white/[0.03] w-full text-left";
  if (href) {
    return (
      <Link to={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function PremiumStatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  onClick,
  hero,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
  sub?: string;
  tone: "emerald" | "amber" | "fuchsia" | "sky" | "cyan" | "rose" | "violet";
  onClick: () => void;
  hero?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4 text-left transition active:scale-[0.98] ${hero ? "col-span-2" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 md:bg-slate-50 text-white md:text-slate-900">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 md:text-slate-500 font-bold leading-tight line-clamp-2 min-h-[1.6em]">
            {label}
          </div>
          <div
            className={`mt-1 font-black text-white md:text-slate-900 ${hero ? "text-2xl" : "text-xl"} truncate`}
          >
            {value}
          </div>
          {sub ? (
            <div className="mt-0.5 text-[11px] text-slate-400 md:text-slate-500 leading-tight line-clamp-2">
              {sub}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-start gap-3 px-3.5 py-3 rounded-xl text-sm sm:text-base font-semibold transition min-w-0 ${
        active
          ? "bg-white text-black shadow-sm"
          : "text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:bg-slate-50 md:hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  cta,
}: {
  icon: typeof Package;
  title: string;
  hint: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 md:border-slate-200 bg-[#111114] md:bg-slate-50 p-10 text-center">
      <Icon className="w-8 h-8 text-slate-600 mx-auto mb-3" />
      <div className="text-white md:text-slate-900 font-bold">{title}</div>
      <div className="text-sm text-slate-500 mt-1">{hint}</div>
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: PurchaseDTO["status"] }) {
  const meta = {
    paid: { label: "Paid", icon: CheckCircle2 },
    pending: { label: "Pending", icon: Clock },
    failed: { label: "Failed", icon: AlertTriangle },
    refunded: { label: "Refunded", icon: AlertTriangle },
  }[status];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-50 text-[10px] font-bold text-slate-300 md:text-slate-600">
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function DigitalList({
  rows,
  downloadingId,
  onDownload,
  onConfirm,
}: {
  rows: PurchaseDTO[] | null;
  downloadingId: string | null;
  onDownload: (
    orderId: string,
    productId: string,
    externalUrl: string | null,
    hasFile: boolean,
  ) => void;
  onConfirm: (orderId: string) => void;
}) {
  const [tracking, setTracking] = useState<string | null>(null);
  if (rows === null) {
    return <DigitalSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No digital purchases yet"
        hint="Your purchased digital products will appear here so you can re-download them anytime."
        cta={
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white text-black text-sm font-bold"
          >
            Browse Marketplace
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.orderId} className="space-y-2">
          <div className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 flex gap-3">
            <Link
              to="/order/$id"
              params={{ id: r.orderId }}
              className="shrink-0 w-20 h-20 rounded-[10px] overflow-hidden bg-white/5 md:bg-slate-50 flex items-center justify-center"
            >
              {r.coverUrl ? (
                <img
                  src={r.coverUrl}
                  alt={r.productName}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShoppingBag className="w-6 h-6 text-white/30" />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 md:text-slate-500 truncate">
                    {r.category}
                  </div>
                  <Link
                    to="/order/$id"
                    params={{ id: r.orderId }}
                    className="text-sm font-bold text-white md:text-slate-900 hover:text-white md:hover:text-slate-900 truncate block"
                  >
                    {r.productName}
                  </Link>
                  <div className="text-xs text-slate-400 md:text-slate-500 truncate">
                    by {r.vendor}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-400 md:text-slate-500">
                  {r.displayCurrency}{" "}
                  {r.displayTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ·{" "}
                  {new Date(r.paidAt ?? r.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "paid" && (r.hasFile || r.externalUrl) && (
                    <button
                      onClick={() => onDownload(r.orderId, r.productId, r.externalUrl, r.hasFile)}
                      disabled={downloadingId === r.orderId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white text-black hover:bg-white/90 text-xs font-bold disabled:opacity-60"
                    >
                      {downloadingId === r.orderId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : r.hasFile ? (
                        <Download className="w-3.5 h-3.5" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      {r.hasFile ? "Download" : "Open"}
                    </button>
                  )}
                  {r.status === "paid" && r.escrowStatus === "held" && (
                    <button
                      onClick={() => onConfirm(r.orderId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/10 hover:bg-white/15 md:bg-slate-100 border border-white/10 md:border-slate-200 text-white md:text-slate-900 text-xs font-bold"
                      title="Confirm you've received this product to release the seller's funds"
                    >
                      Confirm received
                    </button>
                  )}
                  <Link
                    to="/order/$id"
                    params={{ id: r.orderId }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 md:bg-slate-50 hover:bg-white/10 md:bg-slate-100 md:hover:bg-slate-100 border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 text-xs font-semibold"
                  >
                    View details
                  </Link>
                  <button
                    onClick={() => setTracking((t) => (t === r.orderId ? null : r.orderId))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 md:bg-slate-50 hover:bg-white/10 md:bg-slate-100 md:hover:bg-slate-100 border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 text-xs font-semibold"
                  >
                    <Truck className="w-3.5 h-3.5" />{" "}
                    {tracking === r.orderId ? "Hide tracking" : "Track order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {tracking === r.orderId && <OrderFulfilmentRoadmap orderId={r.orderId} />}
        </div>
      ))}
    </div>
  );
}

function SalesList({ rows, onChanged }: { rows: SaleDTO[] | null; onChanged: () => void }) {
  if (rows === null) return <DigitalSkeleton />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No sales yet"
        hint="Orders placed on your listings appear here. Deliver in the buyer's Oventric chat — escrow only protects trades completed in-app."
        cta={
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white text-black text-sm font-bold"
          >
            Go to Marketplace
          </Link>
        }
      />
    );
  }

  return <SalesFulfilmentList rows={rows} onChanged={onChanged} />;
}

function PhysicalList({
  rows,
  onRelog,
}: {
  rows: ContactedSellerDTO[] | null;
  onRelog: (productId: string, method: "call" | "whatsapp") => void;
}) {
  if (rows === null) {
    return <PhysicalSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="You haven't contacted any sellers yet"
        hint="When you tap Call or Chat on a physical listing, it'll show up here so you can reach the seller again."
        cta={
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white text-black text-sm font-bold"
          >
            Browse physical goods
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const phone = (r.sellerPhone ?? "").replace(/\D/g, "");
        const wa = (r.whatsappNumber ?? phone).replace(/\D/g, "");
        const productUrl =
          typeof window !== "undefined" ? `${window.location.origin}/product/${r.productId}` : "";
        const message = `Hi! I'm still interested in your product "${r.productName}" on Oventric.\n\n${productUrl}`;
        const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : "";
        return (
          <div
            key={r.id}
            className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 flex gap-3"
          >
            <Link
              to="/product/$id"
              params={{ id: r.productId }}
              className="shrink-0 w-20 h-20 rounded-[10px] overflow-hidden bg-white/5 md:bg-slate-50 flex items-center justify-center"
            >
              {r.coverUrl ? (
                <img
                  src={r.coverUrl}
                  alt={r.productName}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShoppingBag className="w-6 h-6 text-white/30" />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 md:text-slate-500 truncate">
                    {r.category}
                  </div>
                  <Link
                    to="/product/$id"
                    params={{ id: r.productId }}
                    className="text-sm font-bold text-white md:text-slate-900 hover:text-white md:hover:text-slate-900 truncate block"
                  >
                    {r.productName}
                  </Link>
                  <div className="text-xs text-slate-400 md:text-slate-500 truncate">
                    by {r.vendor}
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 md:text-slate-500">
                <span>
                  {r.originalCurrency}{" "}
                  {r.originalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                {r.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {r.location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  {r.method === "call" ? (
                    <Phone className="w-3 h-3" />
                  ) : (
                    <MessageCircle className="w-3 h-3" />
                  )}
                  Last via {r.method === "call" ? "Call" : "WhatsApp"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {phone.length >= 6 && (
                  <a
                    href={`tel:+${phone}`}
                    onClick={() => onRelog(r.productId, "call")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/10 hover:bg-white/15 md:bg-slate-100 text-white md:text-slate-900 text-xs font-semibold"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                )}
                {wa && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onRelog(r.productId, "whatsapp")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white text-black hover:bg-white/90 text-xs font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                <Link
                  to="/product/$id"
                  params={{ id: r.productId }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 md:bg-slate-50 hover:bg-white/10 md:bg-slate-100 md:hover:bg-slate-100 border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 text-xs font-semibold"
                >
                  View listing
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListingStatusBadge({ status }: { status: ProductDTO["status"] }) {
  const meta = {
    pending: { label: "Pending review", icon: Clock },
    active: { label: "Live", icon: CheckCircle2 },
    rejected: { label: "Rejected", icon: AlertTriangle },
  }[status] ?? { label: status, icon: AlertTriangle };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-50 text-[10px] font-bold text-slate-300 md:text-slate-600">
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function ListingsList({
  rows,
  counts,
  onEdit,
}: {
  rows: ProductDTO[] | null;
  counts: { pending: number; active: number; rejected: number };
  onEdit: (p: ProductDTO) => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "rejected">("all");
  const [kind, setKind] = useState<"all" | "digital" | "physical">("all");
  const [sellOpen, setSellOpen] = useState(false);

  if (rows === null) {
    return <ListingsSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <>
        <EmptyState
          icon={Store}
          title="You haven't published any listings yet"
          hint="Start selling digital assets, or browse the marketplace to see what's live."
          cta={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setSellOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white text-black text-sm font-bold hover:bg-white/90"
              >
                <Plus className="w-4 h-4" /> Start selling
              </button>
              <Link
                to="/"
                onClick={() =>
                  setTimeout(
                    () =>
                      window.dispatchEvent(
                        new CustomEvent("oventric:navigate", {
                          detail: { section: "Marketplace" },
                        }),
                      ),
                    40,
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white/10 hover:bg-white/15 md:bg-slate-100 border border-white/10 md:border-slate-200 text-white md:text-slate-900 text-sm font-semibold"
              >
                Go to marketplace
              </Link>
            </div>
          }
        />
        <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      </>
    );
  }

  const kindFiltered = kind === "all" ? rows : rows.filter((r) => r.kind === kind);
  const filtered =
    filter === "all" ? kindFiltered : kindFiltered.filter((r) => r.status === filter);
  const chips: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: kindFiltered.length },
    {
      key: "pending",
      label: "Pending",
      count: kindFiltered.filter((r) => r.status === "pending").length,
    },
    {
      key: "active",
      label: "Live",
      count: kindFiltered.filter((r) => r.status === "active").length,
    },
    {
      key: "rejected",
      label: "Rejected",
      count: kindFiltered.filter((r) => r.status === "rejected").length,
    },
  ];
  const digitalCount = rows.filter((r) => r.kind === "digital").length;
  const kindChips: { key: typeof kind; label: string; count: number }[] = [
    { key: "all", label: "All types", count: rows.length },
    { key: "digital", label: "Digital", count: digitalCount },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex items-center gap-1 rounded-full bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 p-1">
          {kindChips.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                kind === k.key
                  ? "bg-white text-black"
                  : "text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900"
              }`}
            >
              {k.label}
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  kind === k.key
                    ? "bg-black/20 text-black"
                    : "bg-white/10 md:bg-slate-100 text-slate-200 md:text-slate-700"
                }`}
              >
                {k.count}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSellOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white text-black text-xs font-bold hover:bg-white/90"
          >
            <Plus className="w-3.5 h-3.5" /> Start selling
          </button>
          <Link
            to="/"
            onClick={() =>
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent("oventric:navigate", { detail: { section: "Marketplace" } }),
                  ),
                40,
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/10 hover:bg-white/15 md:bg-slate-100 border border-white/10 md:border-slate-200 text-white md:text-slate-900 text-xs font-semibold"
          >
            Marketplace
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              filter === c.key
                ? "bg-white border-white/20 md:border-slate-300 text-black"
                : "bg-white/5 md:bg-slate-50 border-white/10 md:border-slate-200 text-slate-300 md:text-slate-600 hover:bg-white/10 md:bg-slate-100 md:hover:bg-slate-100"
            }`}
          >
            {c.label}
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                filter === c.key
                  ? "bg-black/20 text-black"
                  : "bg-white/10 md:bg-slate-100 text-slate-200 md:text-slate-700"
              }`}
            >
              {c.count}
            </span>
          </button>
        ))}
      </div>
      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 md:border-slate-200 bg-[#111114] md:bg-slate-50 p-8 text-center text-sm text-slate-500">
          No listings in this bucket.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 flex gap-3"
            >
              <Link
                to="/product/$id"
                params={{ id: p.id }}
                className="shrink-0 w-20 h-20 rounded-[10px] overflow-hidden bg-white/5 md:bg-slate-50 flex items-center justify-center"
              >
                {p.coverUrl ? (
                  <img
                    src={p.coverUrl}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag className="w-6 h-6 text-white/30" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 md:text-slate-500 truncate">
                      Digital · {p.category}
                    </div>
                    <Link
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="text-sm font-bold text-white md:text-slate-900 hover:text-white md:hover:text-slate-900 truncate block"
                    >
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-400 md:text-slate-500">
                      ${p.priceUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      {p.location ? (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {p.location}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ListingStatusBadge status={p.status} />
                </div>

                {p.status === "rejected" && p.rejectReason && (
                  <div className="mt-2 rounded-[10px] border border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-50 p-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300 md:text-slate-600 mb-0.5">
                      Moderator note
                    </div>
                    <div className="text-xs text-slate-200 md:text-slate-700 whitespace-pre-wrap break-words line-clamp-4">
                      {p.rejectReason}
                    </div>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(p.status === "rejected" || p.status === "pending") && (
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white text-black hover:bg-white/90 text-xs font-bold"
                    >
                      <Pencil className="w-3.5 h-3.5" />{" "}
                      {p.status === "rejected" ? "Edit & Resubmit" : "Edit"}
                    </button>
                  )}
                  {p.status === "active" && (
                    <Link
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/10 hover:bg-white/15 md:bg-slate-100 text-white md:text-slate-900 text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" /> View live
                    </Link>
                  )}
                  {p.status === "pending" && (
                    <span className="text-[11px] text-slate-500">
                      Awaiting admin approval — you can still edit.
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Overview                                                                   */
/* -------------------------------------------------------------------------- */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (!Number.isFinite(mins) || mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function KeyCard({
  icon: Icon,
  label,
  value,
  sub,
  empty,
  onClick,
  href,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
  sub: string;
  empty?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-50">
          <Icon className="h-4 w-4 text-white md:text-slate-900" aria-hidden="true" />
        </span>
        <span className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </span>
      </div>
      <div
        className={`mt-3 text-2xl font-black tabular-nums ${empty ? "text-slate-500" : "text-white md:text-slate-900"}`}
      >
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-slate-400 md:text-slate-500">{sub}</div>
    </>
  );
  const cls =
    "block w-full text-left rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4 transition hover:border-white/20 md:hover:border-slate-300 active:scale-[0.99]";
  if (href)
    return (
      <Link to={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function KeyOverviewCards({
  overview,
  onGoto,
}: {
  overview: DashboardOverview;
  onGoto: (t: Tab) => void;
}) {
  const cur = overview.homeCurrency;
  const orders = overview.orders;
  const revenue = overview.revenue;
  const unreadMsgs = overview.unread.messages;
  const activity = overview.activity;

  return (
    <section className="space-y-3" aria-label="Key dashboard metrics">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <KeyCard
          icon={ShoppingBag}
          label="Orders"
          value={orders.placed + orders.toFulfil}
          sub={
            orders.placed + orders.toFulfil === 0
              ? "No orders yet"
              : `${orders.awaitingBuyer} to confirm · ${orders.toFulfil} to fulfil`
          }
          empty={orders.placed + orders.toFulfil === 0}
          onClick={() => onGoto(orders.toFulfil > 0 ? "sales" : "digital")}
        />
        <KeyCard
          icon={MessageCircle}
          label="Messages"
          value={unreadMsgs}
          sub={unreadMsgs === 0 ? "Inbox is all caught up" : "Unread in your inbox"}
          empty={unreadMsgs === 0}
          href="/messages"
        />
        <KeyCard
          icon={TrendingUp}
          label="Revenue"
          value={formatHomeCurrency(revenue.gross, cur)}
          sub={
            revenue.grossUSD === 0
              ? "No released sales yet"
              : `${formatHomeCurrency(revenue.last30, cur)} in the last 30 days`
          }
          empty={revenue.grossUSD === 0}
          onClick={() => onGoto("wallet")}
        />
        <KeyCard
          icon={ActivityIcon}
          label="Activity"
          value={orders.last30}
          sub={orders.last30 === 0 ? "Nothing in the last 30 days" : "Order events · last 30 days"}
          empty={orders.last30 === 0}
          onClick={() => onGoto("social")}
        />
      </div>

      <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Recent activity
          </h2>
          {overview.unread.notifications > 0 ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 md:text-emerald-600">
              {overview.unread.notifications} new
            </span>
          ) : null}
        </div>

        {activity.length === 0 ? (
          <div className="py-6 text-center">
            <Bell className="mx-auto h-5 w-5 text-slate-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-white md:text-slate-900">
              No activity yet
            </p>
            <p className="mt-0.5 text-xs text-slate-400 md:text-slate-500">
              Orders, messages and payouts will show up here.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-white/5 md:divide-slate-100">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.unread ? "bg-emerald-400" : "bg-slate-600 md:bg-slate-300"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white md:text-slate-900">
                    {a.title}
                  </div>
                  {a.body ? (
                    <div className="truncate text-xs text-slate-400 md:text-slate-500">
                      {a.body}
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function OverviewPane({
  overview,
  onGoto,
}: {
  overview: DashboardOverview | null;
  onGoto: (t: Tab) => void;
}) {
  // Lazy init so the first paint already picks the safe layout on mobile —
  // avoids a scrambled frame before useEffect runs. Any touch-primary narrow
  // viewport gets the safe overview; premium grid stays for pointer:fine (PC).
  const [useSafeOverview, setUseSafeOverview] = useState(() => {
    if (typeof window === "undefined") return true;
    // Simplified path for ALL mobile/tablet viewports. Premium grid is
    // desktop-only from now on.
    return window.matchMedia?.("(max-width: 1023px)").matches ?? true;
  });

  useEffect(() => {
    const lowGpu = shouldUseSafeDashboardOverview();
    if (lowGpu) {
      setUseSafeOverview(true);
      document.documentElement.classList.remove("high-gpu");
      document.documentElement.classList.add("low-gpu");
      document.documentElement.dataset.gpuTier = "low";
      document.documentElement.dataset.gpuReason ||= "dashboard-fallback";
    }
  }, []);

  if (!overview) return <OverviewSkeleton />;
  const w = overview.wallet;
  const homeCurrency = overview.homeCurrency;
  const fmtHome = (n: number) => formatHomeCurrency(n, homeCurrency);
  const walletAvail = w ? fmtHome(w.available) : "—";
  const walletEscrow = w ? `Escrow ${fmtHome(w.escrow)}` : "Wallet not initialized";
  const bountyEarned = fmtHome(overview.bounties.earned);
  return (
    <div className="space-y-5">
      <QuickActions />
      <KeyOverviewCards overview={overview} onGoto={onGoto} />

      <div className="grid grid-cols-1 gap-3">
        <AnalyticsWidget />
      </div>


      <AnalyticsCharts />

      <NotificationsPanel />

      {/* Mobile: simplified flat rows, monochrome icons, no gradients / shadows / glow */}

      <div
        className="block md:hidden pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-2"
        aria-label="Dashboard overview"
      >
        <SimpleRowCard
          icon={WalletIcon}
          title="Wallet balance"
          subtitle={walletEscrow}
          value={walletAvail}
          onClick={() => onGoto("wallet")}
        />
        <SimpleRowCard
          icon={Trophy}
          title="Bounties earned"
          subtitle={`${overview.bounties.solved} solved · ${overview.bounties.posted} posted`}
          value={bountyEarned}
          onClick={() => onGoto("bounties")}
        />
        <SimpleRowCard
          icon={Users}
          title="Network"
          subtitle={`${overview.social.following} following · ${overview.social.circles} circles`}
          value={overview.social.followers}
          onClick={() => onGoto("social")}
        />
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Download}
            label="Downloads"
            value={overview.purchases.total}
            accent="text-white md:text-slate-900"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={overview.purchases.pending}
            accent="text-white md:text-slate-900"
          />
          <StatCard
            icon={MessageCircle}
            label="Contacted"
            value={overview.contacts}
            accent="text-white md:text-slate-900"
          />
          <StatCard
            icon={Store}
            label="Listings"
            value={overview.listings.total}
            accent="text-white md:text-slate-900"
          />
          <StatCard
            icon={GraduationCap}
            label="Enrolled"
            value={overview.courses.enrolled}
            accent="text-white md:text-slate-900"
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed"
            value={overview.courses.completed}
            accent="text-white md:text-slate-900"
          />
          <StatCard
            icon={Target}
            label="Active"
            value={overview.bounties.active}
            accent="text-white md:text-slate-900"
          />
          <StatCard
            icon={Bell}
            label="Alerts"
            value={overview.unread.notifications}
            accent="text-white md:text-slate-900"
          />
        </div>
      </div>

      <div className="hidden grid-cols-1 gap-3 md:grid md:grid-cols-3">
        <button
          onClick={() => onGoto("wallet")}
          className="text-left rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-5 hover:border-white/20 md:border-slate-300 transition"
        >
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Wallet balance
          </div>
          <div className="mt-2 text-3xl font-black text-white md:text-slate-900">{walletAvail}</div>
          <div className="text-xs text-slate-400 md:text-slate-500 mt-1">{walletEscrow}</div>
        </button>
        <button
          onClick={() => onGoto("bounties")}
          className="text-left rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-5 hover:border-white/20 md:border-slate-300 transition"
        >
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1">
            <Trophy className="w-3 h-3 text-white md:text-slate-900" /> Bounties earned
          </div>
          <div className="mt-2 text-3xl font-black text-white md:text-slate-900">
            {bountyEarned}
          </div>
          <div className="text-xs text-slate-400 md:text-slate-500 mt-1">
            {overview.bounties.solved} solved · {overview.bounties.posted} posted
          </div>
        </button>
        <button
          onClick={() => onGoto("social")}
          className="text-left rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-5 hover:border-white/20 md:border-slate-300 transition"
        >
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Network
          </div>
          <div className="mt-2 text-3xl font-black text-white md:text-slate-900">
            {overview.social.followers}
          </div>
          <div className="text-xs text-slate-400 md:text-slate-500 mt-1">
            Followers · {overview.social.following} following · {overview.social.circles} circles
          </div>
        </button>
      </div>

      <div className="hidden grid-cols-1 gap-2 md:grid md:grid-cols-4 md:gap-3">
        <StatCard
          icon={Download}
          label="Downloads"
          value={overview.purchases.total}
          accent="text-white md:text-slate-900"
        />
        <StatCard
          icon={Clock}
          label="Pending orders"
          value={overview.purchases.pending}
          accent="text-white md:text-slate-900"
        />
        <StatCard
          icon={MessageCircle}
          label="Sellers contacted"
          value={overview.contacts}
          accent="text-white md:text-slate-900"
        />
        <StatCard
          icon={Store}
          label="My listings"
          value={overview.listings.total}
          accent="text-white md:text-slate-900"
        />
        <StatCard
          icon={GraduationCap}
          label="Enrolled courses"
          value={overview.courses.enrolled}
          accent="text-white md:text-slate-900"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed courses"
          value={overview.courses.completed}
          accent="text-white md:text-slate-900"
        />
        <StatCard
          icon={Target}
          label="Active bounties"
          value={overview.bounties.active}
          accent="text-white md:text-slate-900"
        />
        <StatCard
          icon={Bell}
          label="Unread notifications"
          value={overview.unread.notifications}
          accent="text-white md:text-slate-900"
        />
      </div>
    </div>
  );
}

function shouldUseSafeDashboardOverview() {
  if (typeof window === "undefined") return false;
  const root = document.documentElement;
  if (root.classList.contains("low-gpu")) return true;

  const ua = navigator.userAgent || "";
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (!isMobile || !isAndroid) return false;
  if (/Infinix|X6813|X68\d{2}|Note\s*11i|TECNO|itel|Nokia\s*C|Redmi\s*(9|A)|Realme\s*C/i.test(ua)) {
    return true;
  }
  if (root.classList.contains("high-gpu")) return false;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const memory = nav.deviceMemory || 0;
  const cores = nav.hardwareConcurrency || 0;
  const androidVersion = Number((ua.match(/Android\s+(\d+)/i) || [])[1] || 0);
  const dpr = window.devicePixelRatio || 1;
  const longScreen = Math.max(window.screen?.width || 0, window.screen?.height || 0);
  const physicalWidth = longScreen * dpr;
  const connection = nav.connection;

  let score = 0;
  if (!androidVersion || androidVersion <= 11) score -= 2;
  else if (androidVersion === 12) score -= 1;
  else if (androidVersion >= 14) score += 1;

  if (!memory) score -= 1;
  else if (memory <= 4) score -= 3;
  else if (memory <= 6) score -= 1;
  else if (memory >= 12) score += 2;
  else if (memory >= 8) score += 1;

  if (!cores) score -= 1;
  else if (cores <= 4) score -= 3;
  else if (cores <= 6) score -= 1;
  else if (cores >= 8) score += 1;

  if (physicalWidth >= 2400 && dpr >= 3) score += 1;
  else if (physicalWidth <= 1600 || dpr < 2) score -= 1;

  if (connection?.saveData) score -= 3;
  if (["slow-2g", "2g", "3g"].includes(connection?.effectiveType || "")) score -= 1;

  return !(score >= 5 && androidVersion >= 13 && memory >= 8 && cores >= 8);
}

function BountyCoverThumb({
  url,
  title,
  className = "",
}: {
  url: string | null;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 ${className}`}
    >
      {url ? (
        <img
          src={url}
          alt={title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600">
          <Target className="w-8 h-8" />
        </div>
      )}
    </div>
  );
}

function bountyStatusBadge(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  if (s === "active")
    return {
      label: "Active",
      className: "bg-emerald-500/15 text-emerald-300 md:text-emerald-700 border-emerald-500/30",
    };
  if (s === "pending_review")
    return {
      label: "Pending review",
      className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    };
  if (s === "rejected")
    return { label: "Rejected", className: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
  if (s === "paused")
    return {
      label: "Paused",
      className: "bg-slate-500/15 text-slate-300 md:text-slate-600 border-slate-500/30",
    };
  if (s === "closed")
    return {
      label: "Closed",
      className: "bg-slate-500/15 text-slate-300 md:text-slate-600 border-slate-500/30",
    };
  if (s === "solved" || s === "released")
    return { label: "Solved", className: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
  if (s === "disputed")
    return { label: "Disputed", className: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
  if (s === "draft")
    return {
      label: "Draft",
      className: "bg-slate-500/15 text-slate-300 md:text-slate-600 border-slate-500/30",
    };
  return {
    label: status,
    className: "bg-slate-500/15 text-slate-300 md:text-slate-600 border-slate-500/30",
  };
}

function isExpiredBounty(b: DashboardBountyPosted): boolean {
  if (!b.deadlineAt) return false;
  const s = b.status.toLowerCase();
  if (["solved", "released", "closed"].includes(s)) return false;
  return new Date(b.deadlineAt).getTime() < Date.now();
}

function BountiesPane({
  data,
}: {
  data: { posted: DashboardBountyPosted[]; solved: DashboardBountySolved[] } | null;
}) {
  const navigate = useNavigate();
  const [sub, setSub] = useState<"posted" | "solved">("posted");
  const [detailsFor, setDetailsFor] = useState<DashboardBountyPosted | null>(null);
  const [postOpen, setPostOpen] = useState(false);

  const openBountiesFeed = () => navigate({ to: "/", search: { section: "Bounties" } as never });

  if (!data) return <ListSkeleton count={6} />;

  const active = data.posted.filter(
    (b) => b.status.toLowerCase() === "active" && !isExpiredBounty(b),
  );
  const pending = data.posted.filter((b) => b.status.toLowerCase() === "pending_review");
  const solvedPosted = data.posted.filter((b) =>
    ["solved", "released"].includes(b.status.toLowerCase()),
  );
  const expired = data.posted.filter(isExpiredBounty);
  const other = data.posted.filter(
    (b) =>
      !active.includes(b) &&
      !pending.includes(b) &&
      !solvedPosted.includes(b) &&
      !expired.includes(b),
  );

  const renderGrid = (rows: DashboardBountyPosted[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((b) => {
        const badge = bountyStatusBadge(isExpiredBounty(b) ? "closed" : b.status);
        const deadline = b.deadlineAt ? new Date(b.deadlineAt) : null;
        return (
          <button
            key={b.id}
            onClick={() => setDetailsFor(b)}
            className="text-left rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm overflow-hidden hover:border-white/20 md:border-slate-300 transition"
          >
            <BountyCoverThumb url={b.coverUrl} title={b.title} className="aspect-video w-full" />
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-white md:text-slate-900 font-semibold truncate">
                    {b.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">{b.category}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white md:text-slate-900 font-black text-sm">
                    ${b.priceUSD.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 md:text-slate-500 mt-0.5">
                    {b.applicantsCount} applicant{b.applicantsCount === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.className}`}
                >
                  {isExpiredBounty(b) ? "Expired" : badge.label}
                </span>
                {deadline && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {deadline.toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="inline-flex rounded-[10px] bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 p-1 mb-4 gap-1">
        <TabButton active={sub === "posted"} onClick={() => setSub("posted")}>
          Posted by me ({data.posted.length})
        </TabButton>
        <TabButton active={sub === "solved"} onClick={() => setSub("solved")}>
          Solved by me ({data.solved.length})
        </TabButton>
      </div>

      {sub === "posted" && (
        <>
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              Your bounties ({data.posted.length})
            </div>
            <button
              onClick={() => setPostOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-white text-black font-bold text-xs hover:bg-slate-200 shrink-0"
            >
              <Plus className="w-4 h-4" /> Post a bounty
            </button>
          </div>

          {data.posted.length === 0 ? (
            <div className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-6 text-center">
              <Target className="w-8 h-8 mx-auto text-slate-500" />
              <div className="mt-3 text-white md:text-slate-900 font-semibold">
                No bounties posted yet
              </div>
              <div className="text-sm text-slate-400 md:text-slate-500 mt-1">
                Post a task and let experts apply to solve it.
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setPostOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white text-black font-bold text-sm hover:bg-slate-200"
                >
                  <Plus className="w-4 h-4" /> Post your first bounty
                </button>
                <button
                  onClick={openBountiesFeed}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border border-white/15 md:border-slate-200 text-slate-200 md:text-slate-700 font-semibold text-sm hover:bg-white/5 md:bg-slate-50 md:hover:bg-slate-100"
                >
                  Browse bounties <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {active.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                    Active ({active.length})
                  </div>
                  {renderGrid(active)}
                </section>
              )}
              {pending.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Pending review ({pending.length})
                  </div>
                  {renderGrid(pending)}
                </section>
              )}
              {solvedPosted.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Solved ({solvedPosted.length})
                  </div>
                  {renderGrid(solvedPosted)}
                </section>
              )}
              {expired.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Expired ({expired.length})
                  </div>
                  {renderGrid(expired)}
                </section>
              )}
              {other.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                    Other ({other.length})
                  </div>
                  {renderGrid(other)}
                </section>
              )}
            </div>
          )}
        </>
      )}

      {sub === "solved" &&
        (data.solved.length === 0 ? (
          <div className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-6 text-center">
            <Trophy className="w-8 h-8 mx-auto text-slate-500" />
            <div className="mt-3 text-white md:text-slate-900 font-semibold">
              No bounties solved yet
            </div>
            <div className="text-sm text-slate-400 md:text-slate-500 mt-1">
              Apply to open bounties and start earning payouts.
            </div>
            <button
              onClick={openBountiesFeed}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white text-black font-bold text-sm hover:bg-slate-200"
            >
              Browse bounties <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.solved.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-emerald-500/30 bg-[#141418] md:bg-white md:shadow-sm overflow-hidden"
              >
                <BountyCoverThumb
                  url={s.coverUrl}
                  title={s.title}
                  className="aspect-video w-full"
                />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-white md:text-slate-900 font-semibold truncate">
                        {s.title}
                      </div>
                      <div className="text-[11px] text-emerald-300 md:text-emerald-700 mt-1 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Paid{" "}
                        {new Date(s.solvedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-white md:text-slate-900 font-black text-sm shrink-0">
                      +${s.payoutUSD.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      {detailsFor && <BountyDetailsModal bounty={detailsFor} onClose={() => setDetailsFor(null)} />}

      <BountyEditorModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onPublished={() => {
          setPostOpen(false);
          toast.success("Bounty submitted for review");
          window.dispatchEvent(new CustomEvent("oventric:bounties-refresh"));
        }}
      />
    </div>
  );
}

function BountyDetailsModal({
  bounty,
  onClose,
}: {
  bounty: DashboardBountyPosted;
  onClose: () => void;
}) {
  const badge = bountyStatusBadge(isExpiredBounty(bounty) ? "closed" : bounty.status);
  const deadline = bounty.deadlineAt ? new Date(bounty.deadlineAt) : null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <BountyCoverThumb
          url={bounty.coverUrl}
          title={bounty.title}
          className="aspect-video w-full rounded-none border-0"
        />
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-white md:text-slate-900 font-black text-lg truncate">
                {bounty.title}
              </h3>
              <div className="text-xs text-slate-400 md:text-slate-500 mt-1 truncate">
                {bounty.category}
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.className}`}
                >
                  {isExpiredBounty(bounty) ? "Expired" : badge.label}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-white md:text-slate-900 font-black">
                ${bounty.priceUSD.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 md:text-slate-500 mt-1">
                {bounty.applicantsCount} / {bounty.applicantLimit ?? "∞"} applicants
              </div>
            </div>
          </div>

          {bounty.description && (
            <p className="text-sm text-slate-300 md:text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-8">
              {bounty.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 md:text-slate-500 pt-1">
            <div>
              <span className="text-slate-500">Posted</span>
              <div className="text-slate-200 md:text-slate-700">
                {new Date(bounty.createdAt).toLocaleDateString()}
              </div>
            </div>
            {deadline && (
              <div>
                <span className="text-slate-500">Deadline</span>
                <div className="text-slate-200 md:text-slate-700">
                  {deadline.toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full px-3 py-2 rounded-[10px] border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 text-sm hover:bg-white/5 md:bg-slate-50 md:hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseCoverThumb({
  url,
  title,
  className = "",
}: {
  url: string | null;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 ${className}`}
    >
      {url ? (
        <img
          src={url}
          alt={title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600">
          <GraduationCap className="w-8 h-8" />
        </div>
      )}
    </div>
  );
}

function CoursesPane({
  data,
}: {
  data: { enrolled: DashboardEnrolledCourse[]; published: DashboardPublishedCourse[] } | null;
}) {
  const navigate = useNavigate();
  const [sub, setSub] = useState<"enrolled" | "published">("enrolled");
  const [detailsFor, setDetailsFor] = useState<DashboardPublishedCourse | null>(null);
  const [editBlockedFor, setEditBlockedFor] = useState<DashboardPublishedCourse | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const openAcademy = () => navigate({ to: "/", search: { section: "Academy" } as never });

  if (!data) return <ListSkeleton count={6} />;

  const inProgress = data.enrolled.filter((c) => !c.completedAt);
  const completed = data.enrolled.filter((c) => !!c.completedAt);

  const tryEdit = (c: DashboardPublishedCourse) => {
    if (c.enrollments > 0) {
      setEditBlockedFor(c);
      return;
    }
    setDetailsFor(null);
    navigate({ to: "/", search: { section: "Academy", editCourse: c.id } as never });
  };

  return (
    <div>
      <div className="inline-flex rounded-[10px] bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 p-1 mb-4 gap-1">
        <TabButton active={sub === "enrolled"} onClick={() => setSub("enrolled")}>
          Enrolled ({data.enrolled.length})
        </TabButton>
        <TabButton active={sub === "published"} onClick={() => setSub("published")}>
          Published ({data.published.length})
        </TabButton>
      </div>

      {sub === "enrolled" &&
        (data.enrolled.length === 0 ? (
          <div className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-6 text-center">
            <GraduationCap className="w-8 h-8 mx-auto text-slate-500" />
            <div className="mt-3 text-white md:text-slate-900 font-semibold">No courses yet</div>
            <div className="text-sm text-slate-400 md:text-slate-500 mt-1">
              Start learning by browsing our top courses.
            </div>
            <button
              onClick={openAcademy}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white text-black font-bold text-sm hover:bg-slate-200"
            >
              Browse top courses <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {inProgress.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                  In progress ({inProgress.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {inProgress.map((c) => {
                    const pct =
                      c.totalModules > 0
                        ? Math.round((c.completedModules / c.totalModules) * 100)
                        : 0;
                    return (
                      <button
                        key={c.id}
                        onClick={openAcademy}
                        className="text-left rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm overflow-hidden hover:border-white/20 md:border-slate-300 transition"
                      >
                        <CourseCoverThumb
                          url={c.coverUrl}
                          title={c.title}
                          className="aspect-video w-full"
                        />
                        <div className="p-3">
                          <div className="text-white md:text-slate-900 font-semibold truncate">
                            {c.title}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {c.completedModules}/{c.totalModules} modules · {pct}%
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-white/5 md:bg-slate-50 overflow-hidden">
                            <div
                              className="h-full bg-white transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="mt-3 text-xs text-white md:text-slate-900 font-bold inline-flex items-center gap-1">
                            Continue learning <ArrowUpRight className="w-3 h-3" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Completed ({completed.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {completed.map((c) => (
                    <button
                      key={c.id}
                      onClick={openAcademy}
                      className="text-left rounded-xl border border-emerald-500/30 bg-[#141418] md:bg-white md:shadow-sm overflow-hidden hover:border-emerald-500/60 transition"
                    >
                      <CourseCoverThumb
                        url={c.coverUrl}
                        title={c.title}
                        className="aspect-video w-full"
                      />
                      <div className="p-3">
                        <div className="text-white md:text-slate-900 font-semibold truncate">
                          {c.title}
                        </div>
                        <div className="text-[11px] text-emerald-300 md:text-emerald-700 mt-1 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Completed{" "}
                          {c.completedAt ? new Date(c.completedAt).toLocaleDateString() : ""}
                        </div>
                        <div className="mt-3 text-xs text-white md:text-slate-900 font-bold inline-flex items-center gap-1">
                          Review course <ArrowUpRight className="w-3 h-3" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ))}

      {sub === "published" && (
        <>
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              Your courses ({data.published.length})
            </div>
            <button
              onClick={() => setPublishOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-white text-black font-bold text-xs hover:bg-slate-200 shrink-0"
            >
              <Plus className="w-4 h-4" /> Publish a course
            </button>
          </div>
          {data.published.length === 0 ? (
            <div className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-6 text-center">
              <GraduationCap className="w-8 h-8 mx-auto text-slate-500" />
              <div className="mt-3 text-white md:text-slate-900 font-semibold">
                No courses published
              </div>
              <div className="text-sm text-slate-400 md:text-slate-500 mt-1">
                Teach what you know and start earning.
              </div>
              <button
                onClick={() => setPublishOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white text-black font-bold text-sm hover:bg-slate-200"
              >
                <Plus className="w-4 h-4" /> Publish your first course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.published.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDetailsFor(c)}
                  className="text-left rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm overflow-hidden hover:border-white/20 md:border-slate-300 transition"
                >
                  <CourseCoverThumb
                    url={c.coverUrl}
                    title={c.title}
                    className="aspect-video w-full"
                  />
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-white md:text-slate-900 font-semibold truncate">
                          {c.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {c.isPublished ? "Published" : "Draft"} · {c.enrollments} enrolled
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-white md:text-slate-900 font-black text-sm">
                          {c.isFree ? "Free" : `$${c.priceUSD.toFixed(2)}`}
                        </div>
                        {c.revenueUSD > 0 && (
                          <div className="text-[10px] text-slate-400 md:text-slate-500 mt-0.5">
                            ${c.revenueUSD.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {detailsFor && (
        <CourseDetailsModal
          course={detailsFor}
          onClose={() => setDetailsFor(null)}
          onEdit={() => tryEdit(detailsFor)}
        />
      )}

      {editBlockedFor && (
        <EditBlockedModal course={editBlockedFor} onClose={() => setEditBlockedFor(null)} />
      )}

      <CoursePublishWizard
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onSaved={() => {
          setPublishOpen(false);
          toast.success("Course submitted");
          window.dispatchEvent(new CustomEvent("oventric:courses-refresh"));
        }}
      />
    </div>
  );
}

function CourseDetailsModal({
  course,
  onClose,
  onEdit,
}: {
  course: DashboardPublishedCourse;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CourseCoverThumb
          url={course.coverUrl}
          title={course.title}
          className="aspect-video w-full rounded-none border-0"
        />
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-white md:text-slate-900 font-black text-lg">{course.title}</h3>
              <div className="text-xs text-slate-400 md:text-slate-500 mt-1">
                {course.category ?? "—"} · {course.level ?? "—"} ·{" "}
                {course.isPublished ? "Published" : "Draft"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white md:text-slate-900 font-black">
                {course.isFree ? "Free" : `$${course.priceUSD.toFixed(2)}`}
              </div>
              <div className="text-[10px] text-slate-400 md:text-slate-500 mt-1">
                {course.enrollments} enrolled
              </div>
            </div>
          </div>
          {course.description && (
            <p className="text-sm text-slate-300 md:text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-6">
              {course.description}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-[10px] border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700 text-sm hover:bg-white/5 md:bg-slate-50 md:hover:bg-slate-100"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="px-3 py-2 rounded-[10px] bg-white text-black font-bold text-sm inline-flex items-center justify-center gap-1"
            >
              <Pencil className="w-4 h-4" /> Edit course
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditBlockedModal({
  course,
  onClose,
}: {
  course: DashboardPublishedCourse;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#141418] md:bg-white md:shadow-sm border border-amber-500/40 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-white md:text-slate-900 font-black text-lg">Editing locked</h3>
            <p className="text-sm text-slate-300 md:text-slate-600 mt-2">
              <span className="text-white md:text-slate-900 font-semibold">
                {course.enrollments} student{course.enrollments === 1 ? " is" : "s are"}
              </span>{" "}
              currently studying <span className="text-white font-semibold">{course.title}</span>.
              To protect their progress, you can't make changes while enrollments are active.
            </p>
            <p className="text-xs text-slate-500 mt-3">
              Tip: publish an updated edition as a new course, or wait until active students
              complete their modules.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] bg-white text-black font-bold text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtHomeAmt(n: number, currency: string): string {
  return formatMoney(Number.isFinite(n) ? n : 0, currency);
}

function WalletPane({
  data,
  page,
  onPage,
}: {
  data: DashboardWalletSummary | null;
  page: number;
  onPage: (p: number) => void;
}) {
  if (!data) return <WalletSkeleton />;
  const home = data.homeCurrency;
  const totalPages = Math.max(1, Math.ceil(data.recentTotal / data.pageSize));
  return (
    <div className="space-y-5">
      {/* Main balance card */}
      <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-5">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          Wallet balance ({home})
        </div>
        <div className="mt-2 text-3xl md:text-4xl font-black text-white md:text-slate-900">
          {fmtHomeAmt(data.mainBalance, home)}
        </div>
        <div className="text-xs text-slate-400 md:text-slate-500 mt-1">
          {home === "USD" ? (
            "USD account"
          ) : (
            <>≈ {fmtHomeAmt(data.mainBalanceUSD, "USD")} USD equivalent</>
          )}
        </div>
      </div>

      {/* Cashback & Escrow grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Cashback earned
          </div>
          <div className="mt-1.5 text-xl font-black text-white md:text-slate-900">
            {fmtHomeAmt(data.cashback, home)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Escrow balance
          </div>
          <div className="mt-1.5 text-xl font-black text-white md:text-slate-900">
            {fmtHomeAmt(data.escrow, home)}
          </div>
        </div>
      </div>

      {data.pendingPayouts.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
            Pending payouts
          </div>
          <div className="space-y-2">
            {data.pendingPayouts.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-50 p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-white md:text-slate-900 font-semibold">
                    {p.currency} {p.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400 md:text-slate-500 mt-0.5">
                    {p.method.toUpperCase()} · Requested{" "}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase text-slate-300 md:text-slate-600">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Recent transactions
          </div>
          {data.recentTotal > 0 && (
            <div className="text-[11px] text-slate-500">
              Page {page} of {totalPages}
            </div>
          )}
        </div>
        {data.recent.length === 0 ? (
          <EmptyState
            icon={WalletIcon}
            title="No transactions yet"
            hint="Sales, purchases and payouts will show here."
          />
        ) : (
          <>
            <div className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm overflow-hidden divide-y divide-white/5">
              {data.recent.map((r) => (
                <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[10px] bg-white/5 md:bg-slate-50 flex items-center justify-center text-white md:text-slate-900">
                      {r.inflow ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white md:text-slate-900 font-semibold text-sm truncate">
                        {r.type}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(r.occurredAt).toLocaleString()} · {r.status}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-sm text-white md:text-slate-900">
                      {r.inflow ? "+" : "-"}
                      {fmtHomeAmt(r.amountHome, home)}
                    </div>
                    {r.currency !== home && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {r.currency} {r.amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onPage(page - 1)}
                  className="px-3 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 text-white md:text-slate-900 text-sm disabled:opacity-40 hover:border-white/30 md:border-slate-300"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPage(page + 1)}
                  className="px-3 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 text-white md:text-slate-900 text-sm disabled:opacity-40 hover:border-white/30 md:border-slate-300"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SocialPane({ data }: { data: DashboardSocial | null }) {
  const [sub, setSub] = useState<"followers" | "following" | "circles" | "memories">("followers");
  if (!data) return <SocialSkeleton />;
  const rows = sub === "followers" ? data.followers : sub === "following" ? data.following : [];
  return (
    <div>
      <div className="-mx-1 mb-4 overflow-x-auto no-scrollbar">
        <div className="inline-flex min-w-max rounded-[10px] bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 p-1 gap-1 mx-1">
          <TabButton active={sub === "followers"} onClick={() => setSub("followers")}>
            Followers ({data.followers.length})
          </TabButton>
          <TabButton active={sub === "following"} onClick={() => setSub("following")}>
            Following ({data.following.length})
          </TabButton>
          <TabButton active={sub === "circles"} onClick={() => setSub("circles")}>
            Circles ({data.circles.length})
          </TabButton>
          <TabButton active={sub === "memories"} onClick={() => setSub("memories")}>
            Memories
          </TabButton>
        </div>
      </div>
      {sub === "memories" && <MyMemoriesGallery />}
      {(sub === "followers" || sub === "following") &&
        (rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={sub === "followers" ? "No followers yet" : "Not following anyone yet"}
            hint="Discover peers from the community and connect."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {rows.map((u) => (
              <Link
                key={u.userId + u.at}
                to="/profile/$id"
                params={{ id: u.slug }}
                className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 flex items-center gap-3 hover:border-white/20 md:border-slate-300 transition min-w-0"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/15 md:border-slate-200">
                  <AvatarImage src={u.avatarUrl} alt={u.name} />
                </div>
                <div className="min-w-0">
                  <div className="text-white md:text-slate-900 font-semibold text-sm truncate">
                    {u.name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">@{u.slug}</div>
                </div>
              </Link>
            ))}
          </div>
        ))}
      {sub === "circles" &&
        (data.circles.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No circles yet"
            hint="Join or create a circle to collaborate with peers."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.circles.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-[10px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 flex items-center justify-center text-lg">
                    {c.emoji ?? "◎"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white md:text-slate-900 font-semibold text-sm truncate">
                      {c.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Joined {new Date(c.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase text-slate-300 md:text-slate-600">
                  {c.role}
                </span>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function MyMemoriesGallery() {
  return (
    <div className="space-y-5">
      <PhotoBatchManager />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white md:text-slate-900">Shared photos</h3>
        <SharedPhotosGrid />
      </div>
    </div>
  );
}

function SharedPhotosGrid() {
  const fetchPhotos = useServerFn(listUserPhotos);
  const [photos, setPhotos] = useState<UserPhoto[] | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetchPhotos({ data: {} });
        if (!cancel) setPhotos(r.photos);
      } catch {
        if (!cancel) setPhotos([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fetchPhotos]);

  if (photos === null) {
    return <PhotoGridSkeleton count={12} />;
  }
  if (photos.length === 0) {
    return (
      <EmptyState
        icon={Images}
        title="No memories yet"
        hint="Your uploaded photos will appear here as you share."
      />
    );
  }
  return <PhotoBatches photos={photos} dense />;
}
