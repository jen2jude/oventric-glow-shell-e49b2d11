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
  Users,
  Eye,
  Plus
} from "lucide-react";
import { getSellerMetrics } from "@/lib/dashboard/seller.functions";
import { AnalyticsWidget } from "./AnalyticsWidget";
import { ProductManagement } from "./ProductManagement";
import { ShopManagement } from "./ShopManagement";
import { OrderManagement } from "./OrderManagement";
import { EarningsPane } from "./EarningsPane";

type SellerTab = "overview" | "products" | "orders" | "shop" | "earnings";

export function SellerDashboard() {
  const [activeTab, setActiveTab] = useState<SellerTab>("overview");
  const fetchMetrics = useServerFn(getSellerMetrics);
  
  const { data: metrics } = useSuspenseQuery({
    queryKey: ["seller-metrics"],
    queryFn: () => fetchMetrics({}),
  });

  const TABS = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "products", label: "Products", icon: Package },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "earnings", label: "Earnings", icon: TrendingUp },
    { id: "shop", label: "Shop", icon: Store },
  ] as const;

  return (
    <div className="space-y-6 pb-24">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SellerTab)}
            className={`
              flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all
              ${activeTab === tab.id 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Top Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard 
                label="Sales" 
                value={metrics.totalSales} 
                icon={TrendingUp} 
                color="text-primary"
              />
              <MetricCard 
                label="Revenue" 
                value={`$${metrics.totalRevenueUSD.toLocaleString()}`} 
                icon={TrendingUp} 
                color="text-primary"
              />
              <MetricCard 
                label="Followers" 
                value={metrics.totalFollowers} 
                icon={Users} 
                color="text-primary"
              />
              <MetricCard 
                label="Views" 
                value={metrics.totalViews} 
                icon={Eye} 
                color="text-primary"
              />
            </div>

            {/* Engagement Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MiniMetric label="Shop Visits" value={metrics.shopVisits} />
              <MiniMetric label="Conversion" value={`${metrics.conversionRate}%`} />
              <MiniMetric label="Engagement" value={`${metrics.engagementRate}%`} />
            </div>

            <AnalyticsWidget />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <QuickManagementCard 
                title="Recent Orders" 
                count={metrics.totalOrders}
                actionLabel="View all orders"
                onClick={() => setActiveTab("orders")}
              />
              <QuickManagementCard 
                title="Active Products" 
                count={metrics.totalProducts}
                actionLabel="Manage products"
                onClick={() => setActiveTab("products")}
              />
            </div>
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

function MetricCard({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-black text-foreground">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-[10px] border border-border bg-muted px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

function QuickManagementCard({ title, count, actionLabel, onClick }: { title: string, count: number, actionLabel: string, onClick: () => void }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">
          {count} Total
        </span>
      </div>
      <button 
        onClick={onClick}
        className="group flex w-full items-center justify-between rounded-[10px] border border-border bg-muted p-3 transition hover:bg-card"
      >
        <span className="text-sm font-medium text-foreground">{actionLabel}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </button>
    </div>
  );
}
