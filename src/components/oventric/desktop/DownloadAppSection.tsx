import {
  LayoutDashboard,
  Megaphone,
  Gift,
  BookOpen,
  LifeBuoy,
  Store,
  Plus,
  ArrowDownToLine,
  Target,
  User,
} from "lucide-react";

import homeIcon from "@/assets/home-3d.png.asset.json";
import walletIcon from "@/assets/wallet-3d.webp.asset.json";
import marketIcon from "@/assets/marketplace-3d.png.asset.json";
import academyIcon from "@/assets/academy-3d.png.asset.json";
import bountiesIcon from "@/assets/bounties-3d.webp.asset.json";
import circlesIcon from "@/assets/circles-3d.png.asset.json";
import messageIcon from "@/assets/message-3d.webp.asset.json";

type Tile = { label: string; img?: string; icon?: typeof LayoutDashboard };

const TILES: Tile[] = [
  { label: "Feed", img: homeIcon.url },
  { label: "Market", img: marketIcon.url },
  { label: "Academy", img: academyIcon.url },
  { label: "Bounties", img: bountiesIcon.url },
  { label: "Wallet", img: walletIcon.url },
  { label: "Circles", img: circlesIcon.url },
  { label: "Messages", img: messageIcon.url },
  { label: "Dash", icon: LayoutDashboard },
  { label: "Ads", icon: Megaphone },
  { label: "Affiliate", icon: Gift },
  { label: "Blog", icon: BookOpen },
  { label: "Help", icon: LifeBuoy },
];

const QUICK = [
  { label: "Sell", icon: Store },
  { label: "Post", icon: Plus },
  { label: "Fund", icon: ArrowDownToLine },
  { label: "Bounty", icon: Target },
] as const;

