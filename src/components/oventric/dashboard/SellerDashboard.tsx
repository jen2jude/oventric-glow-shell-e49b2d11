import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Store, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings, 
  ChevronRight,
  TrendingUp,
  Eye,
  MessageCircle,
  Heart,
} from "lucide-react";
import { getSellerMetrics } from "@/lib/dashboard/seller.functions";
import { computeDisplayPrice, formatMoney } from "@/lib/fx-display";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { AnalyticsWidget } from "./AnalyticsWidget";
import { ProductManagement } from "./ProductManagement";
import { ShopManagement } from "./ShopManagement";
import { OrderManagement } from "./OrderManagement";
import { EarningsPane } from "./EarningsPane";

type SellerTab = "overview" | "products" | "orders" | "shop" | "earnings";

export function SellerDashboard() {
  const [activeTab, setActiveTab] = useState<SellerTab>("overview");
  const fetchMetrics = useServerFn(getSellerMetrics);
  const { baseCurrency } = useOnboarding();
  const currency = (baseCurrency ?? "USD") as Currency;

  const { data: metrics } = useSuspenseQuery({
    queryKey: ["seller-metrics"],
    queryFn: () => fetchMetrics({}),
  });

  const revenueDisplay = computeDisplayPrice(
    { original_currency: "USD", original_amount: metrics.totalRevenueUSD },
    currency,
  ).formatted;

  const usdPreview =
    currency === "USD" ? null : formatMoney(metrics.totalRevenueUSD, "USD");

  const TABS = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "products", label: "Products", icon: Package },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "earnings", label: "Earnings", icon: TrendingUp },
    { id: "shop", label: "Shop", icon: Store },
  ] as const;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-full border border-border bg-card p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SellerTab)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === "overview" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-[14px] bg-gradient-to-br from-emerald-500 to-sky-500 p-4 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90"><TrendingUp className="h-4 w-4" /> Seller Hub</div>
              <div className="mt-2">
                <div className="text-3xl font-bold">{revenueDisplay}</div>
                <div className="text-xs opacity-85">Revenue{usdPreview ? ` · ≈ ${usdPreview}` : ""}</div>
              </div>
              <div className="mt-3 flex items-end gap-6">
                <div><div className="text-xl font-bold">{metrics.totalSales}</div><div className="text-xs opacity-85">Sales</div></div>
                <div><div className="text-xl font-bold">{metrics.conversionRate}%</div><div className="text-xs opacity-85">Conversion</div></div>
                <div><div className="text-xl font-bold">{metrics.totalFollowers}</div><div className="text-xs opacity-85">Followers</div></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Mini icon={Store} label="Shop visits" value={metrics.shopVisits} />
              <Mini icon={Eye} label="Product views" value={metrics.totalViews} />
              <Mini icon={MessageCircle} label="Conversations" value={metrics.conversations} />
              <Mini icon={Heart} label="Engagement" value={`${metrics.engagementRate}%`} />
              <Mini icon={ShoppingCart} label="Orders" value={metrics.totalOrders} />
              <Mini icon={Package} label="Products" value={metrics.totalProducts} />
            </div>

            <HubCard title="Performance" hint="Sales and traffic over time" icon={BarChart3}>
              <AnalyticsWidget />
            </HubCard>

            <HubCard title="Manage" hint="Jump into your orders, products and shop" icon={Settings}>
              <div className="divide-y divide-border">
                <Row label="Orders" meta={`${metrics.totalOrders} total`} onClick={() => setActiveTab("orders")} />
                <Row label="Products" meta={`${metrics.totalProducts} listed`} onClick={() => setActiveTab("products")} />
                <Row label="Earnings" meta="Payouts & history" onClick={() => setActiveTab("earnings")} />
                <Row label="Shop settings" meta="Branding & details" onClick={() => setActiveTab("shop")} />
              </div>
            </HubCard>
          </div>
        )}

        {activeTab === "products" && <ProductManagement />}
        {activeTab === "orders" && <OrderManagement />}
        {activeTab === "earnings" && <EarningsPane />}
        {activeTab === "shop" && <ShopManagement />}
      </div>
    </div>
  );
}

function HubCard({ title, hint, icon: Icon, children }: { title: string; hint?: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-500" /><h3 className="text-sm font-semibold">{title}</h3></div>
      {hint && <p className="-mt-2 mb-3 text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}
function Mini({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3">
      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span><Icon className="h-3.5 w-3.5 text-emerald-500" /></div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
function Row({ label, meta, onClick }: { label: string; meta: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-[11px] text-muted-foreground">{meta}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
