import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Rss,
  Users,
  ShoppingBag,
  Wallet as WalletIcon,
  AlertTriangle,
} from "lucide-react";
import { getUsageAnalytics, type UsageAnalytics } from "@/lib/dashboard-analytics.functions";

export function AnalyticsWidget() {
  const fetchFn = useServerFn(getUsageAnalytics);
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchFn()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message || "Failed to load analytics");
      });
    return () => {
      alive = false;
    };
  }, [fetchFn]);

  return (
    <div className="rounded-[10px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Usage analytics</h3>
      </div>

      {error ? (
        <div
          className="flex items-center gap-2 text-xs text-red-400 py-6 justify-center"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Metric icon={Rss} label="Posts" value={data.posts} />
          <Metric icon={Users} label="Followers" value={data.followers} />
          <Metric
            icon={ShoppingBag}
            label="Orders (buy + sell)"
            value={data.ordersPlaced + data.ordersSold}
          />
          <Metric
            icon={WalletIcon}
            label="Wallet volume (USD)"
            value={`$${data.walletVolumeUSD.toLocaleString()}`}
          />
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Rss;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-muted p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-black text-foreground">{value}</div>
    </div>
  );
}
