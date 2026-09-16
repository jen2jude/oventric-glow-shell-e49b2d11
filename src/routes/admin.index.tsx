import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Package,
  ShoppingBag,
  DollarSign,
  Megaphone,
  Flag,
  Activity,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getAdminStats, getRecentActivity } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Overview · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminOverview,
});

interface Stats {
  users: number;
  products: number;
  orders: number;
  revenueUsd: number;
  activeCampaigns: number;
  pendingReports: number;
  transactions: number;
}

function AdminOverview() {
  const statsFn = useServerFn(getAdminStats);
  const activityFn = useServerFn(getRecentActivity);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof getRecentActivity>> | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, a] = await Promise.all([statsFn(), activityFn()]);
      setStats(s);
      setActivity(a);
      setLastUpdated(Date.now());
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [statsFn, activityFn]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (err && !stats) return <div className="p-6 text-red-300 text-sm">{err}</div>;
  if (!stats || !activity)
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );

  const kpis: Array<{
    label: string;
    value: string | number;
    icon: typeof Users;
    tint: string;
    to: string;
  }> = [
    {
      label: "Users",
      value: stats.users,
      icon: Users,
      tint: "text-blue-300 bg-blue-500/10 border-blue-500/30",
      to: "/admin/users",
    },
    {
      label: "Products",
      value: stats.products,
      icon: Package,
      tint: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
      to: "/admin/products",
    },
    {
      label: "Orders",
      value: stats.orders,
      icon: ShoppingBag,
      tint: "text-amber-300 bg-amber-500/10 border-amber-500/30",
      to: "/admin/orders",
    },
    {
      label: "Revenue (USD)",
      value: `$${stats.revenueUsd.toFixed(2)}`,
      icon: DollarSign,
      tint: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30",
      to: "/admin/system-wallets",
    },
    {
      label: "Active Campaigns",
      value: stats.activeCampaigns,
      icon: Megaphone,
      tint: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
      to: "/admin/campaigns",
    },
    {
      label: "Pending Reports",
      value: stats.pendingReports,
      icon: Flag,
      tint: "text-red-300 bg-red-500/10 border-red-500/30",
      to: "/admin/reports",
    },
    {
      label: "Wallet Txns",
      value: stats.transactions,
      icon: Activity,
      tint: "text-violet-300 bg-violet-500/10 border-violet-500/30",
      to: "/admin/payouts",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-white text-2xl font-black">Overview</h1>
          <p className="text-sm text-slate-400">
            Real-time platform stats.{" "}
            {lastUpdated > 0 && (
              <span className="text-slate-500 text-xs">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to={k.to}
            className="bg-[#141418] border border-white/10 rounded-xl p-4 hover:border-emerald-500/40 hover:bg-white/[0.03] transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                {k.label}
              </div>
              <div
                className={`w-7 h-7 rounded-[10px] border flex items-center justify-center ${k.tint}`}
              >
                <k.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-white text-2xl font-black group-hover:text-emerald-300 transition-colors">
              {k.value}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Recent orders" viewAll="/admin/orders">
          {activity.orders.length === 0 ? (
            <Empty label="No orders yet." />
          ) : (
            <ul className="divide-y divide-white/5">
              {(activity.orders as Array<Record<string, unknown>>).map((o) => (
                <li key={o.id as string}>
                  <Link
                    to="/order/$id"
                    params={{ id: o.id as string }}
                    className="py-2 flex items-center justify-between text-sm hover:bg-white/[0.03] px-2 -mx-2 rounded"
                  >
                    <span className="text-slate-300 truncate">{String(o.id).slice(0, 8)}…</span>
                    <span
                      className={`text-xs font-bold ${o.status === "paid" ? "text-emerald-300" : "text-slate-400"}`}
                    >
                      ${Number(o.total_usd).toFixed(2)} · {o.status as string}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="New users" viewAll="/admin/users">
          {activity.users.length === 0 ? (
            <Empty label="No users yet." />
          ) : (
            <ul className="divide-y divide-white/5">
              {(activity.users as Array<Record<string, unknown>>).map((u) => (
                <li key={u.user_id as string}>
                  <Link
                    to="/admin/users"
                    search={{ user: u.user_id as string }}
                    className="py-2 flex items-center justify-between text-sm hover:bg-white/[0.03] px-2 -mx-2 rounded"
                  >
                    <span className="text-slate-300 truncate">
                      {(u.username as string) ?? String(u.user_id).slice(0, 8)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(u.created_at as string).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Recent products" viewAll="/admin/products">
          {activity.products.length === 0 ? (
            <Empty label="No products yet." />
          ) : (
            <ul className="divide-y divide-white/5">
              {(activity.products as Array<Record<string, unknown>>).map((p) => (
                <li key={p.id as string}>
                  <Link
                    to="/product/$id"
                    params={{ id: p.id as string }}
                    className="py-2 flex items-center justify-between text-sm hover:bg-white/[0.03] px-2 -mx-2 rounded"
                  >
                    <span className="text-slate-300 truncate">{p.name as string}</span>
                    <span className="text-xs text-emerald-300 font-bold">
                      ${Number(p.price_usd).toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Audit trail" viewAll="/admin/audit">
          {activity.audit.length === 0 ? (
            <Empty label="No admin actions yet." />
          ) : (
            <ul className="divide-y divide-white/5">
              {(activity.audit as Array<Record<string, unknown>>).map((a) => (
                <li key={a.id as string} className="py-2 text-sm">
                  <div className="text-slate-200 font-mono text-xs">{a.action as string}</div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(a.created_at as string).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  viewAll,
}: {
  title: string;
  children: React.ReactNode;
  viewAll?: string;
}) {
  return (
    <div className="bg-[#141418] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white text-sm font-bold">{title}</h2>
        {viewAll && (
          <Link
            to={viewAll}
            className="text-[11px] text-emerald-300 hover:text-emerald-200 font-semibold"
          >
            View all →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
function Empty({ label }: { label: string }) {
  return <p className="text-xs text-slate-500 py-4 text-center">{label}</p>;
}
