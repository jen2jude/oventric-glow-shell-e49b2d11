import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Target,
  Clock,
  Users,
  Wallet as WalletIcon,
  Search,
  Lock,
  Smartphone,
  ArrowRight,
  Gavel,
  HandCoins,
  CircleCheckBig,
} from "lucide-react";

import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { formatMoney } from "@/lib/fx-display";

const SHELL = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-11";
const PAGE_SIZE = 9;

export interface WebBountyItem {
  id: string;
  title: string;
  category: string;
  rewardValue: number;
  rewardCurrency: Currency;
  displayFormatted: string;
  expiresAt: number;
  applicants: unknown[];
}

type SortKey = "reward_desc" | "reward_asc" | "ending" | "applicants";

const CATEGORY_LABELS: Record<string, string> = {
  frontend: "Frontend",
  database: "Database ops",
  api: "API integrations",
  uiux: "UI/UX polishing",
};

const STEPS = [
  {
    icon: HandCoins,
    title: "Funds locked first",
    text: "A poster funds the bounty up front. The reward sits in Oventric escrow, not in anyone's pocket.",
  },
  {
    icon: Gavel,
    title: "Solvers apply",
    text: "Verified builders pitch with their track record. The poster picks one and the contract opens.",
  },
  {
    icon: CircleCheckBig,
    title: "Release on delivery",
    text: "Work is reviewed in-thread. Approve and the escrow releases instantly — or open a dispute.",
  },
];

