import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle, Sparkles, Wallet as WalletIcon } from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { verifyPayment } from "@/lib/payments.functions";
import { usdRate } from "@/lib/fx-display";
import { formatMoney as fmtMoney } from "@/lib/fx-display";

export const Route = createFileRoute("/payment/return")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Payment status — Oventric" },
      { name: "description", content: "We are confirming your Oventric payment and crediting your wallet or order." },
      { property: "og:title", content: "Payment status — Oventric" },
      { property: "og:description", content: "We are confirming your Oventric payment and crediting your wallet or order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    reference:
      typeof s?.reference === "string"
        ? s.reference
        : typeof s?.trxref === "string"
          ? s.trxref
          : "",
  }),
  component: PaymentReturnPage,
});

function formatMoney(usd: number, cur: string) {
  return fmtMoney(usd * usdRate(cur), cur);
}

function PaymentReturnPage() {
  const { reference } = Route.useSearch();
  const verify = useServerFn(verifyPayment);
  const navigate = useNavigate();
  const [state, setState] = useState<"verifying" | "ok" | "failed">("verifying");
  const [msg, setMsg] = useState<string>("");
  const [cashbackUSD, setCashbackUSD] = useState(0);
  const [displayCurrency, setDisplayCurrency] = useState<string>("USD");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!reference) {
      setState("failed");
      setMsg("Missing payment reference");
      return;
    }
    verify({ data: { reference } })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setCashbackUSD(Number(r.cashbackEarnedUSD ?? 0));
          setDisplayCurrency(r.displayCurrency ?? "USD");
          setRedirectTo(r.redirectTo ?? "/");
          setState("ok");
        } else {
          setState("failed");
          setMsg(`Payment ${r.status}`);
        }
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setState("failed");
        setMsg(e.message || "Verification failed");
      });
    return () => {
      cancelled = true;
    };
  }, [reference, verify]);

  const showSplash = state === "ok" && cashbackUSD > 0;

  // If no cashback earned, just redirect quickly on success.
  useEffect(() => {
    if (state !== "ok" || cashbackUSD > 0) return;
    const t = setTimeout(() => {
      navigate({ to: redirectTo ?? "/", replace: true });
    }, 900);
    return () => clearTimeout(t);
  }, [state, cashbackUSD, redirectTo, navigate]);

  return (
    <div className="page-light min-h-screen bg-[#121214] text-slate-200 overflow-x-hidden md:bg-white md:text-slate-800">
      <Header onOpenMessages={() => {}} forceSiteNavbar={!useIsAppShell()} />
      <main className="max-w-md mx-auto w-full px-4 py-24 text-center">
        {state === "verifying" && (
          <>
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-black text-white mb-1 md:text-slate-900">
              Confirming your payment…
            </h1>
            <p className="text-xs text-slate-500 font-mono break-all">{reference}</p>
          </>
        )}
        {state === "ok" && !showSplash && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-lg font-black text-white mb-1 md:text-slate-900">
              Payment confirmed
            </h1>
            <p className="text-sm text-slate-400 md:text-slate-500">Redirecting…</p>
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h1 className="text-lg font-black text-white mb-1 md:text-slate-900">
              Payment not completed
            </h1>
            <p className="text-sm text-slate-400 mb-4 md:text-slate-500">
              {msg || "You can try again from the checkout."}
            </p>
            <button
              onClick={() => navigate({ to: "/", replace: true })}
              className="px-4 py-2 rounded-[10px] bg-white/10 hover:bg-white/20 text-white text-sm font-bold md:bg-slate-100 md:text-slate-900"
            >
              Back to Home
            </button>
          </>
        )}
      </main>

      {showSplash && (
        <CashbackSplash
          amountLabel={formatMoney(cashbackUSD, displayCurrency)}
          onDone={() => navigate({ to: redirectTo ?? "/", replace: true })}
        />
      )}
    </div>
  );
}

/**
 * Lottery-style celebratory splash. Renders a full-screen colourful overlay
 * with the cashback amount, then flies the amount toward the top-right
 * (wallet/profile area) and fades out before continuing.
 */
