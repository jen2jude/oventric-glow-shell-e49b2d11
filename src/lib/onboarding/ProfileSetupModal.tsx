import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserRound, X, Lock, Globe2, Check } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useOnboarding, type Country } from "@/lib/onboarding/OnboardingContext";
import {
  completeProfile as completeProfileFn,
  getOnboardingStatus as getStatusFn,
} from "@/lib/onboarding.functions";

const schema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name")
      .max(80)
      .regex(/\s/, "Enter first and last name"),
    country: z.enum(["NG", "GH", "OTHER"]),
    countryOther: z.string().trim().max(60).optional(),
    password: z.string().min(8, "Minimum 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })
  .refine((v) => v.country !== "OTHER" || (v.countryOther && v.countryOther.length >= 2), {
    message: "Type your country name",
    path: ["countryOther"],
  });

const COUNTRIES: { code: Country; label: string }[] = [
  { code: "NG", label: "🇳🇬 Nigeria" },
  { code: "GH", label: "🇬🇭 Ghana" },
  { code: "OTHER", label: "🌍 Other (type your country)" },
];

/**
 * Fires once per user right after sign-in when the profile is not yet
 * complete. Captures: full name, country, password. Slides in from the
 * right for a fresh-onboarding feel.
 */
export function ProfileSetupModalHost() {
  const { session, checked, isAuthenticated } = useAuthGate();
  const { advanceTo, tier } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const getStatus = useServerFn(getStatusFn);
  const lastCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    // Guests (no session, or an anonymous session) must sign in first — the
    // AuthGate owns that step. Never jump straight to profile setup.
    if (!checked || !isAuthenticated || !session?.user?.id) return;
    if (lastCheckedRef.current === session.user.id) return;
    lastCheckedRef.current = session.user.id;
    setChecking(true);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        // The screen's session can lag behind a sign-out; skip the call
        // when there is no live token to avoid an Unauthorized error.
        if (!data.session?.access_token) throw new Error("signed-out");
        return getStatus();
      })
      .then((s) => {
        if (!s.profileCompleted) setOpen(true);
      })
      .catch(() => {
        /* fail-open: gate reappears on retry */
      })
      .finally(() => setChecking(false));
  }, [session?.user?.id, checked, isAuthenticated, getStatus]);

  const handleDone = useCallback(
    (fullName: string, country: Country) => {
      const t = tier < 2 ? 2 : tier;
      advanceTo(t, { fullName, country });
      setOpen(false);
    },
    [advanceTo, tier],
  );

  if (!open || checking) return null;
  return <ProfileSetupSlide onSaved={handleDone} onClose={() => setOpen(false)} />;
}

function ProfileSetupSlide({
  onSaved,
  onClose,
}: {
  onSaved: (fullName: string, country: Country) => void;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState<Country | "">("");
  const [countryOther, setCountryOther] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const completeProfile = useServerFn(completeProfileFn);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const submit = useCallback(async () => {
    setGlobalError(null);
    const parsed = schema.safeParse({ fullName, country, countryOther, password, confirm });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[issue.path[0] as string] = issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (pwErr) throw pwErr;
      // Persist NG/GH as the code; for OTHER, persist the user-typed country
      // name so the admin/team can see which country to add support for next.
      const countryValue =
        parsed.data.country === "OTHER"
          ? (parsed.data.countryOther ?? "").trim()
          : parsed.data.country;
      await completeProfile({
        data: { fullName: parsed.data.fullName, country: countryValue },
      });
      try {
        window.dispatchEvent(new CustomEvent("oventric:profile-updated"));
      } catch {
        /* noop */
      }
      setDone(true);
      setTimeout(() => onSaved(parsed.data.fullName, parsed.data.country), 900);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }, [fullName, country, countryOther, password, confirm, completeProfile, onSaved]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-setup-title"
    >
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative w-full sm:max-w-md h-full bg-[#141418] border-l border-white/10 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 z-10 bg-[#141418] px-6 py-4 border-b border-white/5 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Step 2 of 2 · Complete profile
            </div>
            <h2 id="profile-setup-title" className="text-lg font-black text-white mt-1">
              Finish setting up your account
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving || done}
            className="p-2 -m-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {done && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-300 text-sm inline-flex items-center gap-2 w-full"
            >
              <Check className="w-4 h-4" /> Profile saved. Loading your workspace…
            </div>
          )}

          <Field
            id="ps-name"
            label="Full name"
            icon={<UserRound className="w-4 h-4 text-emerald-300" />}
            error={errors.fullName}
          >
            <input
              id="ps-name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Lovelace"
              disabled={saving || done}
              className={inputCls(errors.fullName)}
            />
          </Field>

          <Field
            id="ps-country"
            label="Country"
            icon={<Globe2 className="w-4 h-4 text-emerald-300" />}
            error={errors.country}
          >
            <select
              id="ps-country"
              value={country}
              onChange={(e) => setCountry(e.target.value as Country)}
              disabled={saving || done}
              className={inputCls(errors.country)}
            >
              <option value="" disabled>
                Select a country
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          {country === "OTHER" && (
            <Field
              id="ps-country-other"
              label="Type your country"
              icon={<Globe2 className="w-4 h-4 text-emerald-300" />}
              error={errors.countryOther}
              hint="We'll use this to add local rails for your country next. Your baseline currency will be USD for now."
            >
              <input
                id="ps-country-other"
                autoComplete="country-name"
                value={countryOther}
                onChange={(e) => setCountryOther(e.target.value)}
                placeholder="e.g. Kenya"
                disabled={saving || done}
                className={inputCls(errors.countryOther)}
              />
            </Field>
          )}

          <Field
            id="ps-password"
            label="Create password"
            icon={<Lock className="w-4 h-4 text-emerald-300" />}
            error={errors.password}
            hint="Minimum 8 characters. You'll use this to sign back in."
          >
            <input
              id="ps-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={saving || done}
              className={inputCls(errors.password)}
            />
          </Field>

          <Field
            id="ps-confirm"
            label="Confirm password"
            icon={<Lock className="w-4 h-4 text-emerald-300" />}
            error={errors.confirm}
          >
            <input
              id="ps-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              disabled={saving || done}
              className={inputCls(errors.confirm)}
            />
          </Field>

          {globalError && (
            <p role="alert" className="text-xs text-red-400 border-l-2 border-red-500 pl-2">
              {globalError}
            </p>
          )}

          <button
            onClick={submit}
            disabled={saving || done}
            className=" w-full h-11 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : done ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" /> Done
              </>
            ) : (
              "Save & enter Oventric"
            )}
          </button>
          <p className="text-[11px] text-slate-500 text-center">
            This info is encrypted and used only for your profile and payout receipts.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function inputCls(err: string | undefined) {
  return `w-full h-11 px-3 bg-[#121214] rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 border ${
    err ? "border-red-500/70" : "border-white/10 focus:border-emerald-500/60"
  }`;
}

function Field({
  id,
  label,
  icon,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5"
      >
        {icon} {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
      {error && (
        <p
          role="alert"
          className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2"
        >
          {error}
        </p>
      )}
    </div>
  );
}
