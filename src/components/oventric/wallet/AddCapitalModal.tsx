import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bitcoin,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useServerFn } from "@tanstack/react-start";
import { initPayment } from "@/lib/payments.functions";
import { createCryptoDeposit, getCryptoDeposit } from "@/lib/crypto-funding.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CRYPTO_METHODS = ["usdttrc20", "usdterc20"];

const PRESETS = ["500", "1000", "5000", "10000", "25000"];

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
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <text x="12" y="17.5" textAnchor="middle" fontSize="14" fontWeight="800">
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
    if (homeCurrency === "GHS") return "₵";
    if (homeCurrency === "USD") return "$";
    return "₦";
  }, [homeCurrency]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const methods = [
    {
      id: "bank",
      label: "Bank transfer",
      desc: "Transfer, USSD, Opay and other bank channels",
      icon: Landmark,
      soon: false,
    },
    {
      id: "card",
      label: "Debit or credit card",
      desc: "Visa, Mastercard and Verve — funded instantly",
      icon: CreditCard,
      soon: false,
    },
    {
      id: "usdt",
      label: "USDT (TRC20)",
      desc: "Stablecoin funding",
      icon: TetherIcon,
      soon: true,
    },
    {
      id: "crypto",
      label: "Other cryptocurrencies",
      desc: "BTC, ETH, USDC and more",
      icon: Bitcoin,
      soon: true,
    },
  ];

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
    <div
      className="wallet-shell fixed inset-0 z-[60] overflow-y-auto bg-wallet-canvas font-wallet-body text-wallet-copy"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-funds-title"
    >
      <header className="sticky top-0 z-10 border-b border-wallet-line bg-wallet-panel">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center gap-3 px-4 sm:px-6 lg:px-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Back to wallet"
            className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"
          >
            <ArrowLeft />
          </Button>
          <span className="font-wallet-display text-base font-semibold text-wallet-copy">Add funds</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"
          >
            <X />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 lg:px-10 lg:py-14">
        <div className="mb-8 border-b border-wallet-line pb-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-wallet-crimson">
            <ShieldCheck className="h-4 w-4" /> Secure funding
          </div>
          <h1 id="add-funds-title" className="font-wallet-display text-3xl font-semibold text-wallet-copy sm:text-4xl">
            Add money to your wallet
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-wallet-copy-muted sm:text-base">
            Choose how you want to pay, enter an amount in {homeCurrency}, and complete the payment on the secure
            checkout page.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <section>
            <h2 className="font-wallet-display text-lg font-semibold text-wallet-copy">Payment method</h2>
            <p className="mt-1 text-sm text-wallet-copy-muted">All payments are processed on an encrypted checkout.</p>

            <div className="mt-5 grid gap-px overflow-hidden rounded-[10px] border border-wallet-line bg-wallet-line sm:grid-cols-2">
              {methods.map((m) => {
                const Icon = m.icon;
                const selected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-start gap-3 p-5 text-left transition-colors ${
                      selected ? "bg-wallet-crimson-soft" : "bg-wallet-panel hover:bg-wallet-panel-raised"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
                        selected ? "bg-wallet-crimson text-wallet-on-crimson" : "bg-wallet-muted text-wallet-copy-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-wallet-copy">{m.label}</span>
                        {m.soon && (
                          <span className="rounded-md bg-wallet-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-wallet-copy-muted">
                            Soon
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-wallet-copy-muted">{m.desc}</span>
                    </span>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? "border-wallet-crimson bg-wallet-crimson text-wallet-on-crimson"
                          : "border-wallet-line-strong bg-transparent"
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-10 font-wallet-display text-lg font-semibold text-wallet-copy">Amount</h2>
            <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-wallet-line bg-wallet-panel px-4 py-4">
              <span className="font-wallet-display text-2xl font-semibold text-wallet-copy-muted">{symbol}</span>
              <input
                inputMode="numeric"
                value={amountDisplay}
                onChange={(e) => setAmountDisplay(formatNumberInput(e.target.value))}
                placeholder="0"
                aria-label={`Amount in ${homeCurrency}`}
                className="w-full flex-1 bg-transparent font-wallet-display text-3xl font-semibold tabular-nums text-wallet-copy outline-none placeholder:text-wallet-copy-faint"
              />
              {amountDisplay && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAmountDisplay("")}
                  aria-label="Clear amount"
                  className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"
                >
                  <X />
                </Button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((v) => {
                const formatted = formatNumberInput(v);
                const selected = amountDisplay === formatted;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmountDisplay(formatted)}
                    className={`rounded-[10px] border px-4 py-2 text-sm font-semibold tabular-nums transition-colors ${
                      selected
                        ? "border-wallet-crimson bg-wallet-crimson text-wallet-on-crimson"
                        : "border-wallet-line bg-wallet-panel text-wallet-copy hover:bg-wallet-muted"
                    }`}
                  >
                    {symbol}
                    {formatted}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[10px] border border-wallet-line bg-wallet-panel p-6">
              <h2 className="font-wallet-display text-base font-semibold text-wallet-copy">Summary</h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-wallet-copy-muted">Funding amount</dt>
                  <dd className="font-semibold tabular-nums text-wallet-copy">
                    {symbol}
                    {amountDisplay || "0"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-wallet-copy-muted">Method</dt>
                  <dd className="font-semibold text-wallet-copy">
                    {methods.find((m) => m.id === method)?.label}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-wallet-line pt-3">
                  <dt className="text-wallet-copy-muted">Credited to wallet</dt>
                  <dd className="font-wallet-display text-lg font-semibold tabular-nums text-wallet-copy">
                    {symbol}
                    {amountDisplay || "0"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-wallet-copy-muted">
                The payment provider may add its own processing fee at checkout. Your wallet is credited with the full
                amount above once payment is confirmed.
              </p>

              <Button
                onClick={handleContinue}
                disabled={loading || amount <= 0}
                className="mt-6 h-12 w-full bg-wallet-crimson text-wallet-on-crimson shadow-none hover:bg-wallet-crimson-strong"
              >
                {loading ? "Please wait…" : "Continue to payment"}
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                className="mt-2 h-11 w-full text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"
              >
                Cancel
              </Button>

              <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-wallet-line pt-4 text-xs text-wallet-copy-muted">
                <Lock className="h-3.5 w-3.5" /> Encrypted and secured by Oventric
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