function CashbackSplash({ amountLabel, onDone }: { amountLabel: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"reveal" | "fly" | "gone">("reveal");
  const amountRef = useRef<HTMLDivElement>(null);
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const t1 = setTimeout(() => {
      const el = amountRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const targetX = window.innerWidth - 48; // approx wallet/profile icon x
        const targetY = 40; // header row y
        const dx = targetX - (r.left + r.width / 2);
        const dy = targetY - (r.top + r.height / 2);
        setFlyStyle({ transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0 });
      }
      setPhase("fly");
    }, 2100);
    const t2 = setTimeout(() => {
      setPhase("gone");
      onDone();
    }, 3400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const colors = ["#60a5fa", "#60a5fa", "#f472b6", "#fbbf24", "#a78bfa", "#f87171"];
        return {
          i,
          left: Math.random() * 100,
          delay: Math.random() * 0.6,
          duration: 1.6 + Math.random() * 1.2,
          color: colors[i % colors.length],
          rotate: Math.random() * 360,
          size: 6 + Math.random() * 8,
        };
      }),
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, rgba(59, 130, 246,0.35), rgba(15,23,42,0.9) 55%, rgba(0,0,0,0.95))",
        animation: "cbFadeIn 220ms ease-out both",
      }}
      aria-live="polite"
      aria-label="Cashback earned"
    >
      {/* Confetti burst */}
      <div className="absolute inset-0 pointer-events-none">
        {confetti.map((c) => (
          <span
            key={c.i}
            style={{
              position: "absolute",
              left: `${c.left}%`,
              top: "-24px",
              width: `${c.size}px`,
              height: `${c.size * 0.4}px`,
              background: c.color,
              borderRadius: "2px",
              transform: `rotate(${c.rotate}deg)`,
              animation: `cbFall ${c.duration}s ${c.delay}s cubic-bezier(.2,.6,.4,1) forwards`,
              opacity: 0.95,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-[86%] max-w-sm rounded-3xl p-7 text-center border border-white/15 shadow-sm"
        style={{
          background:
            "linear-gradient(160deg, rgba(59, 130, 246,0.25), rgba(59,130,246,0.18) 55%, rgba(236,72,153,0.18))",
          backdropFilter: "blur(14px)",
          animation: "cbPop 480ms cubic-bezier(.2,1.4,.4,1) both",
        }}
      >
        <div
          className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #60a5fa, #3b82f6)",
            boxShadow: "0 10px 40px -6px rgba(59, 130, 246,0.7)",
          }}
        >
          <CheckCircle2 className="w-9 h-9 text-white md:text-slate-900" strokeWidth={2.5} />
        </div>

        <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-200 mb-2">
          <Sparkles className="w-3.5 h-3.5" /> Cashback Earned
        </div>

        <h2 className="text-xl font-black text-white mb-1 md:text-slate-900">
          Payment successful 🎉
        </h2>
        <p className="text-xs text-slate-200/80 mb-5">
          You just earned Oventric cashback on this purchase.
        </p>

        <div
          ref={amountRef}
          className="mx-auto inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-white text-xl sm:text-2xl font-black tracking-tight max-w-full md:text-slate-900"
          style={{
            background: "linear-gradient(135deg, rgba(96, 165, 250,0.35), rgba(96,165,250,0.35))",
            border: "1px solid rgba(255,255,255,0.25)",
            transition: "transform 900ms cubic-bezier(.6,.05,.15,1), opacity 900ms ease-in",
            willChange: "transform, opacity",
            ...flyStyle,
          }}
        >
          <WalletIcon className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="truncate">+ {amountLabel}</span>
        </div>

        <p className="mt-5 text-[11px] text-slate-300/70">
          {phase === "reveal" ? "Adding to your Cashback Wallet…" : "Sent to your wallet ✓"}
        </p>
      </div>

      <style>{`
        @keyframes cbFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cbPop {
          0% { transform: scale(0.6); opacity: 0 }
          60% { transform: scale(1.04); opacity: 1 }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes cbFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1 }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9 }
        }
      `}</style>
    </div>
  );
}
