import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { AdvertInquiryModal } from "@/components/oventric/AdvertInquiryModal";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { getMyFullProfile } from "@/lib/profiles.functions";
import {
  Megaphone,
  Image as ImageIcon,
  Video,
  Sparkles,
  MapPin,
  Users,
  BarChart3,
  Target as TargetIcon,
  ShieldCheck,
  Rocket,
  ChevronRight,
  CheckCircle2,
  Activity,
  Eye,
  MousePointerClick,
  TrendingUp,
  Radio,
  Cpu,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: "Advertise on Oventric — Reach builders across Africa" },
      {
        name: "description",
        content:
          "Text, image, and video ad tiers from $0.50/day. Target every state in Nigeria, every region in Ghana, and the rest of Africa.",
      },
      { property: "og:title", content: "Advertise on Oventric" },
      {
        property: "og:description",
        content:
          "Text $0.50/day, Image $0.79/day, Video $0.99/day. City & state level targeting across Africa.",
      },
      { property: "og:url", content: "https://oventric.com/advertise" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/advertise" }],
  }),
  component: AdvertisePage,
});

const TIERS = [
  {
    id: "text",
    icon: Megaphone,
    name: "Text",
    tagline: "Lightest & cheapest",
    price: "$0.50",
    per: "/day min",
    color: "from-slate-500/20 to-slate-500/5",
    ring: "border-slate-500/40",
    features: [
      "Header + short description + body",
      "CTA: WhatsApp, Lead form, or Website link",
      "Great for lead-gen & fast tests",
    ],
  },
  {
    id: "image",
    icon: ImageIcon,
    name: "Image",
    tagline: "Most popular",
    price: "$0.79",
    per: "/day min",
    color: "from-emerald-500/25 to-emerald-500/5",
    ring: "border-emerald-500/60",
    features: [
      "1:1 image (fits Feed, Marketplace & Academy)",
      "Up to 5 images as a carousel",
      "Header, description & CTA included",
    ],
    highlight: true,
  },
  {
    id: "video",
    icon: Video,
    name: "Video",
    tagline: "Highest impact",
    price: "$0.99",
    per: "/day min",
    color: "from-purple-500/25 to-purple-500/5",
    ring: "border-purple-500/40",
    features: [
      "Up to 5 min video, 100 MB max",
      "Header + description + body + CTA",
      "Autoplay in Feed & Discovery rail",
    ],
  },
];

const NG_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT (Abuja)",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

const GH_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

const REST_OF_AFRICA = [
  "Kenya",
  "South Africa",
  "Egypt",
  "Morocco",
  "Ethiopia",
  "Uganda",
  "Tanzania",
  "Rwanda",
  "Senegal",
  "Côte d'Ivoire",
  "Cameroon",
  "Zambia",
  "Zimbabwe",
  "Angola",
  "Algeria",
  "Tunisia",
  "DR Congo",
  "Botswana",
  "Namibia",
  "Mozambique",
];

const COVERAGE = [
  { country: "🇳🇬 Nigeria — all 36 states + FCT", cities: NG_STATES },
  { country: "🇬🇭 Ghana — all 16 regions", cities: GH_REGIONS },
  { country: "🌍 Rest of Africa (USD)", cities: REST_OF_AFRICA },
];

const STEPS = [
  {
    icon: Rocket,
    title: "Pick a tier",
    body: "Text, image, or video — you choose the level of impact.",
  },
  {
    icon: ImageIcon,
    title: "Send your creative",
    body: "Upload copy, images, and video specs through our secure form.",
  },
  {
    icon: TargetIcon,
    title: "Target audience",
    body: "Choose countries, states/regions, duration and daily budget.",
  },
  {
    icon: ShieldCheck,
    title: "Admin reviews",
    body: "Our team contacts you to finalise creative, pricing and go-live date.",
  },
  {
    icon: BarChart3,
    title: "Fund & launch",
    body: "Fund your wallet with the exact campaign total. Ad goes live on approval.",
  },
];

