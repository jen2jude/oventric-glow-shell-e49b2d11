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
import { createCryptoDeposit, getCryptoDeposit, estimateCryptoDeposit } from "@/lib/crypto-funding.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CRYPTO_METHODS = [
  "usdtbsc",
  "usdcbsc",
  "trx",
  "ltc",
  "sol",
  "eth",
  "bnbbsc",
  "usdttrc20",
  "usdterc20",
];

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

const localMethods = [
  {
    id: "bank",
    label: "Bank transfer",
    desc: "Transfer, USSD, Opay and other bank channels",
    icon: Landmark,
  },
  {
    id: "card",
    label: "Debit or credit card",
    desc: "Visa, Mastercard and Verve — funded instantly",
    icon: CreditCard,
  },
];

const cryptoMethods = [
  {
    id: "usdtbsc",
    label: "USDT (BEP20)",
    desc: "Stablecoin on BNB Smart Chain",
    icon: TetherIcon,
  },
  {
    id: "usdcbsc",
    label: "USDC (BEP20)",
    desc: "Stablecoin on BNB Smart Chain",
    icon: TetherIcon,
  },
  {
    id: "trx",
    label: "TRON (TRX)",
    desc: "Low network fees on Tron",
    icon: Bitcoin,
  },
  {
    id: "ltc",
    label: "Litecoin (LTC)",
    desc: "Fast confirmations, low fees",
    icon: Bitcoin,
  },
  {
    id: "sol",
    label: "Solana (SOL)",
    desc: "Instant confirmations, low fees",
    icon: Bitcoin,
  },
  {
    id: "eth",
    label: "Ethereum (ETH)",
    desc: "Pay from any Ethereum wallet",
    icon: Bitcoin,
  },
  {
    id: "bnbbsc",
    label: "BNB",
    desc: "BNB Smart Chain — low fees",
    icon: Bitcoin,
  },
  {
    id: "usdttrc20",
    label: "USDT (TRC20)",
    desc: "Stablecoin on Tron",
    icon: TetherIcon,
  },
  {
    id: "usdterc20",
    label: "USDT (ERC20)",
    desc: "Stablecoin on Ethereum",
    icon: TetherIcon,
  },
];

