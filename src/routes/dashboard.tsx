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
  Wallet as WalletIcon,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  
  Plus,
  TrendingUp,
  Activity as ActivityIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyPurchases,
  listMyProducts,
  getOrderWithDownload,
  confirmOrderReceived,
  type PurchaseDTO,
  type ProductDTO,
} from "@/lib/marketplace.functions";
import {
  getDashboardOverview,
  getMyWalletSummary,
  getMySocial,
  type DashboardOverview,
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
  PhotoGridSkeleton,
} from "@/components/oventric/skeletons";
import { formatMoney } from "@/lib/fx-display";
import { PurchaseAssistantPanel } from "@/components/oventric/PurchaseAssistantPanel";
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
          "Manage your Oventric purchases, digital listings, sales, wallet, and social activity.",
      },
      { property: "og:title", content: "My Dashboard — Oventric" },
      {
        property: "og:description",
        content: "Manage your Oventric purchases, digital listings, sales, wallet, and social activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const isAppShell = useIsAppShell();
  const navigate = useNavigate();
  const { tab: tabParam } = Route.useSearch();
  const purchasesFn = useServerFn(listMyPurchases);
  const listingsFn = useServerFn(listMyProducts);
  const orderFn = useServerFn(getOrderWithDownload);
  const confirmFn = useServerFn(confirmOrderReceived);
  const overviewFn = useServerFn(getDashboardOverview);
  const walletFn = useServerFn(getMyWalletSummary);
  const socialFn = useServerFn(getMySocial);

  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>(tabParam ?? "overview");
  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [purchases, setPurchases] = useState<PurchaseDTO[] | null>(null);
  const [listings, setListings] = useState<ProductDTO[] | null>(null);
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
    if (tab === "wallet" && walletSummary === null) void loadWallet();
    if (tab === "social" && social === null) void loadSocial();
  }, [
    authChecked,
    tab,
    overview,
    purchases,
    sales,
    listings,
    walletSummary,
    social,
    loadOverview,
    loadPurchases,
    loadSales,
    loadListings,
    loadWallet,
    loadSocial,
  ]);

  // Realtime: keep orders, listings and wallet in sync
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel("dashboard-contacts")
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
    loadPurchases,
    loadSales,
    loadListings,
    loadOverview,
    loadWallet,
    walletSummary,
  ]);

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

  const stats = useMemo(
    () => ({
      digital: purchases?.filter((p) => p.status === "paid").length ?? 0,
      pending: purchases?.filter((p) => p.status === "pending").length ?? 0,
      listings: listings?.length ?? 0,
      listingsPending: listings?.filter((l) => l.status === "pending").length ?? 0,
      listingsActive: listings?.filter((l) => l.status === "active").length ?? 0,
      listingsRejected: listings?.filter((l) => l.status === "rejected").length ?? 0,
    }),
    [purchases, listings],
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="web-dashboard min-h-screen bg-background text-foreground">
      <Header 
        onOpenMessages={() => {}} 
        browserVisitorHeader={!isAppShell} 
        forceSiteNavbar={!isAppShell}
      />
      <div
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingTop: "max(2rem, calc(env(safe-area-inset-top) + 1rem))",
          paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1rem))",
        }}
      >
        <header className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back home
            </button>
            <h1 className="font-wallet-display text-3xl font-bold text-foreground">My Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Overview of your digital commerce and social activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setTab("listings")} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90">
              <Plus className="h-4 w-4" /> New listing
            </button>
          </div>
        </header>

        <nav className="dashboard-tabs mb-8 flex items-center gap-6 overflow-x-auto border-b border-border" aria-label="Dashboard sections">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            <LayoutDashboard className="w-5 h-5 shrink-0" />{" "}
            <span className="truncate">Overview</span>
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
        </nav>


        {tab === "overview" && <OverviewPane overview={overview} onGoto={setTab} />}
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
          <div className="space-y-4">
            <PurchaseAssistantPanel />
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
          </div>
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
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 px-1 text-sm font-semibold transition ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
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
    <div className="rounded-[10px] border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-bold text-foreground">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>
      {cta ? <div className="mt-5 flex justify-center">{cta}</div> : null}
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

  const kindFiltered = rows;
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
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

function OverviewMetric({
  icon: Icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-module group flex min-h-40 flex-col justify-between rounded-[10px] border border-border bg-card p-5 text-left transition hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground transition group-hover:text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div>
        <div className="font-wallet-display text-2xl font-bold text-foreground">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </button>
  );
}

function OverviewPane({
  overview,
  onGoto,
}: {
  overview: DashboardOverview | null;
  onGoto: (t: Tab) => void;
}) {
  if (!overview) return <OverviewSkeleton />;

  const wallet = overview.wallet;
  const homeCurrency = overview.homeCurrency;
  const walletAvailable = wallet ? formatHomeCurrency(wallet.available, homeCurrency) : "—";
  const walletEscrow = wallet
    ? `${formatHomeCurrency(wallet.escrow, homeCurrency)} held in escrow`
    : "Wallet is not initialized";
  const orderCount = overview.orders.placed + overview.orders.toFulfil;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Account overview">
        <button
          type="button"
          onClick={() => onGoto("wallet")}
          className="dashboard-module flex min-h-52 flex-col justify-between rounded-[10px] border border-border bg-card p-6 text-left transition hover:border-primary/30 hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase text-muted-foreground">Available balance</span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <WalletIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div>
            <div className="font-wallet-display text-3xl font-bold text-foreground sm:text-4xl">
              {walletAvailable}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{walletEscrow}</p>
          </div>
        </button>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
          <OverviewMetric
            icon={ShoppingBag}
            label="Orders"
            value={orderCount}
            detail={`${overview.orders.awaitingBuyer} awaiting confirmation · ${overview.orders.toFulfil} to fulfil`}
            onClick={() => onGoto(overview.orders.toFulfil > 0 ? "sales" : "digital")}
          />
          <OverviewMetric
            icon={TrendingUp}
            label="Released revenue"
            value={formatHomeCurrency(overview.revenue.gross, homeCurrency)}
            detail={`${formatHomeCurrency(overview.revenue.last30, homeCurrency)} in the last 30 days`}
            onClick={() => onGoto("wallet")}
          />
          <OverviewMetric
            icon={Store}
            label="Digital listings"
            value={overview.listings.total}
            detail={`${overview.listings.active} live · ${overview.listings.pending} pending`}
            onClick={() => onGoto("listings")}
          />
          <OverviewMetric
            icon={Users}
            label="Network"
            value={overview.social.followers}
            detail={`${overview.social.following} following · ${overview.unread.messages} unread messages`}
            onClick={() => onGoto("social")}
          />
        </div>
      </section>

      <QuickActions />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-6">
          <AnalyticsCharts />
          <AnalyticsWidget />
        </div>
        <NotificationsPanel />
      </section>
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
