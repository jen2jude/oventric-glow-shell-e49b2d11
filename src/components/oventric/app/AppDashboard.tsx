import { Sparkles as SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Package,
  Download,
  ExternalLink,
  ShoppingBag,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Store,
  Pencil,
  Eye,
  Wallet as WalletIcon,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  TrendingUp,
  Truck,
  Images,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
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
import { listMySales, type SaleDTO } from "@/lib/fulfilment.functions";
import { listUserPhotos, type UserPhoto } from "@/lib/posts.functions";
import { formatMoney } from "@/lib/fx-display";
import { computeDisplayPrice } from "@/lib/fx-display";
import { visibleMoney, usdEquivalent } from "@/lib/money-visibility";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { haptic } from "@/lib/haptics";
import { EditListingModal } from "@/components/oventric/EditListingModal";
import { SellSwitcherModal } from "@/components/oventric/SellSwitcherModal";
import { PurchaseAssistantPanel } from "@/components/oventric/PurchaseAssistantPanel";
import { OrderFulfilmentRoadmap } from "@/components/oventric/OrderFulfilmentRoadmap";
import { SalesFulfilmentList } from "@/components/oventric/SalesFulfilmentList";
import { QuickActions } from "@/components/oventric/dashboard/QuickActions";
import { AnalyticsCharts } from "@/components/oventric/dashboard/AnalyticsCharts";
import { AnalyticsWidget } from "@/components/oventric/dashboard/AnalyticsWidget";
import { NotificationsPanel } from "@/components/oventric/dashboard/NotificationsPanel";
import { PhotoBatches } from "@/components/oventric/PhotoBatches";
import { PhotoBatchManager } from "@/components/oventric/PhotoBatchManager";
import { AvatarImage } from "@/components/oventric/AvatarImage";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "wallet", label: "Wallet", icon: WalletIcon },
  { key: "digital", label: "Purchases", icon: Package },
  { key: "sales", label: "Sales", icon: Truck },
  { key: "listings", label: "Listings", icon: Store },
  { key: "social", label: "Social", icon: Users },
] as const;
type Tab = (typeof TABS)[number]["key"];

const fmt = (n: number, c: string) => formatMoney(Number.isFinite(n) ? n : 0, c);