export function AddCapitalModal({ onClose }: { onClose: () => void }) {
  const { homeCurrency } = useOnboarding();
  const [method, setMethod] = useState<string>("bank");
  const [activeTab, setActiveTab] = useState<"local" | "crypto">("local");
  const [amountDisplay, setAmountDisplay] = useState<string>("5,000");
  const [loading, setLoading] = useState(false);
  const [depositId, setDepositId] = useState<string | null>(null);
  const startPayment = useServerFn(initPayment);
  const startCrypto = useServerFn(createCryptoDeposit);

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

  const activeMethods = activeTab === "local" ? localMethods : cryptoMethods;

  // Debounced amount so we don't hit the estimator on every keystroke.
  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), 500);
    return () => clearTimeout(t);
  }, [amount]);

  const estimateFn = useServerFn(estimateCryptoDeposit);
  const { data: estimateData, isFetching: estimating } = useQuery({
    queryKey: ["crypto-estimates", debouncedAmount, homeCurrency],
    queryFn: () => estimateFn({ data: { amount: debouncedAmount, currency: homeCurrency } }),
    // Keep polling briefly until every network returns a live quote.
    refetchInterval: (query) =>
      query.state.data && query.state.data.estimates.some((e) => e.payAmount === null) ? 4000 : false,
    enabled: activeTab === "crypto" && debouncedAmount > 0 && !depositId,
    staleTime: 60_000,
  });

  const estimateFor = (id: string) => estimateData?.estimates.find((e) => e.payCurrency === id);
  const formatCoin = (value: number) =>
    value >= 1 ? value.toFixed(value >= 100 ? 2 : 4) : value.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");

  const methodLabel = useMemo(() => {
    const all = [...localMethods, ...cryptoMethods];
    return all.find((m) => m.id === method)?.label ?? method;
  }, [method]);

  const handleContinue = async () => {
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (CRYPTO_METHODS.includes(method)) {
      setLoading(true);
      try {
        const deposit = await startCrypto({
          data: { amount, currency: homeCurrency, payCurrency: method },
        });
        setDepositId(deposit.id);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "";
        const tooSmall = /too small|minimum|amountTo/i.test(raw);
        toast.error(
          tooSmall
            ? "That amount is below the crypto network minimum. Use bank transfer or card for smaller top-ups, or raise the amount."
            : raw || "Could not start the crypto payment",
        );
      } finally {
        setLoading(false);
      }
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

  if (depositId) {
    return (
      <CryptoDepositScreen
        depositId={depositId}
        onBack={() => setDepositId(null)}
        onClose={onClose}
      />
    );
  }

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
            checkout.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <section>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("local");
                  setMethod("bank");
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === "local"
                    ? "bg-wallet-crimson text-wallet-on-crimson"
                    : "border border-wallet-line bg-wallet-panel text-wallet-copy hover:bg-wallet-muted"
                }`}
              >
                Bank / Card
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("crypto");
                  setMethod(cryptoMethods[0].id);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === "crypto"
                    ? "bg-wallet-crimson text-wallet-on-crimson"
                    : "border border-wallet-line bg-wallet-panel text-wallet-copy hover:bg-wallet-muted"
                }`}
              >
                Crypto
              </button>
            </div>

            <div className="mt-6">
              <h2 className="font-wallet-display text-lg font-semibold text-wallet-copy">
                {activeTab === "local" ? "Pay in your local currency" : "Pay with cryptocurrency"}
              </h2>
              <p className="mt-1 text-sm text-wallet-copy-muted">
                {activeTab === "local"
                  ? "All payments are processed on an encrypted checkout."
                  : "Pick a coin, send the exact amount shown, and your wallet is credited once confirmed."}
              </p>

              <div
                className={`mt-5 grid gap-px overflow-hidden rounded-[10px] border border-wallet-line bg-wallet-line ${
                  activeTab === "crypto" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"
                }`}
              >
                {activeMethods.map((m) => {
                  const Icon = m.icon;
                  const selected = method === m.id;
                  const est = activeTab === "crypto" ? estimateFor(m.id) : undefined;
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
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold text-wallet-copy">{m.label}</span>
                          {activeTab === "crypto" && amount > 0 && (
                            <span
                              className={`text-xs font-semibold ${
                                est?.belowMinimum ? "text-wallet-copy-muted" : "text-wallet-crimson"
                              }`}
                            >
                              {estimating && !est
                                ? "…"
                                : est?.payAmount
                                  ? `≈ ${formatCoin(est.payAmount)} ${m.label.split(" ")[0]}`
                                  : est
                                    ? "Quote unavailable — retrying…"
                                    : ""}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-wallet-copy-muted">
                          {est?.belowMinimum && est.minAmount
                            ? `Minimum is ${formatCoin(est.minAmount)} ${m.label.split(" ")[0]}${
                                est.minUsd ? ` (about $${est.minUsd.toFixed(2)})` : ""
                              } — raise the amount, or use bank transfer or card`
                            : m.desc}
                        </span>
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
                  <dd className="font-semibold text-wallet-copy">{methodLabel}</dd>
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

function CryptoDepositScreen({
  depositId,
  onBack,
  onClose,
}: {
  depositId: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const readDeposit = useServerFn(getCryptoDeposit);
  const [now, setNow] = useState(() => Date.now());

  const { data: deposit, isLoading } = useQuery({
    queryKey: ["crypto-deposit", depositId],
    queryFn: () => readDeposit({ data: { id: depositId } }),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "awaiting_payment" || s === "confirming" ? 10_000 : false;
    },
  });

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const remaining = deposit ? new Date(deposit.expiresAt).getTime() - now : 0;
  const countdown =
    remaining > 0
      ? `${String(Math.floor(remaining / 60000)).padStart(2, "0")}:${String(
          Math.floor((remaining % 60000) / 1000),
        ).padStart(2, "0")}`
      : "00:00";

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const status = deposit?.status ?? "awaiting_payment";
  const credited = status === "credited";
  const problem = status === "underpaid" || status === "expired" || status === "failed";

  return (
    <div className="wallet-shell fixed inset-0 z-[120] overflow-y-auto bg-wallet-canvas font-wallet-body">
      <header className="sticky top-0 z-10 border-b border-wallet-line bg-wallet-panel/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back"
            className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"
          >
            <ArrowLeft />
          </Button>
          <span className="font-wallet-display text-base font-semibold text-wallet-copy">Crypto payment</span>
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

      <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6">
        {isLoading || !deposit ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-wallet-copy-muted" />
          </div>
        ) : credited ? (
          <div className="rounded-2xl border border-wallet-line bg-wallet-panel p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-wallet-crimson" />
            <h1 className="mt-4 font-wallet-display text-2xl font-semibold text-wallet-copy">Wallet funded</h1>
            <p className="mt-2 text-sm text-wallet-copy-muted">
              Your payment is confirmed and your balance has been updated.
            </p>
            <Button
              onClick={onClose}
              className="mt-6 h-12 w-full bg-wallet-crimson text-wallet-on-crimson hover:bg-wallet-crimson-strong"
            >
              Back to wallet
            </Button>
          </div>
        ) : problem ? (
          <div className="rounded-2xl border border-wallet-line bg-wallet-panel p-8 text-center">
            <TriangleAlert className="mx-auto h-10 w-10 text-wallet-crimson" />
            <h1 className="mt-4 font-wallet-display text-2xl font-semibold text-wallet-copy">
              {status === "expired" ? "Payment window closed" : "This deposit needs review"}
            </h1>
            <p className="mt-2 text-sm text-wallet-copy-muted">
              {deposit.note ??
                (status === "expired"
                  ? "No payment arrived in time. You can start a new one."
                  : "We could not complete this payment automatically.")}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={onBack}
                className="h-12 w-full bg-wallet-crimson text-wallet-on-crimson hover:bg-wallet-crimson-strong"
              >
                Start a new payment
              </Button>
              <a
                href="/report-problem"
                className="text-sm text-wallet-copy-muted underline underline-offset-4"
              >
                Contact support about this deposit
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-wallet-line bg-wallet-panel p-6 sm:p-8">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-wallet-crimson">
              <ShieldCheck className="h-4 w-4" /> Send exactly this amount
            </div>
            <h1 className="font-wallet-display text-2xl font-semibold text-wallet-copy sm:text-3xl">
              {deposit.payAmount ?? "—"} {deposit.payCurrency.toUpperCase()}
            </h1>
            <p className="mt-2 text-sm text-wallet-copy-muted">
              Funds your wallet with {deposit.currency}{" "}
              {deposit.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (about $
              {deposit.usdAmount.toFixed(2)}).
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-[10px] border border-wallet-line bg-wallet-muted px-3 py-2 text-sm text-wallet-copy">
              <Clock className="h-4 w-4 text-wallet-copy-muted" />
              <span className="tabular-nums">{countdown}</span>
              <span className="text-wallet-copy-muted">left to send this payment</span>
            </div>

            {deposit.payAddress && (
              <div className="mt-6 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(deposit.payAddress)}`}
                  alt="Payment address QR code"
                  width={180}
                  height={180}
                  className="mx-auto rounded-[10px] border border-wallet-line bg-wallet-panel p-2"
                />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-wallet-copy-muted">
                    Payment address
                  </div>
                  <div className="mt-2 break-all rounded-[10px] border border-wallet-line bg-wallet-muted px-3 py-2 font-mono text-sm text-wallet-copy">
                    {deposit.payAddress}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => copy(deposit.payAddress ?? "", "Address")}
                      className="h-10 border-wallet-line bg-wallet-panel text-wallet-copy hover:bg-wallet-muted"
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy address
                    </Button>
                    {deposit.payAmount !== null && (
                      <Button
                        variant="outline"
                        onClick={() => copy(String(deposit.payAmount), "Amount")}
                        className="h-10 border-wallet-line bg-wallet-panel text-wallet-copy hover:bg-wallet-muted"
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copy amount
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-2 rounded-[10px] border border-wallet-line bg-wallet-muted px-3 py-3 text-sm text-wallet-copy-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status === "confirming"
                ? "Payment seen — waiting for network confirmations."
                : "Waiting for your payment. This page updates on its own."}
            </div>

            <p className="mt-4 text-xs text-wallet-copy-muted">
              Send only {deposit.payCurrency.toUpperCase()} to this address, and send the exact amount shown. Anything
              less is held for review instead of being credited.
            </p>

            <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-wallet-line pt-4 text-xs text-wallet-copy-muted">
              <Lock className="h-3.5 w-3.5" /> Encrypted and secured by Oventric
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
