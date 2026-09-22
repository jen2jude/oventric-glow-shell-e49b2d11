import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader, PhoneCall, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getOnboardingStatus as getOnboardingStatusFn,
  saveContactNumbers as saveContactNumbersFn,
} from "@/lib/onboarding.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { COUNTRY_META } from "@/lib/currency/africa";

const INTERVAL_MS = 2 * 60 * 1000;

const inputCls =
  "w-full h-11 px-3 bg-[#121214] border border-white/10 rounded-[10px] text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all";
const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5";

/**
 * Existing members who completed their profile before phone numbers were
 * required have no way for support to reach them about a delivery. This
 * prompt re-appears every 2 minutes until they add a WhatsApp number.
 */
export function PhoneReminder() {
  const fetchStatus = useServerFn(getOnboardingStatusFn);
  const saveNumbers = useServerFn(saveContactNumbersFn);
  const { country, advanceTo, tier } = useOnboarding();
  const [needed, setNeeded] = useState(false);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checked = useRef(false);

  // Decide once per session whether this account is missing a number.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (checked.current) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user?.id) return;
      checked.current = true;
      try {
        const status = await fetchStatus();
        if (cancelled) return;
        if (status.profileCompleted && !status.phone) {
          setNeeded(true);
          setOpen(true);
        }
      } catch {
        /* non-fatal: the prompt simply doesn't show */
      }
    };
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        checked.current = false;
        void check();
      }
      if (event === "SIGNED_OUT") {
        checked.current = false;
        setNeeded(false);
        setOpen(false);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [fetchStatus]);

  // Re-open every 2 minutes until a number is saved.
  useEffect(() => {
    if (!needed) return;
    const id = setInterval(() => setOpen(true), INTERVAL_MS);
    return () => clearInterval(id);
  }, [needed]);

  if (!needed || !open) return null;

  const dial = country ? (COUNTRY_META[country]?.dial ?? "+") : "+";
  const canSubmit =
    phone.trim().length >= 6 &&
    (altPhone.trim().length === 0 || altPhone.trim().length >= 6) &&
    !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSaving(true);
    try {
      await saveNumbers({
        data: {
          phone: phone.trim(),
          ...(altPhone.trim() ? { altPhone: altPhone.trim() } : {}),
        },
      });
      advanceTo(tier, { phone: phone.trim() });
      setNeeded(false);
      setOpen(false);
      toast.success("Number saved", {
        description: "Our team can now reach you on WhatsApp about deliveries.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save your number";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-light fixed inset-0 z-[80] flex items-end justify-center sm:items-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/75" onClick={() => setOpen(false)} />
      <div className="slide-up relative w-full max-w-md bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Add your WhatsApp number</h2>
            <p className="text-xs text-slate-400 mt-1">
              Required so our team can reach you to deliver orders when you're offline.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 -m-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white"
            aria-label="Remind me later"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
          <PhoneCall className="w-6 h-6 text-emerald-400" />
        </div>

        <label className={labelCls}>WhatsApp Number (required)</label>
        <input
          className={inputCls}
          type="tel"
          autoComplete="tel"
          placeholder={`${dial} 800 000 0000`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="text-[11px] text-slate-400 mt-1.5">Include your country code.</p>

        <label className={labelCls + " mt-4"}>Second Number (optional)</label>
        <input
          className={inputCls}
          type="tel"
          autoComplete="tel"
          placeholder={`${dial} 700 000 0000`}
          value={altPhone}
          onChange={(e) => setAltPhone(e.target.value)}
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
          className="w-full h-11 mt-5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-[10px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {saving && <Loader className="w-4 h-4 animate-spin" />}
          {saving ? "Saving…" : "Save my number"}
        </button>
      </div>
    </div>
  );
}
