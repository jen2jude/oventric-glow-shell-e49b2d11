import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Target,
  Users,
  Clock,
  Megaphone,
  Star,
  GraduationCap,
  Package,
  Paperclip,
  Send,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Rocket,
  Lock,
  AlertTriangle,
  Wallet as WalletIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice, formatMoney } from "@/lib/fx-display";
import { BountyEditorModal } from "./BountyEditorModal";
import { BountyDetail } from "./BountyDetail";
import { Plus } from "lucide-react";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { useServerFn } from "@tanstack/react-start";
import { listMyBountyApplicationIds } from "@/lib/bounties.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { AppStickyHeader } from "@/components/oventric/AppStickyHeader";
import { WebBounties } from "@/components/oventric/desktop/WebBounties";

type Category = "all" | "frontend" | "database" | "api" | "uiux";

const FILTERS: Array<{ key: Category; label: string }> = [
  { key: "all", label: "All Tasks" },
  { key: "frontend", label: "Frontend Gigs" },
  { key: "database", label: "Database Ops" },
  { key: "api", label: "API Integrations" },
  { key: "uiux", label: "UI/UX Polishing" },
];

interface Applicant {
  id: string;
  name: string;
  handle: string;
  rating: number;
  lmsMilestones: number;
  storeSales: number;
  pitch: string;
  hue: string;
}

interface Bounty {
  id: string;
  title: string;
  category: Exclude<Category, "all">;
  rewardValue: number;
  rewardCurrency: Currency;
  displayFormatted: string;
  originalFormatted: string | null;
  expiresAt: number; // ms epoch
  applicants: Applicant[];
  ownedByMe: boolean;
}

const H = 3_600_000;

type ContractStatus = "escrow" | "review" | "released" | "revisions" | "disputed";
interface ChatMsg {
  id: string;
  from: "developer" | "poster" | "system";
  text: string;
  ts: number;
}

interface ContractState {
  bountyId: string;
  applicantId: string;
  status: ContractStatus;
  deadline: number; // project deadline
  reviewDeadline: number | null; // when in review state
  disputed: boolean;
  messages: ChatMsg[];
}

interface BountyAd {
  id: string;
  advertiser: string;
  title: string;
  description: string;
  tier: string;
  media_url: string | null;
  cta_url: string;
  cta_label: string;
}