/* ---------------- Live-looking Ads Dashboard preview ---------------- */

const ALGO_LINES = [
  "▸ scoring 12,481 candidates for placement=feed",
  "▸ geo-match: NG · Lagos → boost ×1.4",
  "▸ tier=image · CPM $0.79 · pacing OK",
  "▸ freq-cap: 3/user/day · fresh impression ✓",
  "▸ ranker: relevance 0.87 · budget-left 92%",
  "▸ serving creative #2 (carousel · 1080²)",
  "▸ event: impression · session s_9be2",
  "▸ ranker: relevance 0.91 · pacing accel",
  "▸ geo-match: GH · Accra → boost ×1.2",
  "▸ tier=video · CPM $0.99 · autoplay ready",
  "▸ event: click · placement=marketplace",
  "▸ retarget bucket: r_hot · size 3,412",
  "▸ delivery smoothing: 84 imp/min",
  "▸ safe-brand filter: pass ✓",
  "▸ event: lead · form=email+whatsapp",
];

function useTicker() {
  const [t, setT] = useState({ imp: 12480, clk: 318, ld: 41, spend: 47.2 });
  useEffect(() => {
    const id = setInterval(() => {
      setT((p) => ({
        imp: p.imp + Math.floor(20 + Math.random() * 55),
        clk: p.clk + (Math.random() > 0.55 ? 1 : 0),
        ld: p.ld + (Math.random() > 0.9 ? 1 : 0),
        spend: +(p.spend + 0.12 + Math.random() * 0.28).toFixed(2),
      }));
    }, 1400);
    return () => clearInterval(id);
  }, []);
  return t;
}

function useAlgoFeed() {
  const [rows, setRows] = useState<string[]>(ALGO_LINES.slice(0, 6));
  useEffect(() => {
    const id = setInterval(() => {
      setRows((r) => {
        const next = ALGO_LINES[Math.floor(Math.random() * ALGO_LINES.length)];
        return [next, ...r].slice(0, 8);
      });
    }, 1100);
    return () => clearInterval(id);
  }, []);
  return rows;
}