function countdown(ms: number) {
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

/**
 * Read-only web storefront for the Bounty & Escrow board.
 * Browser visitors can browse and filter every open bounty; posting or
 * applying hands off to the app via `onGated`.
 */
export function WebBounties({
  bounties,
  loading,
  error,
  currency,
  onGated,
}: {
  bounties: WebBountyItem[];
  loading: boolean;
  error: string | null;
  currency: Currency;
  onGated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("reward_desc");
  const [page, setPage] = useState(1);

  const categories = useMemo(() => {
    const set = new Set(bounties.map((b) => b.category));
    return ["all", ...Array.from(set)];
  }, [bounties]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bounties.filter((b) => {
      if (category !== "all" && b.category !== category) return false;
      if (q && !b.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bounties, category, query]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    switch (sort) {
      case "reward_asc":
        return out.sort((a, b) => a.rewardValue - b.rewardValue);
      case "ending":
        return out.sort((a, b) => a.expiresAt - b.expiresAt);
      case "applicants":
        return out.sort((a, b) => b.applicants.length - a.applicants.length);
      default:
        return out.sort((a, b) => b.rewardValue - a.rewardValue);
    }
  }, [filtered, sort]);

  useEffect(() => {
    setPage(1);
  }, [query, category, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageItems = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const totalLocked = bounties.reduce((s, b) => s + b.rewardValue, 0);
  const totalApplicants = bounties.reduce((s, b) => s + b.applicants.length, 0);
  const biggest = sorted[0];

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Editorial hero */}
      <section className="relative overflow-hidden bg-[#0A0A0B] text-white">
        <div className="pointer-events-none absolute -left-32 -top-40 h-[460px] w-[460px] rounded-full bg-crimson/25 blur-[130px]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-[380px] w-[380px] rounded-full bg-amber-500/10 blur-[130px]" />
        <div
          className={`${SHELL} relative grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:py-20`}
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
              <ShieldCheck className="h-3.5 w-3.5 text-crimson" /> Escrow protected
            </span>
            <h1 className="mt-5 max-w-2xl text-[38px] font-black leading-[1.05] tracking-tight lg:text-[54px]">
              Paid work, held in escrow until it&apos;s actually done.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
              Browse every open bounty on Oventric — the reward, the deadline and how many builders
              are already competing for it. Rewards are shown in {currency}.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-7 flex max-w-xl items-center gap-2 rounded-[10px] border border-white/15 bg-white/10 px-3 py-2 backdrop-blur"
            >
              <Search className="h-4 w-4 shrink-0 text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search open bounties"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/40"
              />
              <span className="hidden rounded-[8px] bg-white px-3 py-1.5 text-xs font-black text-slate-900 sm:inline-block">
                {sorted.length} open
              </span>
            </form>

            <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { icon: WalletIcon, label: "Locked in escrow", value: formatMoney(totalLocked, currency) },
                { icon: Target, label: "Open bounties", value: bounties.length.toLocaleString() },
                { icon: Users, label: "Applications", value: totalApplicants.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <s.icon className="h-5 w-5 text-crimson" />
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                      {s.label}
                    </dt>
                    <dd className="text-xl font-black">{s.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* App handoff panel */}
          <aside className="w-full self-center rounded-[14px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur lg:justify-self-end">
            <div className="inline-flex items-center gap-2 rounded-full bg-crimson/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-crimson">
              <Lock className="h-3 w-3" /> Browse only on web
            </div>
            <h2 className="mt-4 text-xl font-black leading-snug">
              Posting and solving happen in the app
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Escrow funding, applications, contract chat and payouts are handled inside the Oventric
              app so money and delivery stay protected.
            </p>
            {biggest && (
              <div className="mt-5 rounded-[10px] border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                  Biggest open reward
                </p>
                <p className="mt-1.5 line-clamp-2 text-sm font-bold">{biggest.title}</p>
                <p className="mt-2 text-2xl font-black text-crimson">{biggest.displayFormatted}</p>
              </div>
            )}
            <button
              type="button"
              onClick={onGated}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-crimson text-sm font-black text-white transition-colors hover:bg-crimson/90"
            >
              <Smartphone className="h-4 w-4" /> Get the app to post or solve
            </button>
          </aside>
        </div>
      </section>

      {/* How escrow works */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className={`${SHELL} grid gap-6 py-10 md:grid-cols-3`}>
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-crimson/10 text-crimson">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Step {i + 1}
                </p>
                <h3 className="text-[15px] font-black text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Catalogue */}
      <section className={`${SHELL} grid gap-10 py-12 lg:grid-cols-[220px_minmax(0,1fr)]`}>
        {/* Filter rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Category
          </p>
          <div className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:items-start">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-[10px] px-3 py-2 text-left text-sm font-semibold transition-colors lg:w-full ${
                  category === c
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c === "all" ? "All bounties" : (CATEGORY_LABELS[c] ?? c)}
              </button>
            ))}
          </div>

          <p className="mt-8 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Sort
          </p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="mt-3 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="reward_desc">Highest reward</option>
            <option value="reward_asc">Lowest reward</option>
            <option value="ending">Ending soonest</option>
            <option value="applicants">Most applicants</option>
          </select>

          <div className="mt-8 rounded-[10px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">Want to take one on?</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Applications and escrow contracts run in the Oventric app.
            </p>
            <button
              type="button"
              onClick={onGated}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-crimson hover:underline"
            >
              Open in app <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* Grid */}
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              Open bounties
              <span className="ml-2 text-sm font-bold text-slate-400">{sorted.length}</span>
            </h2>
          </div>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 animate-pulse rounded-[12px] border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[12px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              {error}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-slate-300 bg-slate-50 p-14 text-center">
              <Target className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-4 text-lg font-black text-slate-900">No bounties match</h3>
              <p className="mt-1 text-sm text-slate-600">
                Try a different category or clear your search.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((b) => (
                <article
                  key={b.id}
                  className="group flex flex-col rounded-[12px] border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-crimson/40 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {CATEGORY_LABELS[b.category] ?? b.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <Clock className="h-3.5 w-3.5" /> {countdown(b.expiresAt - Date.now())}
                    </span>
                  </div>

                  <h3 className="mt-3 line-clamp-2 text-[16px] font-black leading-snug text-slate-900">
                    {b.title}
                  </h3>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Escrowed reward
                      </p>
                      <p className="text-2xl font-black text-slate-900">{b.displayFormatted}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      <Users className="h-3.5 w-3.5" /> {b.applicants.length}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Solver receives {formatMoney(b.rewardValue * 0.8, b.rewardCurrency)} on approval
                  </p>

                  <button
                    type="button"
                    onClick={onGated}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 text-sm font-black text-slate-700 transition-colors group-hover:border-crimson group-hover:bg-crimson group-hover:text-white"
                  >
                    <Lock className="h-4 w-4" /> Apply in the app
                  </button>
                </article>
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i + 1)}
                  className={`h-9 min-w-9 rounded-[10px] px-3 text-sm font-black transition-colors ${
                    current === i + 1
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