function useTicker(intervalMs = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00h 00m 00s";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function Bounties() {
  const { require, baseCurrency } = useOnboarding();
  const isAppShell = useIsAppShell();
  const [filter, setFilter] = useState<Category>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bountyAds, setBountyAds] = useState<BountyAd[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [postOpen, setPostOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const { isAuthenticated } = useAuthGate();
  const fetchMyApps = useServerFn(listMyBountyApplicationIds);

  // Load ids of bounties the current user already applied to.
  useEffect(() => {
    if (!isAuthenticated) {
      setAppliedIds(new Set());
      return;
    }
    let cancelled = false;
    fetchMyApps()
      .then((rows) => {
        if (cancelled) return;
        setAppliedIds(new Set((rows ?? []).map((r) => r.bounty_id)));
      })
      .catch(() => {
        if (!cancelled) setAppliedIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, fetchMyApps, refreshTick]);

  // Allow other flows (e.g. resuming after a wallet top-up) to open the bounty editor.
  useEffect(() => {
    const onOpen = () => setPostOpen(true);
    const onOpenDetail = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (detail?.id) setSelectedId(detail.id);
    };
    window.addEventListener("oventric:bounty:open", onOpen);
    window.addEventListener("oventric:bounty:open-detail", onOpenDetail);
    return () => {
      window.removeEventListener("oventric:bounty:open", onOpen);
      window.removeEventListener("oventric:bounty:open-detail", onOpenDetail);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("ad_campaigns")
      .select("id, advertiser, title, description, tier, media_url, cta_url, cta_label")
      .eq("status", "active")
      .contains("placements", ["bounties"])
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.error("Bounty ads fetch error:", error);
        }
        setBountyAds((data ?? []) as BountyAd[]);
        setAdsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [dbBounties, setDbBounties] = useState<Bounty[]>([]);
  const [bountiesLoading, setBountiesLoading] = useState(true);
  const [bountiesError, setBountiesError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setBountiesLoading(true);
    setBountiesError(null);
    supabase
      .from("bounties")
      .select(
        "id, title, category, price_usd, original_currency, original_amount, fx_snapshot, deadline_at, end_at, created_at, status",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.error("Bounties fetch error:", error);
          setBountiesError(error.message || "Bounties could not be loaded right now.");
        }
        const rows: Bounty[] = (data ?? [])
          // Global board: everyone sees every bounty. Amounts are always shown
          // in the viewer's own home currency via the FX model.
          .map((b) => {
            const cat = b.category as string as Exclude<Category, "all">;
            const expiresAt = b.deadline_at
              ? new Date(b.deadline_at as string).getTime()
              : b.end_at
                ? new Date(b.end_at as string).getTime()
                : new Date(b.created_at as string).getTime() + 48 * 3_600_000;
            const dp = computeDisplayPrice(
              {
                price_usd: Number(b.price_usd ?? 0),
                original_currency:
                  (b as { original_currency?: string | null }).original_currency ?? null,
                original_amount: (b as { original_amount?: number | null }).original_amount ?? null,
                fx_snapshot: (b as { fx_snapshot?: unknown }).fx_snapshot ?? null,
              },
              baseCurrency,
            );
            return {
              id: b.id as string,
              title: (b.title as string) ?? "",
              category: (["frontend", "database", "api", "uiux"] as const).includes(cat)
                ? cat
                : "api",
              rewardValue: dp.value,
              rewardCurrency: dp.currency,
              displayFormatted: dp.formatted,
              originalFormatted: dp.originalFormatted,
              expiresAt,
              ownedByMe: false,
              applicants: [],
            };
          });
        setDbBounties(rows);
        setBountiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick, baseCurrency, isAuthenticated]);

  // Realtime: auto-refresh when any bounty is inserted/updated/deleted
  useEffect(() => {
    const channel = supabase
      .channel("bounties-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "bounties" }, () =>
        setRefreshTick((t) => t + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Clear bounty highlight after a few seconds
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightId]);

  useTicker(1000);

  const ALL_BOUNTIES = dbBounties;

  const filtered = useMemo(
    () => (filter === "all" ? ALL_BOUNTIES : ALL_BOUNTIES.filter((b) => b.category === filter)),
    [filter, ALL_BOUNTIES],
  );

  const totalLocked = ALL_BOUNTIES.reduce((s, b) => s + b.rewardValue, 0);
  const activeCount = ALL_BOUNTIES.length;

  // ------- Live bounty detail (real backend) -------
  if (selectedId) {
    return <BountyDetail bountyId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  // ------- Public board -------
  if (isAppShell) {
    return (
      <div className="bg-[#0A0A0B] min-h-screen">
        <AppStickyHeader />
        <div className="px-4 pt-4 pb-6">
          {/* Premium hero */}
          <div className="rounded-3xl bg-[#0F0F10] border border-white/[0.06] p-5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5484D]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#E5484D]">
              <ShieldAlert className="w-3 h-3" /> Escrow protected
            </div>
            <h1 className="mt-3 text-white text-[26px] leading-[1.1] font-black tracking-tight">
              Bounty &amp; Escrow
              <br />
              Board
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
              Post work, pick verified solvers, release funds only when you&apos;re happy.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-[#141416] border border-white/[0.06] p-3">
                <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#E5484D]">
                  <WalletIcon className="w-3 h-3" /> Locked
                </div>
                <div className="mt-1 text-white text-lg font-black leading-none truncate">
                  {formatMoney(totalLocked, baseCurrency)}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">in {baseCurrency} escrow</div>
              </div>
              <div className="rounded-2xl bg-[#141416] border border-white/[0.06] p-3">
                <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <Target className="w-3 h-3" /> Open tasks
                </div>
                <div className="mt-1 text-white text-lg font-black leading-none">
                  {activeCount}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">seeking solvers</div>
              </div>
            </div>

            <button
              onClick={() => require(1, () => setPostOpen(true), "issuer")}
              className="mt-4 w-full h-11 rounded-[10px] bg-[#E5484D] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> Post a bounty
            </button>
          </div>

          {/* Filters */}
          <div className="mt-5 -mx-4 px-4 flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[#E5484D] text-white"
                      : "bg-[#141416] text-slate-300 border border-white/[0.06]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Stream */}
          <div className="mt-4 space-y-3">
            {bountiesLoading ? (
              <div className="space-y-3">
                <BountySkeleton />
                <BountySkeleton />
                <BountySkeleton />
              </div>
            ) : bountiesError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">
                {bountiesError}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/[0.06] bg-[#141416] p-8 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#1A1A1C] flex items-center justify-center mb-4">
                  <Target className="w-7 h-7 text-[#E5484D]" />
                </div>
                <h3 className="text-white text-base font-bold mb-1.5">Nothing here yet</h3>
                <p className="text-slate-400 text-[13px] mb-5">
                  Post the first task and start attracting verified solvers.
                </p>
                <button
                  onClick={() => require(1, () => setPostOpen(true), "issuer")}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] bg-[#E5484D] text-white text-sm font-bold"
                >
                  <Plus className="w-4 h-4" /> Post a bounty
                </button>
              </div>
            ) : (
              filtered.map((b, idx) => {
                const rows: React.ReactNode[] = [
                  <BountyRow
                    key={b.id}
                    app
                    bounty={b}
                    currency={baseCurrency}
                    onOpen={() => require(2, () => setSelectedId(b.id), "solver")}
                    isNew={highlightId === b.id}
                    alreadyApplied={appliedIds.has(b.id)}
                  />,
                ];
                if ((idx + 1) % 4 === 0) {
                  rows.push(
                    <LiveAdSlot
                      key={`ad-${b.id}`}
                      index={idx}
                      ads={bountyAds}
                      loading={adsLoading}
                    />,
                  );
                }
                return rows;
              })
            )}
          </div>
        </div>

        <BountyEditorModal
          open={postOpen}
          onClose={() => setPostOpen(false)}
          onPublished={(id) => {
            setRefreshTick((t) => t + 1);
            setHighlightId(id);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <WebBounties
        bounties={filtered}
        loading={bountiesLoading}
        error={bountiesError}
        currency={baseCurrency}
        onPost={() => require(2, () => setPostOpen(true), "poster")}
        onOpen={(id) => require(2, () => setSelectedId(id), "solver")}
      />
    </>
  );

}

function BountySkeleton() {
  return (
    <div className="bg-[#141416] border border-white/[0.06] rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 animate-pulse md:bg-white md:border-slate-200">
      <div className="flex-1 min-w-0 space-y-3">
        <div className="h-5 w-28 rounded bg-[#1A1A1C] md:bg-slate-200" />
        <div className="h-5 w-3/4 rounded bg-[#1A1A1C] md:bg-slate-200" />
        <div className="flex items-center gap-4">
          <div className="h-3.5 w-28 rounded bg-[#1A1A1C] md:bg-slate-200" />
          <div className="h-3.5 w-24 rounded bg-[#1A1A1C] md:bg-slate-200" />
        </div>
      </div>
      <div className="h-10 w-32 rounded-xl bg-[#1A1A1C] md:bg-slate-200 shrink-0" />
    </div>
  );
}

function BountyRow({
  bounty,
  currency,
  onOpen,
  isNew,
  alreadyApplied,
  app,
}: {
  bounty: Bounty;
  currency: Currency;
  onOpen: () => void;
  isNew?: boolean;
  alreadyApplied?: boolean;
  app?: boolean;
}) {
  const remaining = bounty.expiresAt - Date.now();

  if (app) {
    return (
      <button
        onClick={onOpen}
        className={`w-full text-left rounded-2xl bg-[#141416] border transition-transform active:scale-[0.99] ${
          isNew
            ? "border-emerald-500/50"
            : "border-white/[0.06]"
        }`}
      >
        <div className="rounded-2xl bg-[#141416] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                <Target className="w-3 h-3" /> Active bounty
              </div>
              <h3 className="mt-1.5 text-white font-semibold text-[15px] leading-snug line-clamp-2">
                {bounty.title}
              </h3>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-emerald-400 font-black text-[17px] leading-none">
                {bounty.displayFormatted}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">escrowed</div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
              <Clock className="w-3 h-3" /> {formatCountdown(remaining)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1A1A1C] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              <Users className="w-3 h-3" /> {bounty.applicants.length}
            </span>
            <span className="ml-auto text-[11px] font-semibold text-slate-400">
              Solver gets {formatMoney(bounty.rewardValue * 0.8, bounty.rewardCurrency)}
            </span>
          </div>

          <div
            className={`mt-3.5 h-10 rounded-xl inline-flex w-full items-center justify-center gap-1.5 text-[13px] font-bold ${
              alreadyApplied
                ? "bg-[#1A1A1C] text-emerald-400"
                : "bg-emerald-500 text-black"
            }`}
          >
            {alreadyApplied ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Applied · Open
              </>
            ) : (
              <>View task &amp; apply</>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`web-card p-4 flex flex-col md:flex-row md:items-center gap-4 transition-all duration-700 ${isNew ? "border-2 border-crimson/80" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[10px] bg-crimson/10 border border-crimson/30 text-crimson text-[10px] font-bold tracking-wider">
          <Target className="w-3 h-3 shrink-0" />
          ACTIVE BOUNTY · {bounty.displayFormatted}
        </div>
        <h3 className="mt-2 text-slate-900 font-bold text-base md:text-lg leading-snug truncate">
          {bounty.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            Expires in {formatCountdown(remaining)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5 shrink-0" /> {bounty.applicants.length}{" "}
            {bounty.applicants.length === 1 ? "Applicant" : "Applicants"}
          </span>
          <span className="inline-flex items-center gap-1 text-crimson">
            Solver {formatMoney(bounty.rewardValue * 0.8, bounty.rewardCurrency)} · Fee{" "}
            {formatMoney(bounty.rewardValue * 0.2, bounty.rewardCurrency)}
          </span>
        </div>
      </div>
      <button
        onClick={onOpen}
        className={`shrink-0 px-4 py-2.5 rounded-[10px] font-bold text-sm transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
          alreadyApplied
            ? "bg-crimson/10 hover:bg-crimson/15 text-crimson border border-crimson/30"
            : "bg-crimson hover:bg-crimson/90 text-white"
        }`}
      >
        {alreadyApplied ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Already Applied · Open
          </>
        ) : (
          <>View Task &amp; Apply</>
        )}
      </button>
    </div>
  );
}

function LiveAdSlot({ index, ads, loading }: { index: number; ads: BountyAd[]; loading: boolean }) {
  const isEven = index % 2 === 0;

  if (loading) {
    if (isEven) {
      return (
        <div className="bg-[#1E1E24] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between animate-pulse md:bg-white md:border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-slate-700" />
            <div className="h-2.5 w-24 rounded bg-slate-700" />
            <div className="h-2.5 w-48 rounded bg-slate-700" />
          </div>
          <div className="h-2.5 w-16 rounded bg-slate-700" />
        </div>
      );
    }
    return (
      <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[#141416] animate-pulse md:border-slate-200 md:bg-white">
        <div className="flex items-center justify-between px-5 py-4 gap-4">
          <div className="min-w-0 space-y-2">
            <div className="h-2.5 w-20 rounded bg-[#1A1A1C]" />
            <div className="h-4 w-56 rounded bg-[#1A1A1C]" />
          </div>
          <div className="h-8 w-16 rounded-[10px] bg-[#1A1A1C] shrink-0" />
        </div>
      </div>
    );
  }

  if (ads.length === 0) {
    if (isEven) {
      return (
        <div className="bg-[#1E1E24] border border-dashed border-white/10 rounded-xl px-4 py-3 flex items-center justify-between md:bg-white md:border-slate-300">
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <Megaphone className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Sponsored · Available
            </span>
            <span>Promote your brand to top developers.</span>
          </div>
          <span className="text-xs font-semibold text-emerald-400/70">Inquire →</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl overflow-hidden border border-dashed border-white/[0.06] bg-[#141416] md:border-slate-300 md:bg-white">
        <div className="flex items-center justify-between px-5 py-4 gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Sponsored · Available
            </div>
            <div className="mt-1 text-slate-400 md:text-slate-700 font-bold text-sm md:text-base">
              Your brand could appear here. Reach builders across Oventric.
            </div>
          </div>
          <span className="shrink-0 px-3 py-3 rounded-[10px] bg-[#1A1A1C] text-slate-400 text-xs font-semibold border border-white/[0.06] md:bg-slate-50 md:text-slate-600 md:border-slate-200">
            Learn more
          </span>
        </div>
      </div>
    );
  }

  const ad = ads[index % ads.length];
  const isText = ad.tier === "text";
  const ctaLabel = ad.cta_label || "Learn more";

  if (isText) {
    return (
      <a
        href={ad.cta_url || "#"}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="bg-[#141416] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center justify-between hover:border-white/15 transition-colors md:bg-white md:border-slate-200 md:hover:border-slate-300"
      >
        <div className="inline-flex items-center gap-2 text-xs text-slate-400">
          <Megaphone className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Sponsored
          </span>
          <span className="text-slate-300 md:text-slate-700">
            {ad.advertiser} · {ad.description || ad.title}
          </span>
        </div>
        <span className="text-xs font-semibold text-emerald-400">{ctaLabel} →</span>
      </a>
    );
  }

  const hasMedia = !!ad.media_url;
  return (
    <a
      href={ad.cta_url || "#"}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="block rounded-xl overflow-hidden border border-white/[0.06] bg-[#141416] hover:border-white/15 transition-colors md:border-slate-200 md:bg-white md:hover:border-slate-300"
    >
      <div className="flex items-center justify-between px-5 py-4 gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:text-slate-500">
            Sponsored
          </div>
          <div className="mt-1 text-white md:text-slate-900 font-bold text-sm md:text-base">
            {ad.advertiser} · {ad.title}
          </div>
          {ad.description && (
            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{ad.description}</div>
          )}
        </div>
        {hasMedia ? (
          <ResponsiveImage
            src={ad.media_url ?? undefined}
            alt={ad.advertiser}
            sizes="64px"
            className="shrink-0 w-16 h-10 rounded-[10px] object-cover border border-white/[0.06]"
            loading="lazy"
          />
        ) : (
          <span className="shrink-0 px-3 py-3 rounded-[10px] bg-[#1A1A1C] hover:bg-[#1F1F21] text-white md:bg-crimson md:hover:bg-crimson/90 md:text-white text-xs font-semibold border border-white/[0.06] md:border-0">
            {ctaLabel}
          </span>
        )}
      </div>
    </a>
  );
}

function ApplicantEvaluation({
  bounty,
  currency,
  onBack,
  onAssign,
}: {
  bounty: Bounty;
  currency: Currency;
  onBack: () => void;
  onAssign: (applicantId: string) => void;
}) {
  useTicker(1000);
  const remaining = bounty.expiresAt - Date.now();
  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-[10px] px-3 py-1.5 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Bounty Board
      </button>

      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 mb-5">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[10px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider">
          <Target className="w-3 h-3" />
          ACTIVE BOUNTY · {bounty.displayFormatted}
        </div>
        <h2 className="mt-2 text-white text-xl md:text-2xl font-black leading-tight">
          {bounty.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Expires in {formatCountdown(remaining)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {bounty.applicants.length} pitches
          </span>
        </div>
      </div>

      <div className="text-white font-bold text-sm uppercase tracking-wider text-slate-400 mb-3">
        Applicant Pitches
      </div>

      <div className="space-y-3">
        {bounty.applicants.map((a) => (
          <div
            key={a.id}
            className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 flex flex-col md:flex-row gap-4"
          >
            <div
              className={`shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${a.hue} flex items-center justify-center text-white font-black text-lg`}
            >
              {a.name
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-white font-bold">{a.name}</div>
                <div className="text-xs text-slate-500">{a.handle}</div>
                <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 fill-current" /> {a.rating.toFixed(1)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold">
                  <GraduationCap className="w-3 h-3" /> {a.lmsMilestones} LMS Milestones
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] bg-[#1A1A1C] border border-white/[0.06] text-slate-300 text-[10px] font-semibold">
                  <Package className="w-3 h-3" /> {a.storeSales} Store Sales
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] bg-[#1A1A1C] border border-white/[0.06] text-slate-300 text-[10px] font-semibold">
                  <Star className="w-3 h-3" /> Reputation {(a.rating * 20).toFixed(0)}/100
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">{a.pitch}</p>
            </div>
            <div className="shrink-0 md:self-center">
              <button
                onClick={() => onAssign(a.id)}
                className="px-4 py-2.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors whitespace-nowrap"
              >
                Assign Task to Developer
              </button>
            </div>
          </div>
        ))}
        {bounty.applicants.length === 0 && (
          <div className="text-center text-slate-500 py-16 bg-[#1E1E24] border border-white/5 rounded-xl">
            No pitches yet on this bounty.
          </div>
        )}
      </div>
    </div>
  );
}

function ContractWorkspace({
  contract,
  setContract,
  role,
  setRole,
  currency,
  bounty,
  applicant,
  onExit,
}: {
  contract: ContractState;
  setContract: (c: ContractState | null) => void;
  role: "poster" | "developer";
  setRole: (r: "poster" | "developer") => void;
  currency: Currency;
  bounty: Bounty;
  applicant: Applicant;
  onExit: () => void;
}) {
  useTicker(1000);
  const [chatInput, setChatInput] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const [releaseFlash, setReleaseFlash] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [contract.messages.length]);

  const isDisputed = contract.disputed;
  const status = contract.status;

  const sendMsg = () => {
    if (!chatInput.trim() || isDisputed) return;
    setContract({
      ...contract,
      messages: [
        ...contract.messages,
        { id: `m${Date.now()}`, from: role, text: chatInput.trim(), ts: Date.now() },
      ],
    });
    setChatInput("");
  };

  const submitWork = () => {
    if (isDisputed) return;
    setContract({
      ...contract,
      status: "review",
      reviewDeadline: Date.now() + 72 * H,
      messages: [
        ...contract.messages,
        {
          id: `m${Date.now()}`,
          from: "system",
          text: "Developer submitted work. 72-hour review window started.",
          ts: Date.now(),
        },
      ],
    });
  };

  const approve = () => {
    if (isDisputed) return;
    setReleaseFlash(true);
    setContract({
      ...contract,
      status: "released",
      messages: [
        ...contract.messages,
        {
          id: `m${Date.now()}`,
          from: "system",
          text: `Funds released — ${bounty.displayFormatted} paid to ${applicant.name}.`,
          ts: Date.now(),
        },
      ],
    });
    setTimeout(() => setReleaseFlash(false), 2400);
  };

  const submitReject = () => {
    if (!rejectText.trim() || isDisputed) return;
    setContract({
      ...contract,
      status: "revisions",
      reviewDeadline: null,
      messages: [
        ...contract.messages,
        {
          id: `m${Date.now()}`,
          from: "system",
          text: `Delivery rejected. Bug log:\n${rejectText.trim()}`,
          ts: Date.now(),
        },
      ],
    });
    setRejectText("");
    setRejectOpen(false);
  };

  const escalate = () => {
    setContract({
      ...contract,
      disputed: true,
      messages: [
        ...contract.messages,
        {
          id: `m${Date.now()}`,
          from: "system",
          text: "⚖️ Dispute escalated to arbiter. All actions frozen pending admin review.",
          ts: Date.now(),
        },
      ],
    });
  };

  const projectRemaining = contract.deadline - Date.now();
  const reviewRemaining = contract.reviewDeadline ? contract.reviewDeadline - Date.now() : 0;

  const stages: Array<{ key: ContractStatus | "generic"; label: string }> = [
    { key: "escrow", label: "Funds In Escrow" },
    { key: "review", label: "Review Cycle" },
    { key: "released", label: "Payout Released" },
  ];
  const stageIndex =
    status === "escrow" || status === "revisions"
      ? 0
      : status === "review"
        ? 1
        : status === "released"
          ? 2
          : 0;

  return (
    <div className="relative max-w-6xl mx-auto w-full px-4 py-6">
      {releaseFlash && (
        <div className="modal-light fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0  opacity-60 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black border border-white/20 rounded-2xl px-8 py-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto" />
              <div className="mt-2 text-white font-black text-xl">Payout Released</div>
              <div className="text-emerald-300 text-sm">
                {bounty.displayFormatted} → {applicant.name}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-[10px] px-3 py-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Workspace
        </button>
        <div className="inline-flex items-center gap-2 text-xs">
          <span className="text-slate-500 uppercase tracking-wider">View as</span>
          <div className="inline-flex rounded-[10px] overflow-hidden border border-white/10 bg-[#1E1E24]">
            <button
              onClick={() => setRole("poster")}
              className={`px-3 py-1.5 font-semibold ${role === "poster" ? "bg-emerald-500 text-black" : "text-slate-300"}`}
            >
              Poster
            </button>
            <button
              onClick={() => setRole("developer")}
              className={`px-3 py-1.5 font-semibold ${role === "developer" ? "bg-emerald-500 text-black" : "text-slate-300"}`}
            >
              Developer
            </button>
          </div>
        </div>
      </div>

      {isDisputed && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/50 text-amber-200 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4" /> [Dispute Logged — Admin Review Pending]
        </div>
      )}

      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-4 mb-5">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[10px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider">
          <Lock className="w-3 h-3" /> LIVE CONTRACT · {bounty.displayFormatted}
        </div>
        <h2 className="mt-2 text-white font-bold text-lg leading-snug">{bounty.title}</h2>
        <div className="mt-1 text-xs text-slate-400">
          Sealed with <span className="text-white font-semibold">{applicant.name}</span>{" "}
          {applicant.handle}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Left pane: chat */}
        <div className="bg-[#1E1E24] border border-white/10 rounded-xl flex flex-col h-[560px] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 text-white font-bold text-sm">
            Peer Chat
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {contract.messages.map((m) => (
              <ChatBubble key={m.id} msg={m} viewerRole={role} />
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-white/5 p-3 flex items-center gap-2">
            <button
              disabled={isDisputed}
              className="p-2 rounded-[10px] bg-[#121214] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMsg()}
              disabled={isDisputed}
              placeholder={isDisputed ? "Chat frozen — dispute in review" : `Message as ${role}…`}
              className="flex-1 bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-40"
            />
            <button
              onClick={sendMsg}
              disabled={isDisputed || !chatInput.trim()}
              className="p-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right pane: escrow matrix */}
        <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-4 flex flex-col gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Project Deadline
            </div>
            <div className="mt-1 text-white font-black text-2xl font-mono">
              {formatCountdown(projectRemaining)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {status === "revisions"
                ? "Paused — revisions requested"
                : "Ticking until penalty clauses activate"}
            </div>
          </div>

          {contract.reviewDeadline && status === "review" && (
            <div className="rounded-[10px] bg-amber-500/10 border border-amber-500/30 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                72-Hour Review Window
              </div>
              <div className="mt-1 text-amber-200 font-mono text-sm">
                {formatCountdown(reviewRemaining)}
              </div>
            </div>
          )}

          {/* Stage tracker */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Contract Status
            </div>
            <div className="flex items-center gap-1">
              {stages.map((s, i) => {
                const active = i <= stageIndex;
                const isCurrent = i === stageIndex;
                return (
                  <div key={s.key} className="flex items-center gap-1 flex-1">
                    <div
                      className={`flex-1 rounded-[10px] px-2 py-3 text-center text-[10px] font-bold border ${
                        active
                          ? isCurrent
                            ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200"
                            : "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-[#121214] border-white/5 text-slate-500"
                      }`}
                    >
                      {i + 1}. {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
            {status === "revisions" && (
              <div className="mt-2 text-[11px] text-amber-300 font-semibold">
                ↻ Revisions Required — awaiting developer resubmission
              </div>
            )}
            {status === "released" && (
              <div className="mt-2 text-[11px] text-emerald-300 font-semibold">
                ✓ Funds released to developer wallet
              </div>
            )}
          </div>

          {/* Action zone */}
          <div className="flex-1 min-h-0" />

          <div className="space-y-2">
            {role === "developer" &&
              (status === "escrow" || status === "revisions") &&
              !isDisputed && (
                <button
                  onClick={submitWork}
                  className="w-full py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Rocket className="w-4 h-4" /> Submit Work &amp; Request Release
                </button>
              )}

            {role === "poster" && status === "review" && !isDisputed && (
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={approve}
                  className="w-full py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve &amp; Release Funds
                </button>
                <button
                  onClick={() => setRejectOpen((v) => !v)}
                  className="w-full py-3 rounded-[10px] bg-[#121214] border border-red-500/40 text-red-300 hover:bg-red-500/10 font-bold text-sm transition-colors inline-flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Reject Delivery &amp; Log Issues
                </button>
                {rejectOpen && (
                  <div className="rounded-[10px] border border-red-500/30 bg-red-500/5 p-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-red-300">
                      Bug log
                    </label>
                    <textarea
                      value={rejectText}
                      onChange={(e) => setRejectText(e.target.value)}
                      rows={4}
                      placeholder="Describe the issues with this delivery…"
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
                    />
                    <button
                      onClick={submitReject}
                      disabled={!rejectText.trim()}
                      className="mt-2 w-full py-3 rounded-[10px] bg-red-500 hover:bg-red-400 text-black font-bold text-sm disabled:opacity-40"
                    >
                      Submit Rejection
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === "released" && (
              <div className="text-center text-xs text-emerald-300 font-semibold py-3 border border-emerald-500/30 rounded-[10px] bg-emerald-500/10">
                Contract fulfilled. No further actions required.
              </div>
            )}

            <button
              onClick={escalate}
              disabled={isDisputed || status === "released"}
              className="w-full text-xs text-slate-400 hover:text-amber-300 inline-flex items-center justify-center gap-1.5 py-3 disabled:opacity-40"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> ⚖️ Escalate to Dispute Arbiter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg, viewerRole }: { msg: ChatMsg; viewerRole: "poster" | "developer" }) {
  if (msg.from === "system") {
    return (
      <div className="text-center">
        <span className="inline-block text-[11px] text-slate-400 bg-[#121214] border border-white/5 rounded-full px-3 py-1 whitespace-pre-wrap">
          {msg.text}
        </span>
      </div>
    );
  }
  const mine = msg.from === viewerRole;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-3 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
          mine
            ? "bg-emerald-500 text-black rounded-br-sm"
            : "bg-[#121214] border border-white/10 text-slate-200 rounded-bl-sm"
        }`}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">
          {msg.from === "poster" ? "Poster" : "Developer"}
        </div>
        {msg.text}
      </div>
    </div>
  );
}
