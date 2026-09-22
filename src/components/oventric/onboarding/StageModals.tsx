import { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  Store,
  Wallet as WalletIcon,
  ScanFace,
  Loader2,
  Check,
  Loader,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  useOnboarding,
  type Country,
  type Currency,
  countryToCurrency,
} from "@/lib/onboarding/OnboardingContext";
import { ALL_COUNTRIES, COUNTRY_META } from "@/lib/currency/africa";
import { completeProfile as completeProfileFn } from "@/lib/onboarding.functions";

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-light fixed inset-0 z-[60] flex items-end justify-center sm:items-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="slide-up relative w-full max-w-md bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-11 px-3 bg-[#121214] border border-white/10 rounded-[10px] text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all";
const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5";
const btnCls =
  "w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-[10px] transition-colors";

function StageIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-1 flex-1 rounded-full ${n <= current ? "bg-emerald-500" : "bg-white/10"}`}
        />
      ))}
    </div>
  );
}

// Stage 1 (email verification) is intentionally removed. Email OTP verification
// is fully handled by the global AuthGate — no legacy progressive form.

// Country list + currency mapping now come from the pan-African registry.
const COUNTRY_OPTIONS = ALL_COUNTRIES;

function Stage2({ onClose }: { onClose: () => void }) {
  const {
    advanceTo,
    setBaseCurrency,
    tier,
    fullName: existingName,
    country: existingCountry,
    phone: existingPhone,
  } = useOnboarding();
  const completeProfile = useServerFn(completeProfileFn);
  const [name, setName] = useState(existingName || "");
  const [country, setCountry] = useState<Country | "">(existingCountry ?? "");
  const [countryOther, setCountryOther] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(existingPhone || "");
  const [altPhone, setAltPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = country ? (COUNTRY_META[country]?.currency ?? "USD") : null;

  const canSubmit =
    name.trim().length >= 2 &&
    !!country &&
    (country !== "OTHER" || countryOther.trim().length >= 2) &&
    address.trim().length >= 4 &&
    phone.trim().length >= 6 &&
    (altPhone.trim().length === 0 || altPhone.trim().length >= 6) &&
    !saving;

  const submit = async () => {
    if (!canSubmit || !country) return;
    setError(null);
    setSaving(true);
    try {
      const countryValue = country === "OTHER" ? countryOther.trim() : country;
      await completeProfile({
        data: {
          fullName: name.trim(),
          country: countryValue,
          address: address.trim(),
          phone: phone.trim(),
          ...(altPhone.trim() ? { altPhone: altPhone.trim() } : {}),
        },
      });
      const nextCurrency = countryToCurrency(country);
      setBaseCurrency(nextCurrency);
      advanceTo(Math.max(tier, 2) as typeof tier, {
        fullName: name.trim(),
        country,
        phone: phone.trim(),
        baseCurrency: nextCurrency,
      });
      toast.success("Commerce unlocked", {
        description: `You can now buy, sell, fund your wallet and accept bounties in ${nextCurrency}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save your profile";
      setError(msg);
      toast.error("Could not unlock commerce", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Unlock buying, selling & wallets"
      subtitle="Stage 2 of 5 · Tell us who you are so we can transact for you"
      onClose={onClose}
    >
      <StageIndicator current={2} />
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
        <ShieldCheck className="w-6 h-6 text-emerald-400" />
      </div>

      <label className={labelCls}>Full Name</label>
      <input
        className={inputCls}
        placeholder="Ada Lovelace"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className={labelCls + " mt-4"}>Country of Residence</label>
      <select
        className={inputCls}
        value={country}
        onChange={(e) => setCountry(e.target.value as Country)}
      >
        <option value="" disabled>
          Select a country
        </option>
        {COUNTRY_OPTIONS.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.name} · {c.currency}
          </option>
        ))}
      </select>
      {currency && country !== "OTHER" && (
        <p className="text-[11px] text-emerald-300/80 mt-1.5">
          Base currency will lock to <span className="font-semibold">{currency}</span> for wallet,
          marketplace and bounties.
        </p>
      )}
      {country === "OTHER" && (
        <>
          <label className={labelCls + " mt-4"}>Type your country</label>
          <input
            className={inputCls}
            autoComplete="country-name"
            placeholder="e.g. Kenya"
            value={countryOther}
            onChange={(e) => setCountryOther(e.target.value)}
          />
          <p className="text-[11px] text-emerald-300/80 mt-1.5">
            Base currency will be <span className="font-semibold">USD</span>. We'll add local rails
            for your country next.
          </p>
        </>
      )}

      <label className={labelCls + " mt-4"}>Residential Address</label>
      <textarea
        rows={2}
        className={inputCls + " h-auto py-2.5"}
        placeholder="Street, city, state, postal code"
        autoComplete="street-address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <label className={labelCls + " mt-4"}>Phone Number</label>
      <input
        className={inputCls}
        type="tel"
        autoComplete="tel"
        placeholder={
          country ? `${COUNTRY_META[country]?.dial ?? "+"} 800 000 0000` : "+1 555 123 4567"
        }
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {error && (
        <div className="mt-3 rounded-[10px] border border-rose-500/40 bg-rose-500/10 text-rose-200 text-xs px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className={
          btnCls +
          " mt-5 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        }
      >
        {saving && <Loader className="w-4 h-4 animate-spin" />}
        {saving ? "Saving profile…" : "Unlock commerce"}
      </button>
    </ModalShell>
  );
}

