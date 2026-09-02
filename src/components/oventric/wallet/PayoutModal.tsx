import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  HelpCircle,
  Eye,
  Landmark,
  Smartphone,
  Wallet as WalletIcon,
  Check,
  Plus,
  Info,
  ShieldCheck,
  Lock,
  Loader2,
  X,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import wallet3d from "@/assets/wallet-hero-3d.png.asset.json";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { currencySymbol, usdRate } from "@/lib/fx-display";
import {
  listMyRecipients,
  estimatePayoutFee,
  createLivePayout,
  createUsdPayoutRequest,
  type UsdPayoutChannel,
  type PayoutRecipientDTO,
  type TransferCurrency,
} from "@/lib/payouts.functions";
import { getWithdrawalPinStatus } from "@/lib/withdrawal-pin.functions";
import { AddMethodSheet, type MethodKind } from "./withdraw/AddMethodSheet";
import { PinSheet } from "./withdraw/PinSheet";

type MethodId = MethodKind | "usdt" | "trust" | "paypal";

const COMING_SOON: MethodId[] = ["usdt", "trust", "paypal"];

function money(v: number, sym: string) {
  return `${sym}${(Number(v) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Which saved recipient belongs to which UI method. */
function kindOf(r: PayoutRecipientDTO): MethodKind {
  if (r.method === "momo") return "momo";
  const n = r.bank_name ?? "";
  if (/opay/i.test(n)) return "opay";
  if (/momo|smartcash|9payment|money master|palmpay/i.test(n)) return "momo";
  return "bank";
}

export function PayoutModal({ onClose }: { onClose: () => void }) {
  const { balances, homeCurrency } = useOnboarding();
  const qc = useQueryClient();

  const currency: TransferCurrency = homeCurrency === "GHS" ? "GHS" : "NGN";
  const sym = currencySymbol(currency);
  const available = Number(balances[currency] ?? balances[homeCurrency] ?? 0);

  const recipientsFn = useServerFn(listMyRecipients);
  const feeFn = useServerFn(estimatePayoutFee);
  const payoutFn = useServerFn(createLivePayout);
  const pinStatusFn = useServerFn(getWithdrawalPinStatus);

  const recipientsQ = useQuery({
    queryKey: ["payout-recipients"],
    queryFn: () => recipientsFn(),
  });
  const pinQ = useQuery({ queryKey: ["withdrawal-pin-status"], queryFn: () => pinStatusFn() });

  const recipients = recipientsQ.data ?? [];
  const [selected, setSelected] = useState<MethodId>("bank");
  const [amountRaw, setAmountRaw] = useState("");
  const [addKind, setAddKind] = useState<MethodKind | null>(null);
  const [review, setReview] = useState(false);
  const [pinMode, setPinMode] = useState<"create" | "verify" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  /** "local" pays out in the user's home currency; "usd" converts to USD. */
  const [mode, setMode] = useState<"local" | "usd">("local");
  const [usdChannel, setUsdChannel] = useState<UsdPayoutChannel>("binance");
  const [usdIdentifier, setUsdIdentifier] = useState("");
  const [usdName, setUsdName] = useState("");
  const [usdNetwork, setUsdNetwork] = useState("TRC20");

  const rate = usdRate(currency);
  const availableUsd = rate > 0 ? available / rate : 0;
  const usdPayoutFn = useServerFn(createUsdPayoutRequest);

  const amount = Number(amountRaw.replace(/,/g, "")) || 0;

  const savedFor = useMemo(() => {
    const map: Partial<Record<MethodKind, PayoutRecipientDTO>> = {};
    for (const r of recipients) {
      const k = kindOf(r);
      if (!map[k]) map[k] = r;
    }
    return map;
  }, [recipients]);

  const activeRecipient = COMING_SOON.includes(selected) ? undefined : savedFor[selected as MethodKind];

  const feeQ = useQuery({
    queryKey: ["payout-fee", currency, activeRecipient?.method ?? "bank", amount],
    queryFn: () =>
      feeFn({ data: { currency, method: (activeRecipient?.method ?? "bank") as "bank" | "momo", amount } }),
    enabled: amount > 0,
  });
  const fee = feeQ.data?.fee ?? 0;
  const net = Math.max(0, amount - fee);

  const presets = currency === "NGN" ? [10000, 20000, 50000] : [100, 500, 1000];

  const methods: Array<{
    id: MethodId;
    label: string;
    icon: typeof Landmark;
    tint: string;
    desc: string[];
  }> = [
    {
      id: "bank",
      label: "Bank Transfer",
      icon: Landmark,
      tint: "bg-indigo-500/15 text-indigo-300 border-indigo-400/25",
      desc: savedFor.bank
        ? [`${savedFor.bank.bank_name} · ${savedFor.bank.account_number}`, savedFor.bank.account_name]
        : ["Add your local bank account"],
    },
    {
      id: "opay",
      label: "OPay Wallet",
      icon: WalletIcon,
      tint: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
      desc: savedFor.opay
        ? [savedFor.opay.account_number ?? "", savedFor.opay.account_name]
        : ["Link your OPay account"],
    },
    {
      id: "momo",
      label: "Mobile Money",
      icon: Smartphone,
      tint: "bg-amber-500/15 text-amber-300 border-amber-400/25",
      desc: savedFor.momo
        ? [
            `${savedFor.momo.momo_network ?? savedFor.momo.bank_name} · ${
              savedFor.momo.phone ?? savedFor.momo.account_number
            }`,
            savedFor.momo.account_name,
          ]
        : ["MTN MoMo & other African networks"],
    },
    {
      id: "usdt",
      label: "USDT (TRC20)",
      icon: WalletIcon,
      tint: "bg-teal-500/15 text-teal-300 border-teal-400/25",
      desc: ["Crypto payouts"],
    },
    {
      id: "trust",
      label: "Trust Wallet",
      icon: ShieldCheck,
      tint: "bg-sky-500/15 text-sky-300 border-sky-400/25",
      desc: ["Self-custody payouts"],
    },
    {
      id: "paypal",
      label: "PayPal",
      icon: WalletIcon,
      tint: "bg-blue-500/15 text-blue-300 border-blue-400/25",
      desc: ["International payouts"],
    },
  ];

  function selectMethod(id: MethodId) {
    if (COMING_SOON.includes(id)) return;
    setSelected(id);
    if (!savedFor[id as MethodKind]) setAddKind(id as MethodKind);
  }

  function openReview() {
    if (mode === "usd") {
      if (amount <= 0) return toast.error("Enter an amount to withdraw");
      if (amount > availableUsd) return toast.error("Amount exceeds your available balance");
      if (amount < 5) return toast.error("Minimum USD withdrawal is $5");
      if (usdIdentifier.trim().length < 4) return toast.error("Enter your account ID or wallet address");
      setReview(true);
      return;
    }
    if (!activeRecipient) {
      setAddKind(selected as MethodKind);
      return;
    }
    if (amount <= 0) return toast.error("Enter an amount to withdraw");
    if (amount > available) return toast.error("Amount exceeds your available balance");
    if (net <= 0) return toast.error("Amount is too small to cover the transfer fee");
    setReview(true);
  }

  /** PIN verified → publish the request. */
  function afterPin() {
    setPinMode(null);
    void submitPayout();
  }


  async function submitPayout() {
    if (submitting) return;
    if (mode === "local" && !activeRecipient) return;
    setSubmitting(true);
    try {
      if (mode === "usd") {
        const res = await usdPayoutFn({
          data: {
            channel: usdChannel,
            identifier: usdIdentifier.trim(),
            accountName: usdName.trim(),
            network: usdChannel === "wallet" ? usdNetwork : "",
            amountUsd: amount,
          },
        });
        setDone(
          `$${res.amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be sent to your ${USD_CHANNELS.find((c) => c.id === usdChannel)?.label}.`,
        );
      } else {
        await payoutFn({ data: { recipientId: activeRecipient!.id, amount } });
        setDone(`${money(net, sym)} will be sent to ${activeRecipient!.account_name}.`);
      }
      void qc.invalidateQueries();
      setReview(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#0A0A0B] flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-[#0A0A0B]/95 backdrop-blur border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={onClose} className="p-2 -ml-2 text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-black text-white">Withdraw Funds</h1>
          <span className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
            <HelpCircle className="w-4 h-4" />
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6 pt-4">
        {/* Balance card */}
        <div className="rounded-[10px] border border-[#E5484D]/25 bg-gradient-to-br from-[#17171C] to-[#101014] p-4 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                Available Balance <Eye className="w-3.5 h-3.5" />
              </div>
              <div className="text-[30px] leading-tight font-black text-white mt-1">
                {money(available, sym)}
              </div>
            </div>
            <img src={wallet3d.url} alt="" className="w-20 h-20 object-contain -mt-2 -mr-1" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-[10px] border border-white/8 bg-white/[0.03] p-3">
            <div>
              <div className="text-[11px] text-slate-500 font-bold">Withdrawable Now</div>
              <div className="text-sm font-black text-emerald-400">{money(available, sym)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-bold">On Hold / Locked</div>
              <div className="text-sm font-black text-white">{money(0, sym)}</div>
            </div>
          </div>
        </div>

        {/* Withdraw To */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white">Withdraw To</h2>
            <button
              onClick={() => setAddKind(COMING_SOON.includes(selected) ? "bank" : (selected as MethodKind))}
              className="text-xs font-bold text-[#E5484D] flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Method
            </button>
          </div>

          {methods.map((m) => {
            const soon = COMING_SOON.includes(m.id);
            const active = selected === m.id && !soon;
            return (
              <button
                key={m.id}
                onClick={() => selectMethod(m.id)}
                className={`w-full flex items-center gap-3 rounded-[10px] border p-3 text-left transition ${
                  active
                    ? "border-[#E5484D]/60 bg-[#E5484D]/[0.07]"
                    : "border-white/8 bg-white/[0.03]"
                } ${soon ? "opacity-50" : ""}`}
              >
                <span className={`w-11 h-11 rounded-[10px] border flex items-center justify-center ${m.tint}`}>
                  <m.icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black text-white">{m.label}</span>
                  {soon ? (
                    <span className="block text-[11px] text-slate-500">Coming soon</span>
                  ) : (
                    m.desc.filter(Boolean).map((d, i) => (
                      <span key={i} className="block text-[11px] text-slate-500 truncate">
                        {d}
                      </span>
                    ))
                  )}
                </span>
                {soon ? (
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 border border-white/10 rounded-full px-2 py-1">
                    Soon
                  </span>
                ) : active ? (
                  <span className="w-6 h-6 rounded-full bg-[#E5484D] flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border border-white/20" />
                )}
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <div className="space-y-3">
          <h2 className="text-base font-black text-white">Amount to Withdraw</h2>
          <div className="flex items-center gap-2 rounded-[10px] border border-[#E5484D]/50 bg-white/[0.03] px-4 py-3.5">
            <span className="text-xl font-black text-white">{sym}</span>
            <input
              inputMode="numeric"
              value={amountRaw}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setAmountRaw(digits ? Number(digits).toLocaleString("en-US") : "");
              }}
              placeholder="0"
              className="flex-1 bg-transparent text-xl font-black text-white outline-none"
            />
            {amountRaw && (
              <button onClick={() => setAmountRaw("")} className="text-slate-500">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmountRaw(p.toLocaleString("en-US"))}
                className={`py-2.5 rounded-[10px] border text-xs font-black ${
                  amount === p
                    ? "border-[#E5484D] text-[#E5484D] bg-[#E5484D]/10"
                    : "border-white/10 text-white bg-white/[0.03]"
                }`}
              >
                {sym}
                {p >= 1000 ? `${p / 1000}K` : p}
              </button>
            ))}
            <button
              onClick={() => setAmountRaw(Math.floor(available).toLocaleString("en-US"))}
              className="py-2.5 rounded-[10px] border border-white/10 text-white bg-white/[0.03] text-xs font-black"
            >
              Max
            </button>
          </div>

          <div className="flex gap-2 rounded-[10px] border border-sky-500/20 bg-sky-500/[0.07] p-3">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black text-white">Important</div>
              <p className="text-[11px] text-slate-400">
                Withdrawals are processed within 5 – 30 minutes during working hours.
              </p>
            </div>
          </div>

          <div className="rounded-[10px] border border-white/8 bg-white/[0.03] p-4 space-y-2.5">
            <div className="text-sm font-black text-white">Summary</div>
            <Row label="Amount" value={money(amount, sym)} />
            <Row label="Withdrawal Fee" value={money(fee, sym)} />
            <Row label="You will receive" value={money(net, sym)} strong />
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="shrink-0 bg-[#0A0A0B]/95 backdrop-blur border-t border-white/5 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <button
          onClick={openReview}
          disabled={submitting}
          className="w-full bg-[#E5484D] text-white font-black py-3.5 rounded-[10px] disabled:opacity-50"
        >
          Review Withdrawal
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mt-2">
          <Lock className="w-3 h-3" /> Secured by Oventric
        </div>
      </div>


      {addKind && (
        <AddMethodSheet
          kind={addKind}
          currency={currency}
          onClose={() => setAddKind(null)}
          onCreated={() => {
            setAddKind(null);
            void recipientsQ.refetch();
          }}
        />
      )}

      {review && activeRecipient && (
        <ReviewSheet
          sym={sym}
          amount={amount}
          fee={fee}
          net={net}
          recipient={activeRecipient}
          submitting={submitting}
          onClose={() => setReview(false)}
          onConfirm={() => setPinMode(pinQ.data?.hasPin ? "verify" : "create")}
        />
      )}

      {pinMode && (
        <PinSheet
          mode={pinMode}
          onClose={() => setPinMode(null)}
          onSuccess={() => {
            void pinQ.refetch();
            afterPin();
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-black ${strong ? "text-emerald-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

function ReviewSheet({
  sym,
  amount,
  fee,
  net,
  recipient,
  submitting,
  onClose,
  onConfirm,
}: {
  sym: string;
  amount: number;
  fee: number;
  net: number;
  recipient: PayoutRecipientDTO;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-[#0A0A0B] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
        <button onClick={onClose} className="p-2 -ml-2 text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-black text-white">Review Withdrawal</h1>
        <span className="w-9" />
      </div>

      <div className="p-4 space-y-4 pb-28">
        <div className="rounded-[10px] border border-white/8 bg-white/[0.03] p-4 space-y-3">
          <div className="text-sm font-black text-white">Review Details</div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-xs text-slate-400">Withdraw To</span>
            <span className="text-right">
              <span className="block text-sm font-black text-white">
                {recipient.method === "momo" ? "Mobile Money" : recipient.bank_name}
              </span>
              <span className="block text-[11px] text-slate-500">
                {recipient.momo_network ?? recipient.bank_name} ·{" "}
                {recipient.phone ?? recipient.account_number}
              </span>
              <span className="block text-[11px] text-slate-500">{recipient.account_name}</span>
            </span>
          </div>
          <div className="h-px bg-white/8" />
          <Row label="Amount" value={money(amount, sym)} />
          <Row label="Withdrawal Fee" value={money(fee, sym)} />
          <Row label="You will receive" value={money(net, sym)} strong />
          <Row label="Processing Time" value="5 - 30 mins" />
        </div>

        <div className="flex gap-2 rounded-[10px] border border-sky-500/20 bg-sky-500/[0.07] p-3">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black text-white">Secure Withdrawal</div>
            <p className="text-[11px] text-slate-400">
              Your funds are safe with bank-level security and encryption.
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-[#0A0A0B]/95 backdrop-blur border-t border-white/5 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="w-full bg-[#E5484D] text-white font-black py-3.5 rounded-[10px] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          <span>
            Confirm Withdrawal
            <span className="block text-[11px] font-semibold opacity-80">
              {money(net, sym)} will be sent
            </span>
          </span>
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mt-2">
          <Lock className="w-3 h-3" /> Secured by Oventric
        </div>
      </div>
    </div>
  );
}
