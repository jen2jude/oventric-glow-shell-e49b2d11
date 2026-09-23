import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader, MessageCircle, Phone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  getOnboardingStatus as getOnboardingStatusFn,
  saveContactNumbers as saveContactNumbersFn,
} from "@/lib/onboarding.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { COUNTRY_META } from "@/lib/currency/africa";

const INTERVAL_MS = 2 * 60 * 1000;

const inputCls =
  "h-12 w-full rounded-[10px] border border-contact-line bg-contact-field px-3.5 text-[15px] text-contact-ink outline-none transition-[border-color,box-shadow,background-color] placeholder:text-contact-muted focus:border-contact-whatsapp focus:bg-contact-surface focus:ring-4 focus:ring-contact-whatsapp-soft";
const labelCls = "mb-1.5 block text-xs font-bold text-contact-ink";

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
    <div className="modal-light fixed inset-0 z-[80] flex items-end justify-center px-0 sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-foreground/55 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="slide-up relative w-full max-w-md overflow-hidden rounded-t-[20px] border border-contact-line bg-contact-surface shadow-contact-sheet sm:rounded-[18px]">
        <div className="grid h-1.5 grid-cols-5" aria-hidden="true">
          <span className="bg-contact-whatsapp" />
          <span className="bg-contact-blue" />
          <span className="bg-contact-violet" />
          <span className="bg-contact-gold" />
          <span className="bg-contact-coral" />
        </div>

        <div className="relative px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 rounded-full text-contact-muted hover:bg-contact-field hover:text-contact-ink sm:right-4 sm:top-4"
            aria-label="Remind me later"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="mb-4 flex items-center gap-3 pr-10">
            <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-[14px] bg-contact-whatsapp-soft text-contact-whatsapp">
              <MessageCircle className="h-7 w-7" strokeWidth={2.2} />
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-contact-surface bg-contact-blue text-contact-surface">
                <Phone className="h-3 w-3" strokeWidth={2.5} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-extrabold uppercase text-contact-whatsapp">
                Seller contact
              </p>
              <h2 className="text-xl font-black leading-tight text-contact-ink">
                Add your WhatsApp number
              </h2>
            </div>
          </div>

          <p className="text-sm leading-5 text-contact-copy">
            Help our team reach you about customer orders and delivery when you&apos;re offline.
          </p>
        </div>

        <div className="border-t border-contact-line px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-6">
          <label className={labelCls} htmlFor="seller-whatsapp-number">
            WhatsApp number <span className="text-contact-coral">*</span>
          </label>
          <div className="relative">
            <MessageCircle className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-contact-whatsapp" />
            <input
              id="seller-whatsapp-number"
              className={`${inputCls} pl-10`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={`${dial} 800 000 0000`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <p className="mt-1.5 text-xs text-contact-muted">Include your country code.</p>

          <label className={`${labelCls} mt-4`} htmlFor="seller-second-number">
            Second number <span className="font-medium text-contact-muted">(optional)</span>
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-contact-blue" />
            <input
              id="seller-second-number"
              className={`${inputCls} pl-10`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={`${dial} 700 000 0000`}
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)}
            />
          </div>

          {error && (
            <div className="mt-3 rounded-[10px] border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive" role="alert">
              {error}
            </div>
          )}

          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="mt-5 h-12 w-full rounded-[10px] bg-contact-whatsapp text-sm font-extrabold text-contact-on-whatsapp shadow-none hover:bg-contact-whatsapp-strong"
          >
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
            {saving ? "Saving…" : "Save contact details"}
          </Button>

          <p className="mt-3 text-center text-[11px] leading-4 text-contact-muted">
            Used only for order support and seller communication.
          </p>
        </div>
      </div>
    </div>
  );
}