function Stage3({ onClose }: { onClose: () => void }) {
  const { advanceTo } = useOnboarding();
  const [store, setStore] = useState("");
  const [niche, setNiche] = useState("");
  const [addr, setAddr] = useState("");
  return (
    <ModalShell
      title="Open your seller storefront"
      subtitle="Stage 3 of 5 · Merchant details"
      onClose={onClose}
    >
      <StageIndicator current={3} />
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
        <Store className="w-6 h-6 text-emerald-400" />
      </div>
      <label className={labelCls}>Store / Brand Display Name</label>
      <input
        className={inputCls}
        placeholder="Kessler Labs"
        value={store}
        onChange={(e) => setStore(e.target.value)}
      />
      <label className={labelCls + " mt-4"}>Primary Skill Niche</label>
      <select className={inputCls} value={niche} onChange={(e) => setNiche(e.target.value)}>
        <option value="" disabled>
          Choose a niche
        </option>
        <option>SaaS Templates</option>
        <option>UI Kits & Design</option>
        <option>AI Agents & Prompts</option>
        <option>Backend & DevOps</option>
        <option>Data & Analytics</option>
      </select>
      <label className={labelCls + " mt-4"}>Business Address</label>
      <textarea
        rows={3}
        className={inputCls + " h-auto py-3"}
        placeholder="Street, city, state, postal"
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
      />
      <button
        disabled={!store || !niche || !addr}
        onClick={() => advanceTo(3, { storeName: store })}
        className={btnCls + " mt-5 disabled:opacity-40 disabled:cursor-not-allowed"}
      >
        Activate storefront
      </button>
    </ModalShell>
  );
}

function Stage4({ onClose }: { onClose: () => void }) {
  const { advanceTo, baseCurrency, setBaseCurrency } = useOnboarding();
  const [phone, setPhone] = useState("");
  const [postal, setPostal] = useState("");
  return (
    <ModalShell
      title="Secure your funding vault"
      subtitle="Stage 4 of 5 · Payments profile"
      onClose={onClose}
    >
      <StageIndicator current={4} />
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
        <WalletIcon className="w-6 h-6 text-emerald-400" />
      </div>
      <label className={labelCls}>Phone Number</label>
      <input
        className={inputCls}
        placeholder="+1 555 123 4567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <label className={labelCls + " mt-4"}>Billing Postal Code</label>
      <input
        className={inputCls}
        placeholder="94103"
        value={postal}
        onChange={(e) => setPostal(e.target.value)}
      />
      <div className="mt-5 rounded-[10px] border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-2">
          Baseline currency
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="h-10 px-3 rounded-[10px] bg-emerald-500 text-black text-sm font-bold flex items-center">
            {baseCurrency}
          </div>
          <p className="text-[11px] text-slate-400 flex-1">
            Locked to your country of residence. Wallet, marketplace, bounties and payouts all
            settle in {baseCurrency}.
          </p>
        </div>
      </div>
      <button
        disabled={!phone || !postal}
        onClick={() => advanceTo(4, { phone })}
        className={btnCls + " mt-5 disabled:opacity-40 disabled:cursor-not-allowed"}
      >
        Confirm funding vault
      </button>
    </ModalShell>
  );
}

