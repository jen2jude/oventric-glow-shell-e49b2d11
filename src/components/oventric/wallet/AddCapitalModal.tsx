import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Landmark,
  CreditCard,
  Bitcoin,
  Lock,
  Check,
  X,
} from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useServerFn } from "@tanstack/react-start";
import { initPayment } from "@/lib/payments.functions";
import { toast } from "sonner";

const PRESETS = ["500", "1000", "5000", "10000"];

function formatNumberInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function parseAmount(formatted: string) {
  return Number(formatted.replace(/,/g, "")) || 0;
}

function TetherIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
      >
        T
      </text>
    </svg>
  );
}

export function AddCapitalModal({ onClose }: { onClose: () => void }) {
  const { homeCurrency } = useOnboarding();
  const [method, setMethod] = useState<string>("bank");
  const [amountDisplay, setAmountDisplay] = useState<string>("5,000");
  const [loading, setLoading] = useState(false);
  const startPayment = useServerFn(initPayment);

  const amount = parseAmount(amountDisplay);
  const symbol = useMemo(() => {
    if (homeCurrency === "NGN") return "₦";
    if (homeCurrency === "GHS") return "₵";
    if (homeCurrency === "USD") return "$";
    return "₦";
  }, [homeCurrency]);

  const methods = [
    {
      id: "bank",
      label: "Bank Transfer",
      desc: "Direct to your Oventric bank account",
      icon: Landmark,
      iconBg: "bg-indigo-500/20 text-indigo-300",
    },
    {
      id: "card",
      label: "Debit / Credit Card",
      desc: "Visa, Mastercard, Verve instant funding",
      icon: CreditCard,
      iconBg: "bg-amber-500/20 text-amber-300",
    },
    {
      id: "usdt",
      label: "USDT (TRC20)",
      desc: "Fund with USDT stablecoin",
      icon: TetherIcon,
      iconBg: "bg-emerald-500/20 text-emerald-300",
    },
    {
      id: "crypto",
      label: "Other Cryptocurrencies",
      desc: "BTC, ETH, USDC & more",
      icon: Bitcoin,
      iconBg: "bg-orange-500/20 text-orange-300",
    },
  ];

  const handlePreset = (v: string) => {
    setAmountDisplay(formatNumberInput(v));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountDisplay(formatNumberInput(e.target.value));
  };

  const clearAmount = () => setAmountDisplay("");

  const handleContinue = async () => {
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (method === "usdt" || method === "crypto") {
      toast("Crypto funding is coming soon.");
      return;
    }

    setLoading(true);
    try {
      const result = await startPayment({
        data: {
          purpose: "wallet_topup",
          amount,
          currency: homeCurrency,
          channel: method === "bank" ? "bank_transfer" : "card",
          returnTo: "/wallet",
        },
      });
      if (result?.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      } else {
        toast.error("Unable to start payment. Try again.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0A0A0B]">
      {/* Header */}
      <div className="relative flex h-14 shrink-0 items-center justify-center border-b border-white/5 px-4">
        <button
          onClick={onClose}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-white hover:bg-white/10"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-white">Add Funds</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Choose Payment Method
          </h2>
          <div className="space-y-3">
            {methods.map((m) => {
              const Icon = m.icon;
              const selected = method === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex w-full items-center gap-4 rounded-[16px] border bg-[#141418] p-4 text-left transition-all ${
                    selected
                      ? "border-purple-500/40 ring-1 ring-purple-500/30"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${m.iconBg}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">
                      {m.label}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {m.desc}
                    </div>
                  </div>
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                      selected
                        ? "bg-purple-500 text-white"
                        : "border-2 border-slate-600 bg-transparent"
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-white">Amount</h2>
          <div className="flex items-center gap-3 rounded-[16px] border border-white/5 bg-[#141418] px-4 py-4">
            <span className="text-xl font-bold text-slate-400">{symbol}</span>
            <input
              inputMode="numeric"
              value={amountDisplay}
              onChange={handleInputChange}
              placeholder="0"
              className="flex-1 bg-transparent text-2xl font-bold text-white outline-none placeholder:text-slate-600"
            />
            {amountDisplay && (
              <button
                onClick={clearAmount}
                className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300"
                aria-label="Clear amount"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {PRESETS.map((v) => {
              const formatted = formatNumberInput(v);
              const selected = amountDisplay === formatted;
              return (
                <button
                  key={v}
                  onClick={() => handlePreset(v)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? "bg-purple-600 text-white"
                      : "border border-white/10 bg-[#141418] text-slate-300 hover:border-white/20"
                  }`}
                >
                  {symbol}
                  {formatted}
                </button>
              );
            })}
          </div>
        </section>

        <button
          onClick={handleContinue}
          disabled={loading || amount <= 0}
          className="mt-8 w-full rounded-[14px] bg-gradient-to-r from-purple-600 to-indigo-600 py-4 text-base font-bold text-white shadow-lg shadow-purple-900/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Please wait..." : "Continue"}
        </button>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Lock className="h-3 w-3" />
          <span>Secured by Oventric</span>
        </div>
      </div>
    </div>
  );
}
