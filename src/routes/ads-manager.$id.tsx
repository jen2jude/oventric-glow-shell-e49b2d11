import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Eye,
  MousePointerClick,
  MessageCircle,
  Users,
  DollarSign,
  Copy,
  ExternalLink,
  Target,
  Calendar,
  MapPin,
  PieChart,
  Link as LinkIcon,
} from "lucide-react";
import { CampaignDetailSkeleton } from "@/components/oventric/skeletons";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  getMyCampaign,
  getMyCampaignMetrics,
  listMyCampaignLeads,
  type MyCampaignDetail,
  type MyCampaignMetrics,
  type MyCampaignLead,
} from "@/lib/my-ads.functions";

export const Route = createFileRoute("/ads-manager/$id")({
  // Paused legacy feature — not part of the MVP. The page is retained for
  // future reactivation but is unreachable: every visit redirects home.
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  ssr: false,
  head: () => ({ meta: [{ title: "Campaign — Ads Manager" }] }),
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getMyCampaign);
  const metricsFn = useServerFn(getMyCampaignMetrics);
  const leadsFn = useServerFn(listMyCampaignLeads);

  const [ready, setReady] = useState(false);
  const [detail, setDetail] = useState<MyCampaignDetail | null>(null);
  const [metrics, setMetrics] = useState<MyCampaignMetrics | null>(null);
  const [leads, setLeads] = useState<MyCampaignLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data.user) {
        navigate({ to: "/" });
        return;
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

  const refresh = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([
        getFn({ data: { id } }),
        metricsFn({ data: { id, days: 30 } }),
      ]);
      setDetail(d);
      setMetrics(m);
      if (d.cta_type === "lead_form") {
        setLeads(await leadsFn({ data: { id } }));
      } else {
        setLeads([]);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, getFn, metricsFn, leadsFn]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  // Realtime: refresh on new events/leads/spend rows for this campaign.
  useEffect(() => {
    if (!ready) return;
    const ch = supabase
      .channel(`ads-manager-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_events", filter: `campaign_id=eq.${id}` },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_leads", filter: `campaign_id=eq.${id}` },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_daily_spend", filter: `campaign_id=eq.${id}` },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ad_campaigns", filter: `id=eq.${id}` },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ready, id, refresh]);

  if (!ready || (!detail && !error)) {
    return <CampaignDetailSkeleton />;
  }

  if (error || !detail) {
    return (
      <div className="page-light min-h-screen bg-[#0b0b0d] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-white font-semibold mb-2">Couldn&apos;t load campaign</div>
          <p className="text-slate-400 text-sm mb-4">{error ?? "This campaign is unavailable."}</p>
          <button
            onClick={() => navigate({ to: "/ads-manager" })}
            className="rounded-[10px] bg-emerald-500 text-black px-4 py-2 text-sm font-semibold"
          >
            Back to Ads Manager
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-light min-h-screen bg-[#0b0b0d] text-slate-200 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate({ to: "/ads-manager" })}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Ads Manager
        </button>

        <header className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-white text-2xl md:text-3xl font-black">{detail.title}</h1>
            <StatusPill status={detail.status} />
          </div>
          <p className="text-slate-400 text-sm mt-1">{detail.description || "No description."}</p>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">
            View only · Contact support to edit
          </div>
        </header>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Kpi
            icon={Eye}
            label="Impressions"
            value={(metrics?.totals.impressions ?? 0).toLocaleString()}
          />
          <Kpi
            icon={MousePointerClick}
            label="Clicks"
            value={(metrics?.totals.clicks ?? 0).toLocaleString()}
            sub={`CTR ${metrics?.ctr.toFixed(2) ?? "0.00"}%`}
          />
          <Kpi
            icon={Users}
            label="Reach (est.)"
            value={(metrics?.reach_estimate ?? 0).toLocaleString()}
          />
          <Kpi
            icon={DollarSign}
            label="Spent"
            value={`$${(metrics?.totals.spent ?? 0).toFixed(2)}`}
            sub={`CPM $${(metrics?.cpm ?? 0).toFixed(2)}`}
          />
        </div>

        {/* Escrow */}
        <EscrowCard detail={detail} />

        {/* Setup + Targeting */}
        <div className="grid md:grid-cols-2 gap-3 mt-5">
          <Section title="Setup" icon={Target}>
            <Row label="Tier" value={detail.tier.toUpperCase()} />
            <Row label="CTA" value={detail.cta_type.replace("_", " ")} />
            <Row label="Header" value={detail.header || "—"} />
            <Row label="Body" value={detail.body || "—"} multiline />
            {detail.cta_type === "url" && <RowCopy label="URL" value={detail.cta_url} />}
            {detail.cta_type === "whatsapp" && (
              <Row label="WhatsApp" value={detail.cta_whatsapp || "—"} />
            )}
          </Section>

          <Section title="Targeting & Schedule" icon={MapPin}>
            <Row label="Countries" value={detail.countries.join(", ") || "All"} />
            <Row
              label="Cities"
              value={detail.cities.length ? `${detail.cities.length} cities` : "All"}
              multiline
            />
            <Row label="Placements" value={detail.placements.join(", ") || "—"} />
            <Row label="Daily budget" value={`$${detail.daily_budget_usd.toFixed(2)}`} />
            <Row label="Total budget" value={`$${detail.total_budget_usd.toFixed(2)}`} />
            <Row label="Start" value={fmtDate(detail.start_at)} />
            <Row label="End" value={fmtDate(detail.end_at)} />
          </Section>
        </div>

        {/* Chart */}
        <div className="mt-5">
          <Section title="Last 30 days" icon={PieChart}>
            <MetricsChart metrics={metrics} />
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <MiniStat label="URL clicks" value={metrics?.url_clicks ?? 0} icon={LinkIcon} />
              <MiniStat
                label="WhatsApp clicks"
                value={metrics?.whatsapp_clicks ?? 0}
                icon={MessageCircle}
              />
              <MiniStat label="Leads" value={metrics?.totals.leads ?? 0} icon={Users} />
              <MiniStat label="Days active" value={metrics?.series.length ?? 0} icon={Calendar} />
            </div>
          </Section>
        </div>

        {/* Clicks by placement */}
        {metrics && metrics.clicks_by_placement.length > 0 && (
          <div className="mt-5">
            <Section title="Clicks by placement" icon={MousePointerClick}>
              <div className="space-y-2">
                {metrics.clicks_by_placement.map((p) => {
                  const max = metrics.clicks_by_placement[0]?.clicks || 1;
                  const pct = Math.max(4, Math.round((p.clicks / max) * 100));
                  return (
                    <div key={p.placement}>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span className="capitalize">{p.placement}</span>
                        <span>{p.clicks}</span>
                      </div>
                      <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
        )}

        {/* Leads (only for lead_form) */}
        {detail.cta_type === "lead_form" && (
          <div className="mt-5">
            <Section title="Leads (live)" icon={Users}>
              <LeadsTable leads={leads} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : status === "paused"
        ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
        : status === "ended"
          ? "text-slate-400 bg-slate-500/10 border-slate-500/30"
          : "text-sky-400 bg-sky-500/10 border-sky-500/30";
  return (
    <span
      className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${cls}`}
    >
      {status}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#141418] p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-white text-xl font-black mt-1 truncate">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[10px] bg-black/20 border border-white/5 p-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-white font-black text-sm mt-0.5">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function EscrowCard({ detail }: { detail: MyCampaignDetail }) {
  const pctSpent =
    detail.escrow_locked > 0
      ? Math.min(100, Math.round((detail.spent_usd / detail.escrow_locked) * 100))
      : 0;
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
            Wallet Escrow
          </div>
          <div className="text-white text-lg font-black mt-1">
            ${detail.escrow_locked.toFixed(2)} locked from your wallet
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Balance left
          </div>
          <div className="text-emerald-300 text-lg font-black">
            ${detail.escrow_remaining.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-black/30 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctSpent}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 mt-1">
        <span>Spent ${detail.spent_usd.toFixed(2)}</span>
        <span>{pctSpent}%</span>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141418] p-4">
      <div className="flex items-center gap-2 text-white font-semibold mb-3">
        <Icon className="w-4 h-4 text-emerald-400" /> {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 text-sm">
      <div className="text-slate-500 text-[11px] uppercase tracking-widest font-bold pt-0.5">
        {label}
      </div>
      <div
        className={`text-slate-200 ${multiline ? "whitespace-pre-wrap break-words" : "truncate"}`}
      >
        {value}
      </div>
    </div>
  );
}

function RowCopy({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 text-sm">
      <div className="text-slate-500 text-[11px] uppercase tracking-widest font-bold pt-0.5">
        {label}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-slate-200 truncate">{value || "—"}</span>
        {value && (
          <>
            <button
              onClick={copy}
              className="text-slate-400 hover:text-white shrink-0"
              title="Copy"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white shrink-0"
              title="Open"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function LeadsTable({ leads }: { leads: MyCampaignLead[] | null }) {
  if (leads === null) return <div className="text-slate-500 text-sm">Loading…</div>;
  if (leads.length === 0)
    return (
      <div className="text-slate-500 text-sm">
        No leads yet. New submissions will appear here instantly.
      </div>
    );
  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-slate-500 text-left">
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Phone</th>
            <th className="px-4 py-2">Message</th>
            <th className="px-4 py-2">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {leads.map((l) => (
            <tr key={l.id} className="hover:bg-white/5">
              <td className="px-4 py-2 text-slate-200">{l.name || "—"}</td>
              <td className="px-4 py-2">
                {l.email ? (
                  <button
                    onClick={() => copy(l.email!)}
                    className="text-emerald-300 hover:underline inline-flex items-center gap-1"
                  >
                    {l.email} <Copy className="w-3 h-3 opacity-60" />
                  </button>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-2">
                {l.phone ? (
                  <button
                    onClick={() => copy(l.phone!)}
                    className="text-emerald-300 hover:underline inline-flex items-center gap-1"
                  >
                    {l.phone} <Copy className="w-3 h-3 opacity-60" />
                  </button>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-2 text-slate-300 max-w-[280px] truncate">
                {l.message || "—"}
              </td>
              <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                {fmtDate(l.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricsChart({ metrics }: { metrics: MyCampaignMetrics | null }) {
  const series = metrics?.series ?? [];
  const max = useMemo(
    () => Math.max(1, ...series.map((s) => Math.max(s.impressions, s.clicks * 10))),
    [series],
  );
  if (series.length === 0) {
    return (
      <div className="h-32 rounded-[10px] bg-black/20 border border-white/5 flex items-center justify-center text-slate-500 text-sm">
        No delivery data yet
      </div>
    );
  }
  return (
    <div>
      <div className="h-40 flex items-end gap-[2px] rounded-[10px] bg-black/20 border border-white/5 p-2">
        {series.map((s) => {
          const impH = (s.impressions / max) * 100;
          const clkH = ((s.clicks * 10) / max) * 100;
          return (
            <div
              key={s.day}
              className="flex-1 h-full flex flex-col justify-end gap-[1px]"
              title={`${s.day}: ${s.impressions} imp / ${s.clicks} clk / $${s.spent_usd}`}
            >
              <div className="w-full bg-emerald-500/70 rounded-t" style={{ height: `${clkH}%` }} />
              <div className="w-full bg-emerald-500/25 rounded-b" style={{ height: `${impH}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-500/70 rounded-sm" /> Clicks (×10)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-500/25 rounded-sm" /> Impressions
        </span>
      </div>
    </div>
  );
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return v;
  }
}
