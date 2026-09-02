import { useEffect, useRef, useState } from "react";
import {
  X,
  ImagePlus,
  Loader2,
  Target,
  Calendar,
  Wallet,
  AlertTriangle,
  Save,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { snapshotFxRates } from "@/lib/fx.functions";
import { publishBounty } from "@/lib/bounties.functions";
import { listBountyCategories, type BountyCategory } from "@/lib/bounty-categories.functions";
import { formatMoney } from "@/lib/fx-display";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { ResponsiveImage } from "@/components/ui/responsive-image";

const DRAFT_KEY_PREFIX = "oventric:bounty:draft:";
const draftKey = (uid: string) => `${DRAFT_KEY_PREFIX}${uid}`;

const FALLBACK_CATEGORIES: BountyCategory[] = [
  { slug: "frontend", label: "Frontend Gigs", sort_order: 10, active: true },
  { slug: "database", label: "Database Ops", sort_order: 20, active: true },
  { slug: "api", label: "API Integrations", sort_order: 30, active: true },
  { slug: "uiux", label: "UI/UX Polishing", sort_order: 40, active: true },
];
type Category = string;

const MAX_IMAGES = 5;

interface ImageEntry {
  path: string;
  preview: string | null;
}

interface FormState {
  title: string;
  description: string;
  category: Category;
  price_usd: string;
  applicant_limit: string;
  start_at: string;
  end_at: string;
  deadline_at: string;
  images: ImageEntry[];
}

const emptyForm: FormState = {
  title: "",
  description: "",
  category: "api",
  price_usd: "",
  applicant_limit: "10",
  start_at: "",
  end_at: "",
  deadline_at: "",
  images: [],
};

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function BountyEditorModal({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished?: (bountyId: string) => void;
}) {
  const { homeCurrency } = useOnboarding();
  const snapshotFx = useServerFn(snapshotFxRates);
  const publishFn = useServerFn(publishBounty);
  const listCatsFn = useServerFn(listBountyCategories);
  const [categories, setCategories] = useState<BountyCategory[]>(FALLBACK_CATEGORIES);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [walletBase, setWalletBase] = useState<number | null>(null);
  const [showFundPrompt, setShowFundPrompt] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [publishedSplash, setPublishedSplash] = useState<{
    title: string;
    amountLabel: string;
    id: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lock background scroll while the modal is open (keeps the feed behind frozen).
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Track the visual viewport so the on-screen keyboard shrinks the modal
  // instead of pushing it (and its inputs) off screen.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [vv, setVv] = useState<{ height: number; offsetTop: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!viewport) return;
    const sync = () => setVv({ height: viewport.height, offsetTop: viewport.offsetTop });
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      setVv(null);
    };
  }, [open]);

  // Keep the focused field visible inside the modal's internal scroller.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    let timer: ReturnType<typeof setTimeout>;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !("tagName" in el)) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) return;
      timer = setTimeout(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 250);
    };
    panel.addEventListener("focusin", onFocusIn);
    return () => {
      clearTimeout(timer);
      panel.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);




  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setShowFundPrompt(false);
    listCatsFn()
      .then((cats) => {
        if (cancelled) return;
        const list = Array.isArray(cats) && cats.length ? cats : FALLBACK_CATEGORIES;
        setCategories(list);
        // If current category isn't in the loaded list, keep it (user may have a legacy value).
      })
      .catch(() => setCategories(FALLBACK_CATEGORIES));
    (async () => {
      const { data: session } = await supabase.auth.getUser();
      const _uid = session.user?.id ?? null;
      if (cancelled) return;
      setUid(_uid);
      if (!_uid) {
        setWalletBase(null);
        return;
      }
      try {
        const raw =
          typeof window !== "undefined" ? window.localStorage.getItem(draftKey(_uid)) : null;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<FormState>;
          const rawImages = Array.isArray(parsed.images) ? parsed.images : [];
          // Re-sign previews from stored paths so restored images always render
          // (signed URLs stored in the draft may have expired during the top-up flow).
          const images: ImageEntry[] = await Promise.all(
            rawImages
              .filter(
                (i): i is ImageEntry =>
                  !!i &&
                  typeof (i as ImageEntry).path === "string" &&
                  (i as ImageEntry).path.length > 0,
              )
              .map(async (i) => {
                try {
                  const { data: signed } = await supabase.storage
                    .from("bounty-covers")
                    .createSignedUrl(i.path, 60 * 60);
                  return { path: i.path, preview: signed?.signedUrl ?? i.preview ?? null };
                } catch {
                  return { path: i.path, preview: i.preview ?? null };
                }
              }),
          );
          if (cancelled) return;
          setForm({ ...emptyForm, ...parsed, images });
          setDraftLoaded(true);
        } else {
          setDraftLoaded(false);
        }
      } catch {
        /* ignore */
      }
      const { data: walletData } = await supabase
        .from("wallets")
        .select("available_balance")
        .eq("user_id", _uid)
        .eq("currency", homeCurrency)
        .maybeSingle();
      if (cancelled) return;
      setWalletBase(Number(walletData?.available_balance ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const reset = () => {
    setForm(emptyForm);
    setDraftLoaded(false);
    if (uid) {
      try {
        window.localStorage.removeItem(draftKey(uid));
      } catch {
        /* ignore */
      }
    }
  };

  const saveDraft = (silent = false) => {
    if (!uid) {
      if (!silent) toast.error("Sign in to save a draft");
      return false;
    }
    try {
      window.localStorage.setItem(draftKey(uid), JSON.stringify(form));
      if (!silent) toast.success("Bounty draft saved");
      setDraftLoaded(true);
      return true;
    } catch (e) {
      if (!silent) toast.error("Could not save draft", { description: (e as Error).message });
      return false;
    }
  };

  const inputBase = Number(form.price_usd || 0);
  const shortfallBase = Math.max(0, inputBase - (walletBase ?? 0));

  const goToWallet = () => {
    saveDraft(true);
    const topupLocal =
      homeCurrency === "USD" ? Math.ceil(shortfallBase * 100) / 100 : Math.ceil(shortfallBase);
    onClose();
    window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Wallet" } }));
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("oventric:wallet:topup", {
          detail: { amountLocal: topupLocal, currency: homeCurrency, reason: "bounty-escrow" },
        }),
      );
    }, 60);
  };

  const handleImagePick = async (files: FileList) => {
    if (form.images.length >= MAX_IMAGES) return toast.error(`Max ${MAX_IMAGES} images`);
    const remaining = MAX_IMAGES - form.images.length;
    const picks = Array.from(files).slice(0, remaining);
    setUploadingImage(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const _uid = session.user?.id;
      if (!_uid) throw new Error("You must be signed in");
      const newEntries: ImageEntry[] = [];
      for (const file of picks) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} isn't an image`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 5MB`);
          continue;
        }
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${_uid}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage
          .from("bounty-covers")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) {
          toast.error(error.message);
          continue;
        }
        const { data: signed } = await supabase.storage
          .from("bounty-covers")
          .createSignedUrl(path, 60 * 60);
        newEntries.push({ path, preview: signed?.signedUrl ?? null });
      }
      if (newEntries.length) {
        setForm((f) => ({ ...f, images: [...f.images, ...newEntries].slice(0, MAX_IMAGES) }));
        toast.success(`${newEntries.length} image${newEntries.length > 1 ? "s" : ""} uploaded`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (idx: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    const rewardBase = Number(form.price_usd);
    if (!Number.isFinite(rewardBase) || rewardBase <= 0) {
      return toast.error("Set a reward greater than 0 — it funds the solver's payout.");
    }
    const limit = Number(form.applicant_limit);
    if (!(limit > 0)) return toast.error("Applicant limit must be > 0");
    const start = fromLocalInput(form.start_at);
    const end = fromLocalInput(form.end_at);
    const deadline = fromLocalInput(form.deadline_at);
    if (start && end && new Date(end) <= new Date(start)) {
      return toast.error("End time must be after start time");
    }
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const _uid = session.user?.id;
      if (!_uid) throw new Error("You must be signed in");
      setUid(_uid);

      const snapshot =
        rewardBase > 0
          ? await snapshotFx()
          : {
              base: "USD" as const,
              rates: { USD: 1, NGN: 1500, GHS: 14 },
              source: "fallback" as const,
              fetched_at: new Date().toISOString(),
            };
      const rateForBase = Number(snapshot.rates[homeCurrency] ?? 1);
      const priceUsd =
        homeCurrency === "USD" ? rewardBase : Number((rewardBase / rateForBase).toFixed(2));

      if (priceUsd > 0) {
        const { data: walletRow } = await supabase
          .from("wallets")
          .select("available_balance")
          .eq("user_id", _uid)
          .eq("currency", homeCurrency)
          .maybeSingle();
        const balance = Number(walletRow?.available_balance ?? 0);
        setWalletBase(balance);
        if (balance < rewardBase) {
          setShowFundPrompt(true);
          setSaving(false);
          return;
        }
      }

      const imagePaths = form.images.map((i) => i.path);
      const result = await publishFn({
        data: {
          title: form.title.trim(),
          description: form.description,
          category: form.category,
          price_usd: priceUsd,
          original_amount: rewardBase,
          original_currency: homeCurrency,
          fx_snapshot: snapshot,
          cover_path: imagePaths[0] ?? null,
          images: imagePaths,
          applicant_limit: limit,
          start_at: start,
          end_at: end,
          deadline_at: deadline,
        },
      });

      const titleTxt = form.title.trim();
      reset();
      setPublishedSplash({
        title: titleTxt,
        amountLabel: formatMoney(rewardBase, homeCurrency),
        id: result?.id ?? "",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-light fixed inset-x-0 z-50 flex items-start justify-center overflow-hidden p-3 sm:items-center sm:p-4 bg-create-overlay"
      style={{
        top: vv ? vv.offsetTop : 0,
        height: vv ? vv.height : undefined,
        ...(vv ? {} : { bottom: 0 }),
        paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
        paddingBottom: vv ? "0.75rem" : "max(env(safe-area-inset-bottom), 0.75rem)",
        paddingLeft: "max(env(safe-area-inset-left), 0.75rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.75rem)",
      }}
    >
      <div ref={panelRef} className="relative max-h-full w-full max-w-2xl overflow-y-auto overscroll-contain rounded-[10px] border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h2 className="text-slate-950 font-black text-xl inline-flex items-center gap-2">
              <Target className="h-5 w-5 text-red-600" /> Post a bounty
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">
              Escrow-protected tasks and gigs
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {draftLoaded && (
          <div className="mb-4 flex items-center justify-between gap-2 p-3 rounded-[10px] border border-red-200 bg-red-50 text-xs text-red-700">
            <span className="inline-flex items-center gap-2">
              <Save className="w-3.5 h-3.5" /> Draft restored — continue editing.
            </span>
            <button
              onClick={() => reset()}
              className="text-red-700 hover:text-red-900 underline underline-offset-2 font-bold"
            >
              Discard draft
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-600 mb-1 block">
              Images ({form.images.length}/{MAX_IMAGES})
            </span>
            <p className="text-[11px] text-slate-500 -mt-0.5 mb-2">
              First image is the cover. PNG/JPG/WebP up to 5MB each.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleImagePick(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
              {form.images.map((img, idx) => (
                <div
                  key={img.path}
                  className="relative aspect-square rounded-[10px] border border-slate-200 overflow-hidden bg-slate-100"
                >
                  {img.preview ? (
                    <ResponsiveImage
                      sizes="80px"
                      src={img.preview}
                      alt={`Image ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                      …
                    </div>
                  )}
                  {idx === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute right-1 top-1 rounded-[10px] bg-slate-950/75 p-1 text-white transition-colors hover:bg-red-600"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {form.images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="aspect-square rounded-[10px] border border-dashed border-slate-300 hover:border-red-400 bg-slate-50 hover:bg-red-50 disabled:opacity-50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-red-700 text-xs"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-5 h-5" />
                  )}
                  <span>{uploadingImage ? "Uploading…" : "Add image"}</span>
                </button>
              )}
            </div>
          </div>

          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              placeholder="e.g. Fix Paystack webhook loop"
            />
          </Field>

          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
              className={inputCls}
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Reward (${homeCurrency})`}>
              <input
                type="number"
                step={homeCurrency === "USD" ? "0.01" : "1"}
                min="0"
                value={form.price_usd}
                onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Funds are locked into escrow on publish and released to the solver when work is
                confirmed.
              </p>
            </Field>
            <Field label="Applicant limit">
              <input
                type="number"
                min="1"
                step="1"
                value={form.applicant_limit}
                onChange={(e) => setForm({ ...form, applicant_limit: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className={inputCls}
              placeholder="Scope, deliverables, acceptance criteria…"
            />
          </Field>

          <div className="pt-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-2">
              <Calendar className="w-3.5 h-3.5" /> Schedule
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Starts">
                <input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Ends (listing)">
                <input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Deadline (delivery)">
                <input
                  type="datetime-local"
                  value={form.deadline_at}
                  onChange={(e) => setForm({ ...form, deadline_at: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-3">
            <button
              disabled={saving}
              onClick={save}
              className="flex min-h-11 items-center gap-2 rounded-[10px] bg-red-600 px-6 py-3 text-sm font-black text-white shadow-lg transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Publish bounty
            </button>
            <button
              type="button"
              onClick={() => saveDraft()}
              className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold rounded-[10px] inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save draft
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold rounded-[10px]"
            >
              Cancel
            </button>
          </div>
        </div>

        {showFundPrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[10px] bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[10px] border border-amber-200 bg-white p-5 shadow-xl">
              <div className="flex items-center gap-2 text-amber-700 font-bold">
                <AlertTriangle className="w-5 h-5" /> Wallet balance too low
              </div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Publishing this bounty escrows{" "}
                <span className="text-slate-950 font-semibold">
                  {formatMoney(inputBase, homeCurrency)}
                </span>
                . Your current wallet balance is{" "}
                <span className="text-slate-950 font-semibold">
                  {formatMoney(walletBase ?? 0, homeCurrency)}
                </span>
                .
              </p>
              <p className="text-xs text-slate-600 mt-2">
                Top up at least{" "}
                <span className="font-semibold text-red-600">
                  {formatMoney(shortfallBase, homeCurrency)}
                </span>{" "}
                to publish.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={goToWallet}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700"
                >
                  <Wallet className="w-4 h-4" /> Save draft & top up
                </button>
                <button
                  onClick={() => {
                    saveDraft();
                    setShowFundPrompt(false);
                  }}
                  className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold rounded-[10px] inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save draft only
                </button>
                <button
                  onClick={() => setShowFundPrompt(false)}
                  className="px-4 py-3 text-slate-600 hover:bg-slate-100 hover:text-slate-950 text-sm font-semibold rounded-[10px]"
                >
                  Back to editor
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {publishedSplash && (
        <BountyPublishedSplash
          title={publishedSplash.title}
          amountLabel={publishedSplash.amountLabel}
          onDone={() => {
            const id = publishedSplash.id;
            setPublishedSplash(null);
            if (id) onPublished?.(id);
            onClose();
          }}
        />
      )}
    </div>
  );
}

function BountyPublishedSplash({
  title,
  amountLabel,
  onDone,
}: {
  title: string;
  amountLabel: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="modal-light fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-slate-950/45 p-4 backdrop-blur-sm"
      style={{ animation: "bpFadeIn 220ms ease-out both" }}
      role="dialog"
      aria-live="polite"
      aria-label="Bounty published"
    >
      <div
        className="relative w-full max-w-sm rounded-[10px] border border-slate-200 bg-white p-7 text-center shadow-xl"
        style={{ animation: "bpPop 480ms cubic-bezier(.2,1.4,.4,1) both" }}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg">
          <CheckCircle2 className="w-9 h-9 text-white" strokeWidth={2.5} />
        </div>
        <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-black uppercase text-red-600">
          <Sparkles className="w-3.5 h-3.5" /> Bounty Published
        </div>
        <h2 className="text-xl font-black text-slate-950 mb-1">Your bounty is in! 🎉</h2>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          <span className="text-slate-950 font-semibold">{title}</span> has been published and is
          awaiting admin review.
        </p>
        <div
          className="inline-flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-3 mb-4 text-red-800 text-sm font-bold"

        >
          <Wallet className="h-4 w-4 text-red-600" />
          <span>{amountLabel} escrowed</span>
        </div>
        <p className="text-[11px] text-slate-600 inline-flex items-center gap-1.5 justify-center">
          <ShieldCheck className="h-3.5 w-3.5 text-red-600" />
          It goes live the moment an admin approves it.
        </p>
        <button
          onClick={onDone}
          className="mt-5 px-4 py-3 rounded-[10px] bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold"
        >
          Got it
        </button>
      </div>
      <style>{`
        @keyframes bpFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bpPop {
          0% { transform: scale(0.6); opacity: 0 }
          60% { transform: scale(1.04); opacity: 1 }
          100% { transform: scale(1); opacity: 1 }
        }
      `}</style>
    </div>
  );
}

const inputCls =
  "w-full rounded-[10px] border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 placeholder:text-muted-foreground outline-hidden transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
