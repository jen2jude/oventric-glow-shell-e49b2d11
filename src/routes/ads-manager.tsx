import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BarChart3,
  Megaphone,
  ChevronRight,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AdsManagerSkeleton } from "@/components/oventric/skeletons";

import { supabase } from "@/integrations/supabase/client";
import { listMyCampaigns, getMyCampaign, type MyCampaignSummary } from "@/lib/my-ads.functions";
import { setMyBannerAdVisibility } from "@/lib/my-ads-write.functions";
import {
  BannerAdModal,
  EMPTY_BANNER,
  type BannerAdDraft,
} from "@/components/oventric/ads/BannerAdModal";

export const Route = createFileRoute("/ads-manager")({
  // Paused legacy feature — not part of the MVP. The page is retained for
  // future reactivation but is unreachable: every visit redirects home.
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ads Manager — Oventric" },
      { name: "description", content: "Manage and track the performance of your ads on Oventric." },
    ],
  }),
  component: AdsManagerPage,
});

function AdsManagerPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyCampaigns);
  const detailFn = useServerFn(getMyCampaign);
  const visibilityFn = useServerFn(setMyBannerAdVisibility);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<MyCampaignSummary[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<BannerAdDraft>(EMPTY_BANNER);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const reload = useCallback(async () => {
    try {
      setRows(await listFn());
    } catch {
      setRows([]);
    }
  }, [listFn]);

  useEffect(() => {
    if (!ready) return;
    void reload();
  }, [ready, reload]);

  const openCreate = () => {
    setDraft(EMPTY_BANNER);
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setBusyId(id);
    try {
      const c = await detailFn({ data: { id } });
      setDraft({
        id: c.id,
        title: c.title,
        header: c.header,
        body: c.body,
        media_url: c.media_url,
        cta_type: c.cta_type,
        cta_url: c.cta_url,
        cta_label: c.cta_label,
        placements: c.placements.length ? c.placements : ["feed"],
      });
      setModalOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load this ad");
    } finally {
      setBusyId(null);
    }
  };

  const toggleVisibility = async (c: MyCampaignSummary) => {
    setBusyId(c.id);
    try {
      const { status } = await visibilityFn({ data: { id: c.id, visible: c.status !== "active" } });
      toast.success(status === "active" ? "Ad is now visible" : "Ad hidden");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update visibility");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready || rows === null) {
    return <AdsManagerSkeleton />;
  }

  return (
    <div className="page-light min-h-screen bg-[#0b0b0d] text-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </button>

        <header className="mb-6 flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-2xl md:text-3xl font-black">Ads Manager</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Manage and track the performance of your ads.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-[10px] bg-emerald-500 text-black px-3 py-2 text-sm font-bold hover:bg-emerald-400 shrink-0"
          >
            <Plus className="w-4 h-4" /> New banner ad
          </button>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#141418] p-8 text-center">
            <BarChart3 className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <div className="text-white font-semibold">No campaigns yet</div>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              Create a Tier 2 banner ad below, or start a full campaign with our team — live spend,
              reach, clicks and lead capture show up here in real time.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-[10px] bg-emerald-500 text-black px-4 py-2 text-sm font-semibold hover:bg-emerald-400"
              >
                <Plus className="w-4 h-4" /> New banner ad
              </button>
              <Link
                to="/advertise"
                className="inline-flex items-center gap-2 rounded-[10px] border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Start a campaign
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((c) => (
              <CampaignRow
                key={c.id}
                c={c}
                busy={busyId === c.id}
                onEdit={() => openEdit(c.id)}
                onToggle={() => toggleVisibility(c)}
              />
            ))}
          </div>
        )}
      </div>

      <BannerAdModal
        open={modalOpen}
        initial={draft}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
      />
    </div>
  );
}

function CampaignRow({
  c,
  busy,
  onEdit,
  onToggle,
}: {
  c: MyCampaignSummary;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const statusColor =
    c.status === "active"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : c.status === "paused"
        ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
        : c.status === "ended"
          ? "text-slate-400 bg-slate-500/10 border-slate-500/30"
          : "text-sky-400 bg-sky-500/10 border-sky-500/30";
  const isTier2 = c.tier === "image";
  const visible = c.status === "active";
  return (
    <div className="rounded-xl border border-white/10 bg-[#141418] hover:border-white/20 transition p-4">
      <div className="flex items-start justify-between gap-3">
        <Link to="/ads-manager/$id" params={{ id: c.id }} className="min-w-0 block">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-white font-semibold truncate">{c.title}</div>
            <span
              className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusColor}`}
            >
              {c.status}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">
              {isTier2 ? "tier 2 banner" : c.tier} · {c.cta_type.replace("_", " ")}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {c.placements.join(", ") || "no placements"} · {c.cities.length || 0} cities ·{" "}
            {c.countries.join("/") || "global"}
          </div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          {isTier2 && (
            <>
              <button
                onClick={onToggle}
                disabled={busy || c.status === "ended"}
                title={visible ? "Hide ad" : "Make ad visible"}
                aria-label={visible ? "Hide ad" : "Make ad visible"}
                className="p-2 rounded-[10px] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : visible ? (
                  <Eye className="w-4 h-4 text-emerald-400" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onEdit}
                disabled={busy}
                title="Edit ad"
                aria-label="Edit ad"
                className="p-2 rounded-[10px] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 disabled:opacity-50"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </>
          )}
          <Link
            to="/ads-manager/$id"
            params={{ id: c.id }}
            className="p-2 text-slate-500 hover:text-white"
            aria-label="Open campaign"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3">
        <Cell label="Spent" value={`$${c.spent_usd.toFixed(2)}`} />
        <Cell label="Budget" value={`$${c.total_budget_usd.toFixed(0)}`} />
        <Cell label="Impressions" value={c.impressions_total.toLocaleString()} />
        <Cell label="Clicks" value={c.clicks_total.toLocaleString()} />
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-black/20 border border-white/5 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">{label}</div>
      <div className="text-sm text-white font-black truncate">{value}</div>
    </div>
  );
}