export function AppDashboard({ initialTab }: { initialTab?: string }) {
  const navigate = useNavigate();
  const purchasesFn = useServerFn(listMyPurchases);
  const listingsFn = useServerFn(listMyProducts);
  const orderFn = useServerFn(getOrderWithDownload);
  const confirmFn = useServerFn(confirmOrderReceived);
  const overviewFn = useServerFn(getDashboardOverview);
  const walletFn = useServerFn(getMyWalletSummary);
  const socialFn = useServerFn(getMySocial);
  const salesFn = useServerFn(listMySales);

  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>(
    (TABS.find((t) => t.key === initialTab)?.key ?? "overview") as Tab,
  );
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [purchases, setPurchases] = useState<PurchaseDTO[] | null>(null);
  const [listings, setListings] = useState<ProductDTO[] | null>(null);
  const [walletSummary, setWalletSummary] = useState<DashboardWalletSummary | null>(null);
  const [walletPage, setWalletPage] = useState(1);
  const [social, setSocial] = useState<DashboardSocial | null>(null);
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleDTO[] | null>(null);

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
  }, [authChecked, tab, overview, purchases, sales, listings, walletSummary, social, loadOverview, loadPurchases, loadSales, loadListings, loadWallet, loadSocial]);

  // Realtime sync
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel("app-dashboard-sync")
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions" }, () => {
        void loadOverview();
        if (walletSummary !== null) void loadWallet();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authChecked, loadPurchases, loadSales, loadListings, loadOverview, loadWallet, walletSummary]);

  const handleDownload = async (orderId: string, productId: string, externalUrl: string | null, hasFile: boolean) => {
    setDownloadingId(orderId);
    try {
      const res = await orderFn({ data: { orderId } });
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      } else if (externalUrl) {
        window.open(externalUrl, "_blank", "noopener,noreferrer");
      } else if (!hasFile) {
        toast.info("No file attached", { description: "Open the product page for details." });
        navigate({ to: "/product/$id", params: { id: productId } });
      } else {
        toast.error("Download link unavailable", { description: "Order may still be processing." });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const pendingDeliveryCount = useMemo(
    () => sales?.filter((s) => s.escrowStatus === "held" && s.requiresManualDelivery && !s.deliveredAt).length ?? 0,
    [sales],
  );
  const rejectedCount = useMemo(
    () => listings?.filter((l) => l.status === "rejected").length ?? 0,
    [listings],
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#070A08] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-y-auto overscroll-contain bg-[#070A08] text-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
      {/* Sticky header */}
      <header className="app-scroll-header sticky top-0 z-40 bg-[#070A08] border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            aria-label="Back"
            onClick={() => {
              haptic();
              navigate({ to: "/" });
            }}
            className="grid size-9 place-items-center rounded-full bg-white/5 border border-white/10"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black truncate">My Dashboard</h1>
            <p className="text-[11px] text-white/40 truncate">Your commerce at a glance</p>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic();
              setTab("listings");
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#E5484D] px-3.5 py-2 text-xs font-bold"
          >
            <Plus className="size-3.5" /> New listing
          </button>
        </div>
        {/* Tab bar */}
        <nav className="flex gap-1 overflow-x-auto no-scrollbar px-3 pb-2" aria-label="Dashboard sections">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            const badge =
              t.key === "sales" ? pendingDeliveryCount : t.key === "listings" ? rejectedCount : 0;
            return (
              <button
                key={t.key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  haptic();
                  setTab(t.key);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold border transition ${
                  active
                    ? "bg-white text-black border-white"
                    : "bg-white/5 text-white/60 border-white/10"
                }`}
              >
                <Icon className="size-3.5" />
                {t.label}
                {badge > 0 && (
                  <span
                    className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      t.key === "sales" ? "bg-amber-400 text-black" : "bg-[#E5484D] text-white"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="px-4 pt-4">
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
          <SalesPane
            rows={sales}
            onChanged={() => {
              void loadSales();
              void loadOverview();
            }}
          />
        )}
        {tab === "listings" && (
          <ListingsList rows={listings} onEdit={(p) => setEditing(p)} />
        )}
        {tab === "social" && <SocialPane data={social} />}
      </main>

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

/* ------------------------------ shared bits ------------------------------ */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#101312] ${className}`}>{children}</div>
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
    <div className="rounded-2xl border border-dashed border-white/15 bg-[#101312] px-6 py-12 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/5 text-white/50">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-bold text-white">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-white/50">{hint}</p>
      {cta ? <div className="mt-5 flex justify-center">{cta}</div> : null}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-white/40" />
    </div>
  );
}

/* ------------------------------ Overview ------------------------------ */

function OverviewPane({ overview, onGoto }: { overview: DashboardOverview | null; onGoto: (t: Tab) => void }) {
  const { balancesHidden } = useOnboarding();
  if (!overview) return <Spinner />;
  const wallet = overview.wallet;
  const home = overview.homeCurrency;
  const orderCount = overview.orders.placed + overview.orders.toFulfil;

  const metrics: { icon: typeof Package; label: string; value: string | number; detail: string; go: Tab }[] = [
    {
      icon: ShoppingBag,
      label: "Orders",
      value: orderCount,
      detail: `${overview.orders.awaitingBuyer} awaiting confirmation · ${overview.orders.toFulfil} to fulfil`,
      go: overview.orders.toFulfil > 0 ? "sales" : "digital",
    },
    {
      icon: TrendingUp,
      label: "Released revenue",
      value: visibleMoney(overview.revenue.gross, home, balancesHidden),
      detail: `${visibleMoney(overview.revenue.last30, home, balancesHidden)} in the last 30 days`,
      go: "wallet",
    },
    {
      icon: Store,
      label: "Listings",
      value: overview.listings.total,
      detail: `${overview.listings.active} live · ${overview.listings.pending} pending`,
      go: "listings",
    },
    {
      icon: Users,
      label: "Network",
      value: overview.social.followers,
      detail: `${overview.social.following} following · ${overview.unread.messages} unread messages`,
      go: "social",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Balance hero */}
      <button
        type="button"
        onClick={() => onGoto("wallet")}
        className="w-full text-left rounded-2xl border border-white/10 bg-gradient-to-br from-[#1A0E10] to-[#101312] p-5"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
            Available balance
          </span>
          <span className="grid size-9 place-items-center rounded-full bg-[#E5484D]/15 text-[#E5484D]">
            <WalletIcon className="size-4" />
          </span>
        </div>
        <div className="mt-3 text-3xl font-black">
          {wallet ? visibleMoney(wallet.available, home, balancesHidden) : "—"}
        </div>
        {wallet && usdEquivalent(wallet.available, home, balancesHidden) && <p className="text-xs text-white/40">{usdEquivalent(wallet.available, home, balancesHidden)}</p>}
        <p className="mt-1 text-xs text-white/50">
          {wallet ? `${visibleMoney(wallet.escrow, home, balancesHidden)} held in escrow` : "Wallet is not initialized"}
        </p>
      </button>

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.label}
              type="button"
              onClick={() => onGoto(m.go)}
              className="rounded-2xl border border-white/10 bg-[#101312] p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                  {m.label}
                </span>
                <Icon className="size-4 text-white/40" />
              </div>
              <div className="mt-2 text-xl font-black truncate">{m.value}</div>
              {m.label === "Released revenue" && <span className="text-[10px] text-white/40">{usdEquivalent(overview.revenue.gross, home, balancesHidden)}</span>}
              <p className="mt-0.5 text-[11px] text-white/40 line-clamp-2">{m.detail}</p>
            </button>
          );
        })}
      </div>

      <QuickActions />

      <div className="space-y-5">
        <AnalyticsCharts />
        <AnalyticsWidget />
        <NotificationsPanel />
      </div>
    </div>
  );
}

