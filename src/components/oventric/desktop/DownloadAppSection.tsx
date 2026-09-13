import { Bell, Search, Filter, Wallet as WalletIcon, ChevronRight, User, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";


import homeIcon from "@/assets/home-3d.png.asset.json";
import walletIcon from "@/assets/wallet-3d.webp.asset.json";
import marketIcon from "@/assets/marketplace-3d.png.asset.json";
import academyIcon from "@/assets/academy-3d.png.asset.json";
import bountiesIcon from "@/assets/bounties-3d.webp.asset.json";
import circlesIcon from "@/assets/circles-3d.png.asset.json";

const CATEGORIES: { label: string; img: string; glow: string }[] = [
  { label: "Market", img: marketIcon.url, glow: "rgba(229,72,77,0.35)" },
  { label: "Academy", img: academyIcon.url, glow: "rgba(59,130,246,0.35)" },
  { label: "Bounties", img: bountiesIcon.url, glow: "rgba(245,158,11,0.35)" },
  { label: "Circles", img: circlesIcon.url, glow: "rgba(168,85,247,0.35)" },
  { label: "Wallet", img: walletIcon.url, glow: "rgba(16,185,129,0.35)" },
  { label: "Feed", img: homeIcon.url, glow: "rgba(236,72,153,0.35)" },
];

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

      <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-12 px-4 py-14 sm:px-6 lg:px-11 sm:py-20 lg:grid-cols-2 lg:py-24">
        {/* Copy + badges */}
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Free instant install
          </span>

          <h2 className="mt-5 text-3xl font-bold sm:text-4xl tracking-tight text-slate-900 lg:text-5xl">
            Get the Oventric <span className="text-emerald-600">app</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Your wallet, escrow checkout, chat, bounties and creator tools live in the app —
            install it free in seconds, priced in your home currency.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <InstallBadge />
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

        {/* Phone mockup — mirrors the live app home hub */}
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
            <div className="relative h-[520px] w-full overflow-hidden rounded-[2rem] bg-[#0A0A0B] p-3 pt-9 text-slate-200 lg:h-[540px]">
              <div className="app-sheen pointer-events-none absolute inset-0 z-10 rounded-[2rem]" />

              {/* Top bar */}
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-black tracking-tight text-white">
                  oventric
                  <span className="text-[#E5484D]">.</span>
                </span>
                <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-[#141416]">
                  <Bell className="h-3.5 w-3.5 text-white/70" strokeWidth={2} />
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#141416]">
                  <User className="h-3.5 w-3.5 text-white/70" strokeWidth={2.5} />
                </span>
              </div>

              {/* Greeting + wallet chip */}
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[8px] font-medium text-white/40">Good morning, Ada 👋</p>
                  <p className="mt-1 text-[15px] font-black leading-none tracking-tight text-white">
                    Discover more.
                  </p>
                  <p className="mt-1 text-[8px] font-medium text-white/35">Shop. Connect. Grow.</p>
                </div>
                <div className="w-[92px] shrink-0 rounded-[10px] border border-white/[0.08] bg-[#141416] p-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="truncate text-[6px] font-bold uppercase tracking-[0.12em] text-white/35">
                        Wallet
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-black tracking-tight text-white">
                        ₦248,900
                      </div>
                    </div>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                      <WalletIcon className="h-2.5 w-2.5 text-emerald-400" strokeWidth={2} />
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-0.5 text-[7px] font-bold text-emerald-400">
                    View wallet <ChevronRight className="h-2 w-2" />
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="mt-3 flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/25" />
                  <div className="h-8 w-full rounded-full border border-white/5 bg-[#141416] pl-7 pr-3 text-[8px] leading-8 text-white/25">
                    Search products, shops, people...
                  </div>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-[#141416]">
                  <Filter className="h-3 w-3 text-white/40" />
                </span>
              </div>

              {/* Hero promo card */}
              <div className="relative mt-3 overflow-hidden rounded-[10px] border border-white/5 bg-[#141416] p-3">
                <span
                  className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl"
                  style={{ background: "rgba(168,85,247,0.45)" }}
                />
                <span
                  className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full blur-2xl"
                  style={{ background: "rgba(229,72,77,0.35)" }}
                />
                <div className="relative">
                  <span className="inline-flex rounded-full bg-white/10 px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-widest text-white/70">
                    Featured
                  </span>
                  <p className="mt-1.5 text-[13px] font-black italic uppercase leading-[1.05] tracking-tight text-white">
                    Discover
                    <br />
                    Amazing Things
                  </p>
                  <p className="mt-1 text-[7.5px] font-medium text-white/50">
                    Curated drops from top Oventric sellers.
                  </p>
                  <span className="mt-2 inline-flex rounded-full bg-[#E5484D] px-2.5 py-1 text-[7px] font-bold text-white">
                    Explore now
                  </span>
                </div>
              </div>

              {/* Explore categories */}
              <div className="mt-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[9px] font-bold text-white">Explore Categories</span>
                  <span className="text-[7.5px] font-medium text-white/40">See all</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map((c) => (
                    <div
                      key={c.label}
                      className="relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-[10px] border border-white/5 bg-[#141416]"
                    >
                      <span
                        className="pointer-events-none absolute h-10 w-10 rounded-full blur-lg"
                        style={{ background: c.glow }}
                      />
                      <img
                        loading="lazy"
                        decoding="async"
                        src={c.img}
                        alt=""
                        className="relative h-6 w-6 object-contain"
                      />
                      <span className="relative text-[7px] font-semibold text-white/70">
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Featured rail teaser */}
              <div className="mt-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[9px] font-bold text-white">🔥 Featured This Week</span>
                  <span className="text-[7.5px] font-medium text-white/40">See all</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-[10px] border border-white/5 bg-gradient-to-b from-white/[0.06] to-transparent"
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
  return <ComingSoonBadge platform="iPhone" tone="dark" />;
}

function GooglePlayBadge() {
  return <ComingSoonBadge platform="Android" tone="crimson" delay="120ms" />;
}

function ComingSoonBadge({
  platform,
  tone,
  delay,
}: {
  platform: string;
  tone: "dark" | "crimson";
  delay?: string;
}) {
  return (
    <Link
      to="/get-app"
      aria-label={`Oventric for ${platform} — coming soon`}
      className={`app-badge-pop inline-flex h-12 items-center gap-3 rounded-xl px-4 text-left transition-transform hover:-translate-y-0.5 active:scale-95 ${
        tone === "dark" ? "bg-slate-900" : "bg-[#E5484D]"
      }`}
      style={delay ? { animationDelay: delay } : undefined}
    >
      <Sparkles className="h-6 w-6 text-white" />
      <div className="flex flex-col">
        <span className="text-[10px] leading-none text-white/70">Coming soon</span>
        <span className="text-base font-bold leading-none text-white">{platform} app</span>
      </div>
    </Link>
  );
}
