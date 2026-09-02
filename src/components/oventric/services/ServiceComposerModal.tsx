import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { snapshotFxRates } from "@/lib/fx.functions";
import { createServiceListing } from "@/lib/services.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const ACCENT = "#E5484D";

/**
 * Lightweight composer for service offerings. Deliberately shorter than the
 * product flows: a service is a promise of work, so we only ask for the
 * outcome, a sample image, a starting price and a typical delivery time.
 */
export function ServiceComposerModal({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const persist = useServerFn(createServiceListing);
  const snapshotFx = useServerFn(snapshotFxRates);
  const { homeCurrency } = useOnboarding();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const local = Number(amount);
      if (title.trim().length < 3) return toast.error("Give your service a clear title.");
      if (description.trim().length < 20)
        return toast.error("Describe what the buyer gets (20+ characters).");
      if (!(local > 0)) return toast.error("Set a starting price.");
      setSaving(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("Please sign in again.");

        let coverPath: string | null = null;
        if (file) {
          const safe = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${uid}/${Date.now()}-${safe}`;
          const { error } = await supabase.storage
            .from("product-covers")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (error) throw new Error(error.message);
          coverPath = path;
        }

        const snapshot = await snapshotFx();
        const rate = Number(snapshot.rates[homeCurrency] ?? 1);
        const usd = homeCurrency === "USD" ? local : Number((local / rate).toFixed(2));

        const res = await persist({
          data: {
            title: title.trim(),
            description: description.trim(),
            startingPriceUSD: usd,
            originalCurrency: homeCurrency,
            originalAmount: local,
            fxSnapshot: snapshot,
            coverPath,
            deliveryDays: days ? Number(days) : null,
          },
        });
        toast.success(
          res.status === "active"
            ? "Service published"
            : "Service submitted — it goes live once reviewed",
        );
        setTitle("");
        setDescription("");
        setAmount("");
        setDays("");
        setFile(null);
        setPreview(null);
        onPublished?.();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not publish this service.");
      } finally {
        setSaving(false);
      }
    },
    [title, description, amount, days, file, homeCurrency, snapshotFx, persist, onPublished, onClose],
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101014] p-5 text-white sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Offer a service</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative mt-4 block h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A1F]"
        >
          {preview ? <img loading="lazy" decoding="async" src={preview} alt="" className="h-full w-full object-cover" /> : null}
          <span className="absolute inset-0 grid place-items-center bg-black/40 text-xs font-bold">
            <span className="inline-flex items-center gap-2">
              <ImagePlus className="h-4 w-4" /> Add a sample of your work
            </span>
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f);
            setPreview(URL.createObjectURL(f));
          }}
        />

        <label className="mt-4 block text-xs font-bold text-slate-400">Service title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="e.g. UI/UX Design"
          className="mt-1 w-full rounded-xl border border-white/10 bg-[#17171C] px-3 py-2.5 text-sm font-semibold outline-none focus:border-white/25"
        />

        <label className="mt-4 block text-xs font-bold text-slate-400">
          What the buyer gets
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1200}
          rows={4}
          placeholder="Designing intuitive and user-centered digital experiences. Includes 2 revisions and source files."
          className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-[#17171C] px-3 py-2.5 text-sm outline-none focus:border-white/25"
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400">
              Starting from ({homeCurrency})
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              placeholder="120000"
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#17171C] px-3 py-2.5 text-sm font-semibold outline-none focus:border-white/25"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400">Delivery (days)</label>
            <input
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="7"
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#17171C] px-3 py-2.5 text-sm font-semibold outline-none focus:border-white/25"
            />
          </div>
        </div>

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
            disabled={saving}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Publish service
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