/* ------------------------------ Wallet ------------------------------ */

function WalletPane({
  data,
  page,
  onPage,
}: {
  data: DashboardWalletSummary | null;
  page: number;
  onPage: (p: number) => void;
}) {
  const { balancesHidden } = useOnboarding();
  if (!data) return <Spinner />;
  const home = data.homeCurrency;
  const totalPages = Math.max(1, Math.ceil(data.recentTotal / data.pageSize));
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
          Wallet balance ({home})
        </div>
        <div className="mt-2 text-3xl font-black">{visibleMoney(data.mainBalance, home, balancesHidden)}</div>
        <div className="text-xs text-white/40 mt-1">
          {home === "USD" ? "USD account" : balancesHidden ? "••••" : <>≈ {fmt(data.mainBalanceUSD, "USD")} USD equivalent</>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Cashback earned</div>
          <div className="mt-1.5 text-xl font-black">{visibleMoney(data.cashback, home, balancesHidden)}</div>
          <div className="text-[10px] text-white/40">{usdEquivalent(data.cashback, home, balancesHidden)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Escrow balance</div>
          <div className="mt-1.5 text-xl font-black">{visibleMoney(data.escrow, home, balancesHidden)}</div>
          <div className="text-[10px] text-white/40">{usdEquivalent(data.escrow, home, balancesHidden)}</div>
        </Card>
      </div>

      {data.pendingPayouts.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">
            Pending payouts
          </div>
          <div className="space-y-2">
            {data.pendingPayouts.map((p) => (
              <Card key={p.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {visibleMoney(p.amount, p.currency, balancesHidden)}
                  </div>
                  <div className="text-[10px] text-white/40">{usdEquivalent(p.amount, p.currency, balancesHidden)}</div>
                  <div className="text-xs text-white/40 mt-0.5">
                    {p.method.toUpperCase()} · Requested {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase text-white/50">{p.status}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
            Recent transactions
          </div>
          {data.recentTotal > 0 && (
            <div className="text-[11px] text-white/40">
              Page {page} of {totalPages}
            </div>
          )}
        </div>
        {data.recent.length === 0 ? (
          <EmptyState icon={WalletIcon} title="No transactions yet" hint="Sales, purchases and payouts will show here." />
        ) : (
          <>
            <Card className="overflow-hidden divide-y divide-white/5">
              {data.recent.map((r) => (
                <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${
                        r.inflow ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-white/70"
                      }`}
                    >
                      {r.inflow ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{r.type}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">
                        {new Date(r.occurredAt).toLocaleString()} · {r.statusLabel ?? r.status}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-black text-sm ${r.inflow ? "text-emerald-400" : ""}`}>
                      {r.inflow ? "+" : "-"}
                      {visibleMoney(r.amountHome, home, balancesHidden)}
                    </div>
                    <div className="text-[10px] text-white/40">{usdEquivalent(r.amountHome, home, balancesHidden)}</div>
                    {r.currency !== home && (
                      <div className="text-[10px] text-white/40 mt-0.5">
                        {visibleMoney(r.amount, r.currency, balancesHidden)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Card>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onPage(page - 1)}
                  className="px-3 py-1.5 rounded-full border border-white/15 text-sm disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPage(page + 1)}
                  className="px-3 py-1.5 rounded-full border border-white/15 text-sm disabled:opacity-40"
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

/* ------------------------------ Purchases ------------------------------ */

function StatusBadge({ status }: { status: PurchaseDTO["status"] }) {
  const meta = {
    paid: { label: "Paid", icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
    pending: { label: "Pending", icon: Clock, tone: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
    failed: { label: "Failed", icon: AlertTriangle, tone: "bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/25" },
    refunded: { label: "Refunded", icon: AlertTriangle, tone: "bg-sky-500/15 text-sky-400 border-sky-500/25" },
  }[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.tone}`}>
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
  onDownload: (orderId: string, productId: string, externalUrl: string | null, hasFile: boolean) => void;
  onConfirm: (orderId: string) => void;
}) {
  const [tracking, setTracking] = useState<string | null>(null);
  if (rows === null) return <Spinner />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No digital purchases yet"
        hint="Your purchased digital products will appear here so you can re-download them anytime."
        cta={
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-bold">
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
          <Card className="flex gap-3 p-3">
            <Link
              to="/order/$id"
              params={{ id: r.orderId }}
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5"
            >
              {r.coverUrl ? (
                <img src={r.coverUrl} alt={r.productName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag className="h-6 w-6 text-white/30" />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 truncate">{r.category}</div>
                  <Link to="/order/$id" params={{ id: r.orderId }} className="block truncate text-sm font-bold">
                    {r.productName}
                  </Link>
                  <div className="text-xs text-white/40 truncate">by {r.vendor}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-white/40">
                  {r.displayCurrency} {r.displayTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ·{" "}
                  {new Date(r.paidAt ?? r.createdAt).toLocaleDateString()}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.status === "paid" && (r.hasFile || r.externalUrl) && (
                    <button
                      onClick={() => onDownload(r.orderId, r.productId, r.externalUrl, r.hasFile)}
                      disabled={downloadingId === r.orderId}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#E5484D] px-3 py-1.5 text-xs font-bold disabled:opacity-60"
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400"
                    >
                      Confirm received
                    </button>
                  )}
                  <Link
                    to="/order/$id"
                    params={{ id: r.orderId }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold"
                  >
                    Details
                  </Link>
                  <button
                    onClick={() => setTracking((t) => (t === r.orderId ? null : r.orderId))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold"
                  >
                    <Truck className="w-3.5 h-3.5" /> {tracking === r.orderId ? "Hide" : "Track"}
                  </button>
                </div>
              </div>
            </div>
          </Card>
          {tracking === r.orderId && <OrderFulfilmentRoadmap orderId={r.orderId} />}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Sales ------------------------------ */

function SalesPane({ rows, onChanged }: { rows: SaleDTO[] | null; onChanged: () => void }) {
  if (rows === null) return <Spinner />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No sales yet"
        hint="Orders placed on your listings appear here. Deliver in the buyer's Oventric chat — escrow only protects trades completed in-app."
        cta={
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-bold">
            Go to Marketplace
          </Link>
        }
      />
    );
  }
  return <SalesFulfilmentList rows={rows} onChanged={onChanged} />;
}

/* ------------------------------ Listings ------------------------------ */

function ListingStatusBadge({ status }: { status: ProductDTO["status"] }) {
  const meta = {
    pending: { label: "Pending review", icon: Clock, tone: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
    active: { label: "Live", icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
    rejected: { label: "Rejected", icon: AlertTriangle, tone: "bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/25" },
  }[status] ?? { label: status, icon: AlertTriangle, tone: "bg-white/5 text-white/60 border-white/10" };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.tone}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function ListingsList({ rows, onEdit }: { rows: ProductDTO[] | null; onEdit: (p: ProductDTO) => void }) {
  const { homeCurrency, balancesHidden } = useOnboarding();
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "rejected">("all");
  const [sellOpen, setSellOpen] = useState(false);

  if (rows === null) return <Spinner />;

  const startSelling = (
    <button
      type="button"
      onClick={() => setSellOpen(true)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E5484D] text-sm font-bold"
    >
      <Plus className="w-4 h-4" /> Start selling
    </button>
  );

  if (rows.length === 0) {
    return (
      <>
        <EmptyState
          icon={Store}
          title="You haven't published any listings yet"
          hint="Start selling digital assets, or browse the marketplace to see what's live."
          cta={<div className="flex flex-wrap items-center justify-center gap-2">{startSelling}</div>}
        />
        <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      </>
    );
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const chips: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "pending", label: "Pending", count: rows.filter((r) => r.status === "pending").length },
    { key: "active", label: "Live", count: rows.filter((r) => r.status === "active").length },
    { key: "rejected", label: "Rejected", count: rows.filter((r) => r.status === "rejected").length },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              filter === c.key ? "bg-white border-white text-black" : "bg-white/5 border-white/10 text-white/60"
            }`}
          >
            {c.label}
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                filter === c.key ? "bg-black/15 text-black" : "bg-white/10 text-white/70"
              }`}
            >
              {c.count}
            </span>
          </button>
        ))}
        <div className="ml-auto shrink-0">{startSelling}</div>
      </div>
      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#101312] p-8 text-center text-sm text-white/40">
          No listings in this bucket.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id} className="p-3 flex gap-3">
              <Link
                to="/product/$id"
                params={{ id: p.id }}
                className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center"
              >
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-6 h-6 text-white/30" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 truncate">
                      Digital · {p.category}
                    </div>
                    <Link to="/product/$id" params={{ id: p.id }} className="text-sm font-bold truncate block">
                      {p.name}
                    </Link>
                    <div className="text-xs text-white/40">
                      {visibleMoney(computeDisplayPrice({ original_currency: "USD", original_amount: p.priceUSD }, homeCurrency).value, homeCurrency, balancesHidden)}
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
                  <div className="mt-2 rounded-xl border border-[#E5484D]/25 bg-[#E5484D]/10 p-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#E5484D] mb-0.5">
                      Moderator note
                    </div>
                    <div className="text-xs text-white/70 whitespace-pre-wrap break-words line-clamp-4">
                      {p.rejectReason}
                    </div>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(p.status === "rejected" || p.status === "pending") && (
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-bold"
                    >
                      <Pencil className="w-3.5 h-3.5" /> {p.status === "rejected" ? "Edit & Resubmit" : "Edit"}
                    </button>
                  )}
                  {p.status === "active" && (
                    <Link
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" /> View live
                    </Link>
                  )}
                  {p.status === "pending" && (
                    <span className="text-[11px] text-white/40">Awaiting admin approval — you can still edit.</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Social ------------------------------ */

function SocialPane({ data }: { data: DashboardSocial | null }) {
  const [sub, setSub] = useState<"followers" | "following" | "memories">("followers");
  if (!data) return <Spinner />;
  const rows = sub === "followers" ? data.followers : sub === "following" ? data.following : [];
  const subs = [
    { key: "followers", label: `Followers (${data.followers.length})` },
    { key: "following", label: `Following (${data.following.length})` },
    { key: "memories", label: "Memories" },
  ] as const;
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4">
        {subs.map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold border transition ${
              sub === s.key ? "bg-white text-black border-white" : "bg-white/5 text-white/60 border-white/10"
            }`}
          >
            {s.label}
          </button>
        ))}
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
          <div className="space-y-2">
            {rows.map((u) => (
              <Link
                key={u.userId + u.at}
                to="/profile/$id"
                params={{ id: u.slug }}
                className="rounded-2xl border border-white/10 bg-[#101312] p-3 flex items-center gap-3 min-w-0"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/15">
                  <AvatarImage src={u.avatarUrl} alt={u.name} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{u.name}</div>
                  <div className="text-[11px] text-white/40 truncate">@{u.slug}</div>
                </div>
              </Link>
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
        <h3 className="text-sm font-semibold">Shared photos</h3>
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

  if (photos === null) return <Spinner />;
  if (photos.length === 0) {
    return <EmptyState icon={Images} title="No memories yet" hint="Your uploaded photos will appear here as you share." />;
  }
  return <PhotoBatches photos={photos} dense />;
}