function LiveDashboardPreview() {
  const t = useTicker();
  const rows = useAlgoFeed();
  const ctr = t.imp ? ((t.clk / t.imp) * 100).toFixed(2) : "0";
  const cpm = t.imp ? ((t.spend / t.imp) * 1000).toFixed(2) : "0";

  const stats = [
    {
      icon: Eye,
      label: "Impressions",
      value: t.imp.toLocaleString(),
      tint: "text-sky-300",
      ring: "border-sky-500/30",
    },
    {
      icon: MousePointerClick,
      label: "Clicks",
      value: t.clk.toLocaleString(),
      tint: "text-emerald-300",
      ring: "border-emerald-500/30",
    },
    {
      icon: Users,
      label: "Leads",
      value: t.ld.toString(),
      tint: "text-fuchsia-300",
      ring: "border-fuchsia-500/30",
    },
    {
      icon: TrendingUp,
      label: "Spend",
      value: `$${t.spend.toFixed(2)}`,
      tint: "text-amber-300",
      ring: "border-amber-500/30",
    },
  ];

  return (
    <section className="mt-14">
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
          <Activity className="w-3.5 h-3.5" /> Live dashboard preview
        </span>
        <h2 className="mt-3 text-2xl md:text-3xl font-black text-white md:text-slate-900">
          See the algorithm work in real time
        </h2>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl mx-auto md:text-slate-500">
          A peek at the ranker that powers your ads — targeting, pacing, frequency capping and event
          tracking, all running live.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d0d10] overflow-hidden shadow-[0_0_0_1px_rgba(59, 130, 246,0.06)] md:border-slate-200 md:bg-slate-50">
        {/* fake window chrome */}
        <div className="flex items-center gap-2 px-4 h-9 border-b border-white/10 bg-[#141418] md:border-slate-200 md:bg-white">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <div className="ml-3 text-[11px] text-slate-500 font-mono">ads.oventric.com/live</div>
          <div className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 p-4">
          {/* KPIs + funnel */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className={`p-3 rounded-xl bg-[#141418] md:bg-white border ${s.ring}`}
                >
                  <div className="flex items-center justify-between">
                    <s.icon className={`w-4 h-4 ${s.tint}`} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className={`mt-2 text-xl font-black ${s.tint} tabular-nums`}>{s.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* funnel bars */}
            <div className="p-4 rounded-xl bg-[#141418] border border-white/10 md:bg-white md:border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 md:text-slate-600">
                <Layers className="w-4 h-4 text-emerald-400" /> Delivery funnel
                <span className="ml-auto text-[10px] text-slate-500">
                  CTR {ctr}% · CPM ${cpm}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { k: "Auction eligible", v: 100, c: "bg-sky-500/70" },
                  { k: "Passed targeting", v: 74, c: "bg-emerald-500/70" },
                  { k: "Frequency-safe", v: 58, c: "bg-fuchsia-500/70" },
                  { k: "Served (impressions)", v: 46, c: "bg-amber-400/80" },
                  { k: "Engaged (clicks)", v: 12, c: "bg-white/60" },
                ].map((r) => (
                  <div key={r.k}>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 md:text-slate-500">
                      <span>{r.k}</span>
                      <span className="tabular-nums">{r.v}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/5 overflow-hidden md:bg-slate-100">
                      <div
                        className={`h-full ${r.c} transition-all duration-700`}
                        style={{ width: `${r.v}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sparkline placeholder */}
            <div className="p-4 rounded-xl bg-[#141418] border border-white/10 md:bg-white md:border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 md:text-slate-600">
                <Radio className="w-4 h-4 text-emerald-400" /> Impressions / minute
                <span className="ml-auto text-[10px] text-emerald-300">
                  +{Math.floor(60 + Math.random() * 40)} last min
                </span>
              </div>
              <svg viewBox="0 0 400 80" className="w-full h-20 mt-3">
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,60 L30,52 L60,58 L90,40 L120,45 L150,30 L180,38 L210,22 L240,28 L270,18 L300,24 L330,12 L360,18 L400,8 L400,80 L0,80 Z"
                  fill="url(#g1)"
                />
                <path
                  d="M0,60 L30,52 L60,58 L90,40 L120,45 L150,30 L180,38 L210,22 L240,28 L270,18 L300,24 L330,12 L360,18 L400,8"
                  fill="none"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>

          {/* Algorithm log */}
          <div className="p-4 rounded-xl bg-black/50 border border-emerald-500/20 font-mono text-[11px] leading-relaxed text-emerald-200 min-h-[280px]">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold not-italic mb-2">
              <Cpu className="w-4 h-4" /> ranker.log
              <span className="ml-auto inline-flex items-center gap-1 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> streaming
              </span>
            </div>
            <div className="space-y-1">
              {rows.map((r, i) => (
                <div
                  key={`${r}-${i}`}
                  className={i === 0 ? "text-emerald-300" : "text-emerald-200/70"}
                >
                  <span className="text-slate-500">
                    [{new Date().toLocaleTimeString([], { hour12: false })}]
                  </span>{" "}
                  {r}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 text-center mt-3">
        Illustrative preview. Your Ads Manager shows your campaign's real numbers once live.
      </p>
    </section>
  );
}

function useSimplifyAdvertise() {
  const [simple, setSimple] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      if (document.documentElement.classList.contains("low-gpu")) return true;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const narrow = window.matchMedia("(max-width: 1023px)").matches;
      return coarse || narrow;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const mq1 = window.matchMedia("(pointer: coarse)");
    const mq2 = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      setSimple(
        document.documentElement.classList.contains("low-gpu") || mq1.matches || mq2.matches,
      );
    };
    update();
    mq1.addEventListener?.("change", update);
    mq2.addEventListener?.("change", update);
    return () => {
      mq1.removeEventListener?.("change", update);
      mq2.removeEventListener?.("change", update);
    };
  }, []);
  return simple;
}

function AdvertisePage() {
  const [open, setOpen] = useState(false);
  const [presetTier, setPresetTier] = useState<"text" | "image" | "video">("image");
  const simple = useSimplifyAdvertise();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("start");
    if (raw === "text" || raw === "image" || raw === "video") {
      setPresetTier(raw);
      setOpen(true);
    }
  }, []);

  const start = (tier: "text" | "image" | "video" = "image") => {
    setPresetTier(tier);
    setOpen(true);
  };

  return (
    <PublicChrome active="Advertise">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:py-14">
        {/* Hero */}
        <section className="text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Advertise on Oventric
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-black text-white leading-tight md:text-slate-900">
            Put your brand in front of
            <br className="hidden md:block" /> builders across Africa
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-slate-400 md:text-slate-500">
            From <span className="text-emerald-300 font-bold">$0.50/day</span>. Three simple ad
            tiers, transparent pricing, state-level targeting in Nigeria & Ghana plus the rest of
            Africa — wallet-funded budgets, no auctions.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => start("image")}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black rounded-full inline-flex items-center gap-2"
            >
              Explore & Get Started <ChevronRight className="w-4 h-4" />
            </button>
            <a
              href="#tiers"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold rounded-full md:bg-slate-100 md:hover:bg-slate-200 md:border-slate-200 md:text-slate-900"
            >
              See ad tiers
            </a>
          </div>
        </section>

        {/* Quick stats */}
        <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Users, k: "10k+", v: "Active builders" },
            { icon: MapPin, k: "53+", v: "States & regions targeted" },
            { icon: BarChart3, k: "3", v: "Placements: Feed, Market, Academy" },
            { icon: ShieldCheck, k: "24h", v: "Avg admin review" },
          ].map((s) => (
            <div
              key={s.v}
              className="p-4 rounded-2xl bg-[#141418] border border-white/10 text-center md:bg-white md:border-slate-200"
            >
              <s.icon className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
              <div className="text-lg font-black text-white md:text-slate-900">{s.k}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">{s.v}</div>
            </div>
          ))}
        </section>

        {/* Tiers */}
        <section id="tiers" className="mt-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white md:text-slate-900">
              Three tiers. One goal.
            </h2>
            <p className="text-sm text-slate-400 mt-2 md:text-slate-500">
              Choose the format that fits your budget and message.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={`relative p-6 rounded-2xl ${simple ? "bg-[#141418] md:bg-white" : `bg-gradient-to-b ${t.color}`} border ${t.ring} flex flex-col`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider">
                    Popular
                  </span>
                )}
                <t.icon className="w-8 h-8 text-white md:text-slate-900" />
                <div className="mt-4 text-xs uppercase tracking-wider text-slate-400 font-bold md:text-slate-500">
                  {t.tagline}
                </div>
                <div className="text-2xl font-black text-white mt-1 md:text-slate-900">
                  {t.name} ads
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white md:text-slate-900">
                    {t.price}
                  </span>
                  <span className="text-xs text-slate-400 md:text-slate-500">{t.per}</span>
                </div>
                <ul className="mt-4 space-y-2 flex-1">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs text-slate-300 md:text-slate-600"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => start(t.id as "text" | "image" | "video")}
                  className="mt-5 w-full h-11 rounded-full bg-white/5 hover:bg-emerald-500 hover:text-black border border-white/10 text-white text-xs font-black transition-colors md:bg-slate-100 md:border-slate-200"
                >
                  Start with {t.name}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 text-center mt-4">
            Prices are daily minimums. Total = daily budget × duration. Admin confirms final quote
            before you fund.
          </p>
        </section>

        {/* Live dashboard — desktop / high-gpu only (heavy tickers + gradients) */}
        {!simple && <LiveDashboardPreview />}

        {/* Coverage */}
        <section className="mt-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white md:text-slate-900">
              Where your ads run
            </h2>
            <p className="text-sm text-slate-400 mt-2 md:text-slate-500">
              Every state in Nigeria, every region in Ghana, plus the rest of Africa.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {COVERAGE.map((c) => (
              <div
                key={c.country}
                className="p-5 rounded-2xl bg-black border border-white/10 md:border-slate-200"
              >
                <div className="text-lg font-black text-white md:text-slate-900">{c.country}</div>
                <div className="mt-3 flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                  {c.cities.map((city) => (
                    <span
                      key={city}
                      className="px-2.5 py-1 rounded-full bg-black border border-white/20 text-white text-[11px] font-medium"
                    >
                      {city}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white md:text-slate-900">
              How it works
            </h2>
            <p className="text-sm text-slate-400 mt-2 md:text-slate-500">
              Simple, transparent, and fully human-reviewed.
            </p>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="p-4 rounded-2xl bg-[#141418] border border-white/10 md:bg-white md:border-slate-200"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/40 grid place-items-center text-emerald-300 text-xs font-black">
                  {i + 1}
                </div>
                <s.icon className="w-5 h-5 text-white mt-3 md:text-slate-900" />
                <div className="mt-2 text-sm font-bold text-white md:text-slate-900">{s.title}</div>
                <div className="text-xs text-slate-400 mt-1 leading-relaxed md:text-slate-500">
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Specs */}
        <section className="mt-14 p-6 rounded-2xl bg-[#141418] border border-white/10 md:bg-white md:border-slate-200">
          <h2 className="text-xl font-black text-white md:text-slate-900">Creative specs</h2>
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-xs text-slate-300 md:text-slate-600">
            <div>
              <div className="text-sm font-bold text-emerald-300">Image</div>
              <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400 md:text-slate-500">
                <li>Aspect ratio: 1:1 (square)</li>
                <li>Recommended: 1080 × 1080 px</li>
                <li>Formats: JPG, PNG, WEBP</li>
                <li>Max file size: 5 MB per image</li>
                <li>Up to 5 images per carousel</li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-300">Video</div>
              <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400 md:text-slate-500">
                <li>Duration: up to 5 minutes</li>
                <li>Max size: 100 MB (MP4 / WEBM)</li>
                <li>Aspect ratio: 1:1 or 9:16</li>
                <li>Resolution: 1080p recommended</li>
                <li>Or paste a public YouTube / Vimeo link</li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-300">Copy</div>
              <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400 md:text-slate-500">
                <li>Header: up to 60 characters</li>
                <li>Description: up to 140 characters</li>
                <li>Body (video/text): up to 500 characters</li>
                <li>CTA options: WhatsApp, Lead form, Website</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          className={`mt-14 text-center p-8 rounded-2xl border ${simple ? "bg-[#141418] md:bg-white border-white/10 md:border-slate-200" : "bg-gradient-to-br from-emerald-500/15 to-transparent border-emerald-500/30"}`}
        >
          <h2 className="text-2xl md:text-3xl font-black text-white md:text-slate-900">
            Ready to launch your first campaign?
          </h2>
          <p className="text-sm text-slate-300 mt-2 max-w-lg mx-auto md:text-slate-600">
            Submit your brief in under 3 minutes. Our team gets back to you within 24 hours to
            confirm pricing and go live.
          </p>
          <button
            onClick={() => start("image")}
            className="mt-6 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black rounded-full inline-flex items-center gap-2"
          >
            Explore & Get Started <ChevronRight className="w-4 h-4" />
          </button>
        </section>
      </div>

      <AdvertInquiryModal open={open} onClose={() => setOpen(false)} initialTier={presetTier} />
    </PublicChrome>
  );
}