function Stage5({ onClose }: { onClose: () => void }) {
  const { advanceTo, country } = useOnboarding();
  const [step, setStep] = useState<"cam" | "flash" | "bank">("cam");
  const [countdown, setCountdown] = useState(3);
  const [bank, setBank] = useState("");
  const [acct, setAcct] = useState("");
  const [holder, setHolder] = useState("");
  const [network, setNetwork] = useState("");
  const [momo, setMomo] = useState("");
  const [walletName, setWalletName] = useState("");

  useEffect(() => {
    if (step !== "cam") return;
    if (countdown <= 0) {
      setStep("flash");
      const t = setTimeout(() => setStep("bank"), 1400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, step]);

  const finish = () => {
    if (country === "NG") advanceTo(5, {});
    else if (country === "GH") advanceTo(5, {});
    else advanceTo(5, {});
  };

  const isNG = country === "NG";
  const isGH = country === "GH";

  return (
    <ModalShell
      title="Liveness KYC verification"
      subtitle="Stage 5 of 5 · Biometric scan"
      onClose={onClose}
    >
      <StageIndicator current={5} />

      {step === "cam" && (
        <div className="flex flex-col items-center">
          <div className=" rounded-full p-[3px] mb-4">
            <div className="w-52 h-52 rounded-full bg-black relative overflow-hidden flex items-center justify-center">
              {/* Simulated webcam gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
              <div className="absolute inset-4 rounded-full border border-emerald-400/30" />
              {/* Spinning scanner arc */}
              <Loader2
                className="absolute w-52 h-52 text-emerald-400/70 animate-spin"
                strokeWidth={1}
              />
              <ScanFace className="relative w-16 h-16 text-emerald-300/80" strokeWidth={1.2} />
              <div className="absolute inset-x-0 top-1/2 h-[2px] bg-emerald-400/70 shadow-sm" />
            </div>
          </div>
          <p className="text-sm text-slate-300">Hold still — capturing biometric</p>
          <p className="text-4xl font-black text-white mt-1 tabular-nums">{countdown}</p>
        </div>
      )}

      {step === "flash" && (
        <>
          <div className="modal-light fixed inset-0 z-[70] pointer-events-none  opacity-70" />
          <div className="modal-light fixed inset-0 z-[71] pointer-events-none flex items-center justify-center">
            <div className="bg-black rounded-2xl px-8 py-6 border border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-6 h-6 text-black" strokeWidth={3} />
              </div>
              <div>
                <div className="text-white font-bold">Verified</div>
                <div className="text-xs text-slate-300">Liveness match confirmed</div>
              </div>
            </div>
          </div>
        </>
      )}

      {step === "bank" && (
        <div>
          <div className="mb-4 rounded-[10px] border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-300">
            Identity verified · configure your payout destination
          </div>
          {isNG && (
            <>
              <label className={labelCls}>Select Nigerian Commercial Bank</label>
              <select className={inputCls} value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="" disabled>
                  Choose bank
                </option>
                <option>Access Bank</option>
                <option>GTBank</option>
                <option>Zenith Bank</option>
                <option>First Bank of Nigeria</option>
                <option>UBA</option>
                <option>Kuda Bank</option>
              </select>
              <label className={labelCls + " mt-4"}>10-digit Account Number</label>
              <input
                className={inputCls}
                maxLength={10}
                value={acct}
                onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))}
              />
              <label className={labelCls + " mt-4"}>Account Holder Name</label>
              <input
                className={inputCls}
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
              />
              <button
                disabled={!bank || acct.length !== 10 || !holder}
                onClick={finish}
                className={btnCls + " mt-5 disabled:opacity-40 disabled:cursor-not-allowed"}
              >
                Complete KYC & unlock withdrawals
              </button>
            </>
          )}
          {isGH && (
            <>
              <label className={labelCls}>Mobile Money Network Provider</label>
              <select
                className={inputCls}
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
              >
                <option value="" disabled>
                  Choose network
                </option>
                <option>MTN</option>
                <option>Vodafone</option>
                <option>AirtelTigo</option>
              </select>
              <label className={labelCls + " mt-4"}>Momo Wallet Phone Number</label>
              <input className={inputCls} value={momo} onChange={(e) => setMomo(e.target.value)} />
              <label className={labelCls + " mt-4"}>Registered Wallet Name</label>
              <input
                className={inputCls}
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
              />
              <button
                disabled={!network || !momo || !walletName}
                onClick={finish}
                className={btnCls + " mt-5 disabled:opacity-40 disabled:cursor-not-allowed"}
              >
                Complete KYC & unlock withdrawals
              </button>
            </>
          )}
          {!isNG && !isGH && (
            <>
              <p className="text-sm text-slate-300 mb-4">
                International payouts available via SWIFT wire. Our team will reach out to configure
                your account.
              </p>
              <button onClick={finish} className={btnCls}>
                Complete KYC
              </button>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
}

export function StageModals() {
  const { openStage, setOpenStage } = useOnboarding();
  if (!openStage || openStage === 1) return null;
  const close = () => setOpenStage(null);
  if (openStage === 2) return <Stage2 onClose={close} />;
  if (openStage === 3) return <Stage3 onClose={close} />;
  if (openStage === 4) return <Stage4 onClose={close} />;
  return <Stage5 onClose={close} />;
}
