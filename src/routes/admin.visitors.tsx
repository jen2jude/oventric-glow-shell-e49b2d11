import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Users, Eye, Globe2, Smartphone } from "lucide-react";
import { getVisitorAnalytics, type VisitorAnalytics, type Slice } from "@/lib/admin-visitors.functions";

export const Route = createFileRoute("/admin/visitors")({
  head: () => ({
    meta: [
      { title: "Visitors · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminVisitors,
});

const RANGES = [
  { days: 1 as const, label: "Today" },
  { days: 7 as const, label: "7 days" },
  { days: 30 as const, label: "30 days" },
  { days: 90 as const, label: "90 days" },
];

function AdminVisitors() {
  const fetchAnalytics = useServerFn(getVisitorAnalytics);
  const [range, setRange] = useState<1 | 7 | 30 | 90>(7);
  const [data, setData] = useState<VisitorAnalytics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await fetchAnalytics({ data: { rangeDays: range } }));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [fetchAnalytics, range]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (err && !data) return <div className="p-6 text-red-300 text-sm">{err}</div>;
  if (!data)
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );

  const t = data.totals;
  const peak = Math.max(1, ...data.daily.map((d) => d.views));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-white text-2xl font-black">Visitors</h1>
          <p className="text-sm text-slate-400">
            Real traffic on Oventric — refreshed every minute. Admin pages are not counted.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[10px] overflow-hidden border border-white/10">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  range === r.days
                    ? "bg-emerald-500 text-black"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Kpi label="Visitors today" value={t.today} icon={Users} tint="text-emerald-300 bg-emerald-500/10 border-emerald-500/30" />
        <Kpi label={`Visitors (${data.rangeDays}d)`} value={t.visitors} icon={Users} tint="text-blue-300 bg-blue-500/10 border-blue-500/30" />
        <Kpi label="Page views" value={t.views} icon={Eye} tint="text-violet-300 bg-violet-500/10 border-violet-500/30" />
        <Kpi label="Sessions" value={t.sessions} icon={Globe2} tint="text-cyan-300 bg-cyan-500/10 border-cyan-500/30" />
        <Kpi label="Signed in" value={t.signedInVisitors} icon={Users} tint="text-amber-300 bg-amber-500/10 border-amber-500/30" />
        <Kpi label="Views / visitor" value={t.viewsPerVisitor} icon={Smartphone} tint="text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30" />
      </div>

      <Card title="Daily traffic">
        {data.daily.length === 0 ? (
          <Empty label="No traffic recorded yet." />
        ) : (
          <div className="flex items-end gap-1 h-40">
            {data.daily.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end group">
                <div className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 mb-1">
                  {d.visitors}
                </div>
                <div
                  className="w-full rounded-t bg-emerald-500/70 group-hover:bg-emerald-400 transition-colors"
                  style={{ height: `${Math.max(2, (d.views / peak) * 100)}%` }}
                  title={`${d.date} · ${d.visitors} visitors · ${d.views} views · ${d.signedIn} signed in`}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between text-[10px] text-slate-500 mt-2">
          <span>{data.daily[0]?.date}</span>
          <span>{data.daily[data.daily.length - 1]?.date}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title="Countries">
          <Bars rows={data.countries} />
        </Card>
        <Card title="Cities">
          <Bars rows={data.cities} />
        </Card>
        <Card title="Device type">
          <Bars rows={data.devices} />
        </Card>
        <Card title="Browsers">
          <Bars rows={data.browsers} />
        </Card>
        <Card title="Operating systems">
          <Bars rows={data.operatingSystems} />
        </Card>
        <Card title="Top pages">
          <Bars rows={data.pages} />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Active registered users">
          {data.people.length === 0 ? (
            <Empty label="No signed-in activity in this period." />
          ) : (
            <ul className="divide-y divide-white/5">
              {data.people.map((p) => (
                <li key={p.userId} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-slate-200 truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {p.username ? `@${p.username}` : p.userId.slice(0, 8)}
                      {p.country ? ` · ${p.country}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-emerald-300 font-bold">{p.views} views</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(p.lastSeen).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  tint: string;
}) {
  return (
    <div className="bg-[#141418] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
        <div className={`w-7 h-7 rounded-[10px] border flex items-center justify-center ${tint}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="text-white text-2xl font-black">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141418] border border-white/10 rounded-xl p-4">
      <h2 className="text-white text-sm font-bold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Bars({ rows }: { rows: Slice[] }) {
  if (rows.length === 0) return <Empty label="No data yet." />;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-300 truncate pr-2">{r.label}</span>
            <span className="text-slate-400 font-semibold shrink-0">{r.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/70"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs text-slate-500 py-4 text-center">{label}</p>;
}
