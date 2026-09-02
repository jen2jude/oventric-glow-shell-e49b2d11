import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Search, User2 } from "lucide-react";
import { ModalShell, currencyMeta } from "@/components/oventric/wallet/shared";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import {
  searchTransferRecipients,
  transferToUser,
  type TransferRecipientDTO,
} from "@/lib/wallet.functions";
import { currencyDecimals } from "@/lib/currency/africa";
import { formatMoney } from "@/lib/fx-display";

type Step = "recipient" | "amount" | "confirm" | "result";

export function TransferModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { balances, homeCurrency } = useOnboarding();
  const search = useServerFn(searchTransferRecipients);
  const doTransfer = useServerFn(transferToUser);

  const [step, setStep] = useState<Step>("recipient");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TransferRecipientDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<TransferRecipientDTO | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const available = balances[homeCurrency] ?? 0;
  const sym = currencyMeta[homeCurrency].symbol;
  const numericAmount = Number(amount);

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      search({ data: { query: q } })
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, search]);

  const submit = async () => {
    if (!recipient || !(numericAmount > 0)) return;
    setBusy(true);
    try {
      const res = await doTransfer({
        data: {
          recipientId: recipient.userId,
          currency: homeCurrency,
          amount: numericAmount,
          note: note || undefined,
        },
      });
      setResult({
        ok: true,
        message: `Sent ${formatMoney(numericAmount, homeCurrency)} to ${res.recipient_name}.`,
      });
      setStep("result");
      onDone();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Transfer failed." });
      setStep("result");
    } finally {
      setBusy(false);
    }
  };

  if (step === "result" && result) {
    return (
      <ModalShell title={result.ok ? "Transfer Sent" : "Transfer Failed"} onClose={onClose}>
        <div className="text-center py-4">
          <div
            className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${result.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}
          >
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <p className="text-sm text-slate-200 md:text-slate-700">{result.message}</p>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 text-sm"
        >
          Done
        </button>
      </ModalShell>
    );
  }

  if (step === "recipient") {
    return (
      <ModalShell title="Send to User" onClose={onClose}>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username or name…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#222226] md:border-slate-200 bg-[#0A0A0C] md:bg-white text-sm text-white md:text-slate-900 outline-none focus:border-fuchsia-500/50"
          />
        </div>
        <div className="space-y-1.5 min-h-[80px]">
          {searching && (
            <div className="text-xs text-slate-500 py-3 inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </div>
          )}
          {!searching && q.trim().length >= 2 && results.length === 0 && (
            <div className="text-xs text-slate-500 py-2">No matching users.</div>
          )}
          {results.map((r) => (
            <button
              key={r.userId}
              onClick={() => {
                setRecipient(r);
                setStep("amount");
              }}
              className="w-full flex items-center gap-3 rounded-xl border border-[#222226] md:border-slate-200 bg-[#0A0A0C] md:bg-white p-3 text-left hover:border-fuchsia-500/50"
            >
              <div className="w-9 h-9 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center shrink-0">
                <User2 className="w-4 h-4 text-fuchsia-300" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white md:text-slate-900 truncate">
                  {r.displayName ?? r.username ?? "User"}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  @{r.username ?? "unknown"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ModalShell>
    );
  }

  if (step === "amount" && recipient) {
    const step_ = currencyDecimals(homeCurrency) === 2 ? "0.01" : "1";
    return (
      <ModalShell title={`Send to @${recipient.username ?? "user"}`} onClose={onClose}>
        <button
          onClick={() => setStep("recipient")}
          className="text-[11px] text-slate-400 uppercase tracking-wider"
        >
          ← Change recipient
        </button>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            Amount ({homeCurrency})
          </label>
          <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl border border-[#222226] md:border-slate-200 bg-[#0A0A0C] md:bg-white focus-within:border-fuchsia-500/60">
            <span className="px-3 text-slate-400 text-sm">{sym}</span>
            <input
              type="number"
              min={0}
              step={step_}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent py-2.5 pr-3 text-sm text-white md:text-slate-900 outline-none tabular-nums"
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Available: {formatMoney(available, homeCurrency)}
          </div>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            Note (optional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="What's this for?"
            className="mt-1 w-full rounded-xl border border-[#222226] md:border-slate-200 bg-[#0A0A0C] md:bg-white px-3 py-2.5 text-sm text-white md:text-slate-900 outline-none focus:border-fuchsia-500/50"
          />
        </div>
        <button
          onClick={() => setStep("confirm")}
          disabled={!(numericAmount > 0) || numericAmount > available}
          className="w-full rounded-xl bg-fuchsia-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-2.5 text-sm"
        >
          {numericAmount > available ? "Insufficient balance" : "Continue"}
        </button>
      </ModalShell>
    );
  }

  if (step === "confirm" && recipient) {
    return (
      <ModalShell title="Confirm Transfer" onClose={onClose}>
        <div className="rounded-xl border border-[#222226] md:border-slate-200 bg-[#0A0A0C] md:bg-white p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">To</span>
            <span className="font-semibold text-white md:text-slate-900">
              @{recipient.username ?? "user"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-semibold text-white md:text-slate-900">
              {formatMoney(numericAmount, homeCurrency)}
            </span>
          </div>
          {note && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Note</span>
              <span className="text-slate-300 md:text-slate-600 truncate">{note}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[#222226] md:border-slate-200 pt-2">
            <span className="text-slate-500">No fee</span>
            <span className="text-emerald-300 font-semibold">Instant</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep("amount")}
            className="flex-1 rounded-xl border border-[#222226] md:border-slate-200 py-2.5 text-sm text-slate-300 md:text-slate-600"
          >
            Back
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-[2] rounded-xl bg-fuchsia-500 hover:brightness-110 disabled:opacity-60 text-black font-bold py-2.5 text-sm inline-flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Sending…
              </>
            ) : (
              "Confirm & Send"
            )}
          </button>
        </div>
      </ModalShell>
    );
  }

  return null;
}
