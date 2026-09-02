import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import {
  getServicePackages,
  saveServicePackages,
  type ServiceTier,
} from "@/lib/services.functions";

const ACCENT = "#E5484D";

const TIERS: { tier: ServiceTier; label: string; hint: string }[] = [
  { tier: "basic", label: "Basic", hint: "The essentials" },
  { tier: "standard", label: "Standard", hint: "Most popular" },
  { tier: "pro", label: "Pro", hint: "The full job" },
];

interface Draft {
  enabled: boolean;
  name: string;
  summary: string;
  features: string;
  price: string;
  days: string;
  revisions: string;
}

const emptyDraft = (label: string): Draft => ({
  enabled: false,
  name: label,
  summary: "",
  features: "",
  price: "",
  days: "",
  revisions: "",
});

/**
 * Owner-only editor for a service's Basic / Standard / Pro tiers. Tiers are
 * what let a buyer self-select scope, so the seller stops quoting by hand.
 */
export function ServicePackagesModal({
  open,
  onClose,
  productId,
  serviceTitle,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  serviceTitle: string;
  onSaved?: () => void;
}) {
  const load = useServerFn(getServicePackages);
  const persist = useServerFn(saveServicePackages);
  const snapshotFx = useServerFn(snapshotFxRates);
  const { homeCurrency } = useOnboarding();

  const [drafts, setDrafts] = useState<Record<ServiceTier, Draft>>({
    basic: emptyDraft("Basic"),
    standard: emptyDraft("Standard"),
    pro: emptyDraft("Pro"),
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    load({ data: { productId } })
      .then((rows) => {
        if (cancelled) return;
        setDrafts((prev) => {
          const next = { ...prev };
          for (const r of rows) {
            next[r.tier] = {
              enabled: true,
              name: r.name,
              summary: r.summary,
              features: r.features.join("\n"),
              price: String(
                r.originalCurrency === homeCurrency ? r.originalAmount : r.priceUsd,
              ),
              days: r.deliveryDays == null ? "" : String(r.deliveryDays),
              revisions: r.revisions == null ? "" : String(r.revisions),
            };
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, productId, load, homeCurrency]);

  const patch = useCallback((tier: ServiceTier, part: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [tier]: { ...prev[tier], ...part } }));
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const active = TIERS.filter((t) => drafts[t.tier].enabled);
      if (active.length === 0) return toast.error("Turn on at least one package.");
      for (const t of active) {
        const d = drafts[t.tier];
        if (d.name.trim().length < 2) return toast.error(`${t.label}: add a package name.`);
        if (!(Number(d.price) > 0)) return toast.error(`${t.label}: set a price.`);
      }
      setSaving(true);
      try {
        const snapshot = await snapshotFx();
        const rate = Number(snapshot.rates[homeCurrency] ?? 1);
        await persist({
          data: {
            productId,
            packages: active.map((t) => {
              const d = drafts[t.tier];
              const local = Number(d.price);
              return {
                tier: t.tier,
                name: d.name.trim(),
                summary: d.summary.trim(),
                features: d.features
                  .split("\n")
                  .map((f) => f.trim())
                  .filter(Boolean),
                priceLocal: local,
                currency: homeCurrency,
                priceUsd:
                  homeCurrency === "USD" ? local : Number((local / (rate || 1)).toFixed(2)),
                deliveryDays: d.days ? Number(d.days) : null,
                revisions: d.revisions ? Number(d.revisions) : null,
              };
            }),
          },
        });
        toast.success("Packages saved");
        onSaved?.();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save packages.");
      } finally {
        setSaving(false);
      }
    },
    [drafts, homeCurrency, snapshotFx, persist, productId, onSaved, onClose],
  );

  if (!open) return null;

  const field =
    "mt-1 w-full rounded-xl border border-white/10 bg-[#17171C] px-3 py-2.5 text-sm outline-none focus:border-white/25";

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101014] p-5 text-white sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black">Packages</h2>
            <p className="truncate text-xs text-slate-400">{serviceTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Offer up to three tiers so buyers pick their own scope. Your listing's "starting from"
          price follows your cheapest package.
        </p>

        {loading && (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        )}

        {!loading &&
          TIERS.map((t) => {
            const d = drafts[t.tier];
            return (
              <div
                key={t.tier}
                className="mt-4 rounded-2xl border border-white/10 bg-[#141417] p-4"
              >
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-sm font-black">{t.label}</span>
                    <span className="ml-2 text-[11px] text-slate-500">{t.hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => patch(t.tier, { enabled: e.target.checked })}
                    className="h-4 w-4 accent-[#E5484D]"
                  />
                </label>

                {d.enabled && (
                  <div className="mt-3">
                    <input
                      value={d.name}
                      onChange={(e) => patch(t.tier, { name: e.target.value })}
                      maxLength={60}
                      placeholder="Package name — e.g. Landing page design"
                      className={field}
                    />
                    <textarea
                      value={d.summary}
                      onChange={(e) => patch(t.tier, { summary: e.target.value })}
                      rows={2}
                      maxLength={400}
                      placeholder="One line on what this tier covers"
                      className={`${field} resize-none`}
                    />
                    <textarea
                      value={d.features}
                      onChange={(e) => patch(t.tier, { features: e.target.value })}
                      rows={3}
                      placeholder={"What's included — one per line\ne.g. 3 concepts\nSource files"}
                      className={`${field} resize-none`}
                    />
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      <input
                        value={d.price}
                        onChange={(e) => patch(t.tier, { price: e.target.value })}
                        inputMode="decimal"
                        placeholder={`Price (${homeCurrency})`}
                        className={field}
                      />
                      <input
                        value={d.days}
                        onChange={(e) => patch(t.tier, { days: e.target.value })}
                        inputMode="numeric"
                        placeholder="Days"
                        className={field}
                      />
                      <input
                        value={d.revisions}
                        onChange={(e) => patch(t.tier, { revisions: e.target.value })}
                        inputMode="numeric"
                        placeholder="Revisions"
                        className={field}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-white/12 bg-white/[0.04] text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save packages
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