export function DownloadAppSection() {
  return (
    <section className="relative overflow-hidden border-y border-slate-200 bg-slate-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(600px 300px at 80% 20%, rgba(59, 130, 246,0.10), transparent 70%), radial-gradient(500px 250px at 10% 90%, rgba(99,102,241,0.08), transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-none grid-cols-1 items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-2 lg:py-24">
        {/* Copy + badges */}
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Oventric Mobile
          </span>

          <h2 className="mt-5 text-3xl font-bold sm:text-4xl tracking-tight text-slate-900 lg:text-5xl">
            Your fintech hub, <span className="text-emerald-600">in your pocket.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Download the app to manage your wallet, shop the marketplace, post bounties, and chat
            with your circles — all priced in your home currency.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <AppStoreBadge />
            <GooglePlayBadge />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Escrow-protected payments
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              54 African countries
            </span>
          </div>
        </div>

        {/* Phone mockup */}
        <div className="relative flex justify-center lg:justify-end">
          {/* Floating cards */}
          <div className="app-float-card absolute -left-4 top-8 z-30 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl md:block">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Cashback</p>
                <p className="text-sm font-bold text-slate-900">2% on every buy</p>
              </div>
            </div>
          </div>

          <div className="app-float-card app-float-card-delayed absolute -right-2 bottom-16 z-30 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl md:block">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">New message</p>
                <p className="text-sm font-bold text-slate-900">From a buyer</p>
              </div>
            </div>
          </div>

          {/* Phone frame */}
          <div className="app-mockup-float relative w-[260px] shrink-0 rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.35)] lg:w-[280px]">
            <div className="absolute left-1/2 top-0 z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-slate-900" />

            {/* Screen */}
            <div className="relative h-[520px] w-full overflow-hidden rounded-[2rem] bg-[#121214] p-3 pt-10 text-slate-200 lg:h-[540px]">
              <div className="app-sheen pointer-events-none absolute inset-0 z-10 rounded-[2rem]" />
              {/* Identity row */}
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E1E24] border border-white/10">
                  <User className="h-4 w-4 text-white" strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">
                    Good morning
                  </div>
                  <div className="truncate text-xs font-semibold text-white">Welcome back</div>
                </div>
                <span className="inline-flex h-6 items-center rounded-full bg-[#1E1E24] border border-white/10 px-2 text-[10px] font-semibold text-slate-200">
                  USD
                </span>
              </div>

              {/* Wallet card */}
              <div
                className="mt-3 rounded-2xl border border-emerald-500/25 p-3"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(59, 130, 246,0.22) 0%, rgba(20,20,26,0.95) 55%, rgba(20,20,26,1) 100%)",
                }}
              >
                <div className="text-[9px] uppercase tracking-wide text-emerald-300/80">
                  Main balance
                </div>
                <div className="mt-1 text-lg font-bold text-white tabular-nums">$0.00</div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {["Cashback", "Bounty", "Escrow"].map((l) => (
                    <div key={l} className="rounded-[10px] bg-[#1E1E24]/80 p-1 text-center">
                      <div className="text-[7px] text-slate-500">{l}</div>
                      <div className="text-[9px] font-semibold text-slate-200">—</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-1">
                  <span className="flex-1 rounded-xl bg-emerald-500 py-1.5 text-center text-[9px] font-bold text-[#08130f]">
                    Add
                  </span>
                  <span className="flex-1 rounded-xl border border-white/15 bg-[#1E1E24] py-1.5 text-center text-[9px] font-bold text-white">
                    Withdraw
                  </span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="mt-3 grid grid-cols-4 gap-1">
                {QUICK.map((q) => (
                  <div key={q.label} className="flex flex-col items-center gap-1">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1E1E24] border border-white/10">
                      <q.icon className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </span>
                    <span className="text-[8px] font-semibold text-slate-300">{q.label}</span>
                  </div>
                ))}
              </div>

              {/* Feature grid */}
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {TILES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <div key={t.label} className="flex flex-col items-center gap-1">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500/25 to-emerald-500/5 border border-white/10">
                        {t.img ? (
                          <img loading="lazy" decoding="async"
                            src={t.img}
                            alt=""
                            className="h-5 w-5 object-contain"
                          />
                        ) : Icon ? (
                          <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
                        ) : null}
                      </span>
                      <span className="text-[7px] font-semibold text-slate-300 text-center leading-none">
                        {t.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mini rail teaser */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold text-white">Fresh in the market</span>
                  <span className="text-[8px] font-semibold text-emerald-400">See all</span>
                </div>
                <div className="flex gap-2 overflow-hidden">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 w-20 shrink-0 rounded-xl bg-[#1E1E24] border border-white/10"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppStoreBadge() {
  return (
    <button
      type="button"
      onClick={() => {}}
      aria-label="Download Oventric on the App Store (coming soon)"
      className="app-badge-pop inline-flex h-12 items-center gap-3 rounded-xl bg-slate-900 px-4 text-left transition-transform hover:-translate-y-0.5 active:scale-95"
    >
      <svg className="h-7 w-7 fill-white" viewBox="0 0 384 512" aria-hidden>
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-48.7-22.7-84.5-22.7-46.9 0-105.6 29.8-130 82.3-52.5 113.1-13.5 279.6 37 354.7 24.9 36 55.2 76.5 94.5 75.1 38.4-1.5 53.1-24.8 99.7-24.8 46.6 0 60.1 24.8 100.3 24.1 40.5-.7 66.8-36.1 91.5-72.2 28.5-41.7 40.2-82.1 40.5-84.2-.9-.4-78.2-30.1-79.1-120.2zM273.1 89.6c20.4-24.8 33.8-59.2 30.1-93.6-29.9 1.2-66.1 20-87.5 45-18.4 21.2-34.7 56.4-30.4 89.6 33.8 2.6 67.4-16.2 87.8-41z" />
      </svg>
      <div className="flex flex-col">
        <span className="text-[10px] leading-none text-slate-400">Download on the</span>
        <span className="text-base font-bold leading-none text-white">App Store</span>
      </div>
    </button>
  );
}

function GooglePlayBadge() {
  return (
    <button
      type="button"
      onClick={() => {}}
      aria-label="Get Oventric on Google Play (coming soon)"
      className="app-badge-pop inline-flex h-12 items-center gap-3 rounded-xl bg-slate-900 px-4 text-left transition-transform hover:-translate-y-0.5 active:scale-95"
      style={{ animationDelay: "120ms" }}
    >
      <svg className="h-7 w-7 fill-white" viewBox="0 0 512 512" aria-hidden>
        <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-10.3 18-28.5-1.2-40.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
      </svg>
      <div className="flex flex-col">
        <span className="text-[10px] leading-none text-slate-400">Get it on</span>
        <span className="text-base font-bold leading-none text-white">Google Play</span>
      </div>
    </button>
  );
}
