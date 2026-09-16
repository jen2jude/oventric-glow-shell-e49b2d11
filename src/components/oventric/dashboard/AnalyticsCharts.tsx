import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, AlertTriangle, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { getActivityTimeseries, type ActivityPoint } from "@/lib/dashboard-analytics.functions";

const RANGES = [
  { label: "7d", days: 7 as const },
  { label: "30d", days: 30 as const },
  { label: "90d", days: 90 as const },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      role="tooltip"
      className="rounded-[10px] border border-border bg-popover px-3 py-3 text-xs shadow-xl"
    >
      <div className="mb-1 font-bold text-popover-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-semibold text-popover-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsCharts() {
  const fetchFn = useServerFn(getActivityTimeseries);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<ActivityPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetchFn({ data: { rangeDays: range } })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message || "Failed to load chart data");
      });
    return () => {
      alive = false;
    };
  }, [fetchFn, range]);

  const chartData = (data ?? []).map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <div className="rounded-[10px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <BarChart3 className="w-4 h-4" /> Activity trend
        </h3>
        <div
          className="flex items-center gap-1 rounded-full border border-border bg-muted p-1"
          role="tablist"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <button
              key={r.label}
              role="tab"
              aria-selected={range === r.days}
              onClick={() => setRange(r.days)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                range === r.days
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div
          className="flex items-center gap-2 text-xs text-red-400 py-10 justify-center"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="h-64" aria-label={`Activity chart for the last ${range} days`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval={range === 7 ? 0 : Math.ceil(range / 10)}
                axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="posts"
                name="Posts"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="walletVolumeUSD"
                name="Wallet volume (USD)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
