import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import {
  TrendingUp,
  Users,
  Sparkles,
  Gift,
  Check,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Globe2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyAffiliateReservation, reserveAffiliateSpot } from "@/lib/affiliate.functions";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";

export const Route = createFileRoute("/affiliate")({
  head: () => ({
    meta: [
      { title: "Affiliate Program · Oventric" },
      {
        name: "description",
        content:
          "Reserve your spot in the upcoming Oventric Affiliate Program and earn recurring rewards for every referral.",
      },
      { property: "og:title", content: "Oventric Affiliate — Reserve Your Spot" },
      {
        property: "og:description",
        content:
          "Be first in line when Oventric's affiliate program launches. Refer, earn cashback, and grow your network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://oventric.com/affiliate" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/affiliate" }],
  }),
  component: AffiliatePage,
});

function AffiliatePage() {
  const router = useRouter();
  const navigate = useNavigate();
  const loadMine = useServerFn(getMyAffiliateReservation);
  const reserve = useServerFn(reserveAffiliateSpot);
  const loadProfile = useServerFn(getMyFullProfile);
  const { isAuthenticated } = useAuthGate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string>("");

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  const [state, setState] = useState<"loading" | "guest" | "none" | "reserved">("loading");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reservedAt, setReservedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setState("guest");
        return;
      }
      try {
        const mine = await loadMine();
        if (cancelled) return;
        if (mine) {
          setReservedAt(mine.createdAt);
          setState("reserved");
        } else {
          setState("none");
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load");
          setState("none");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMine]);

  useEffect(() => {
    if (typeof window === "undefined" || state === "loading") return;
    if (new URLSearchParams(window.location.search).get("reserve") !== "1") return;
    const el = document.getElementById("reserve-spot");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.querySelector("input")?.focus({ preventScroll: true });
  }, [state]);

  async function onReserve() {
    setSubmitting(true);
    setErr(null);
    try {
      const row = await reserve({ data: { note } });
      setReservedAt(row.createdAt);
      setState("reserved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reserve spot");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicChrome active="Affiliate">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6 md:text-slate-500"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/15 via-purple-700/10 to-transparent p-6 sm:p-10 mb-8">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-fuchsia-400/60" />
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/40 text-[10px] uppercase tracking-widest font-bold text-fuchsia-200 mb-4">
            <Sparkles className="w-3 h-3" /> Coming Soon
          </div>
          <h1 className="text-white text-3xl sm:text-4xl font-black tracking-tight leading-tight md:text-slate-900">
            Oventric Affiliate Program
          </h1>
          <p className="text-slate-300 mt-3 max-w-2xl text-sm sm:text-base leading-relaxed md:text-slate-600">
            Refer creators, sellers and learners to Oventric — and earn recurring rewards on every
            transaction they make. Reserve your spot now to be first in line when we launch.
          </p>

          <div className="mt-6" id="reserve-spot">
            {state === "loading" ? (
              <Loader2 className="w-5 h-5 animate-spin text-fuchsia-300" />
            ) : state === "reserved" ? (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm font-bold">
                <Check className="w-4 h-4" /> You have reserved your spot
                {reservedAt && (
                  <span className="text-[11px] font-normal text-emerald-300/80 ml-1">
                    · {new Date(reservedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : state === "guest" ? (
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-black text-sm font-black"
              >
                Sign in to reserve your spot
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional: how do you plan to promote Oventric?"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-400/60 md:border-slate-200"
                />
                <button
                  onClick={onReserve}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-60 text-black text-sm font-black inline-flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Reserve My Spot
                </button>
              </div>
            )}
            {err && (
              <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-2.5 max-w-xl">
                {err}
              </div>
            )}
          </div>
        </div>

        {/* Value grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            {
              icon: TrendingUp,
              title: "Recurring commissions",
              body: "Earn a share of every marketplace sale, course enrollment and bounty your referrals complete.",
            },
            {
              icon: Users,
              title: "Grow your circle",
              body: "Bring your audience with you. Every signup through your link is tied to your account for life.",
            },
            {
              icon: Gift,
              title: "Early-bird perks",
              body: "Reserved members get a higher launch commission tier and exclusive creator drops.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-[#141418] p-4 md:border-slate-200 md:bg-white"
            >
              <div className="w-9 h-9 rounded-[10px] bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300 mb-3">
                <f.icon className="w-4 h-4" />
              </div>
              <div className="text-white text-sm font-bold md:text-slate-900">{f.title}</div>
              <div className="text-xs text-slate-400 mt-1 leading-relaxed md:text-slate-500">
                {f.body}
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-white/10 bg-[#141418] p-5 sm:p-6 mb-8 md:border-slate-200 md:bg-white">
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3 md:text-slate-500">
            How it will work
          </div>
          <ol className="space-y-3">
            {[
              "Reserve your spot today — takes 5 seconds, no payment required.",
              "At launch, you get a unique referral link tied to your Oventric account.",
              "Share it anywhere. When someone signs up and transacts, you earn.",
              "Commissions land automatically in your Oventric wallet, ready to withdraw.",
            ].map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300 md:text-slate-600">
                <span className="w-6 h-6 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-200 text-xs font-black flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Trust row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-[#141418] p-4 flex items-start gap-3 md:border-slate-200 md:bg-white">
            <ShieldCheck className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
            <div>
              <div className="text-white text-sm font-bold md:text-slate-900">No spam, ever</div>
              <div className="text-xs text-slate-400 mt-0.5 md:text-slate-500">
                We'll only email you when the program is live and about your affiliate account.
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#141418] p-4 flex items-start gap-3 md:border-slate-200 md:bg-white">
            <Globe2 className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />
            <div>
              <div className="text-white text-sm font-bold md:text-slate-900">
                Built for NG, GH & global creators
              </div>
              <div className="text-xs text-slate-400 mt-0.5 md:text-slate-500">
                Payouts localized in NGN, GHS and USD — the same as your wallet.
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicChrome>
  );
}
