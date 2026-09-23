import { useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Link2,
  Loader2,
  CheckCircle2,
  ImagePlus,
  Trash2,
  ShieldAlert,
  Zap,
  ShoppingBag,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StockToggleField } from "@/components/oventric/StockToggleField";
import {
  createProduct,
  listMarketplaceCategories,
  FX_FROM_USD,
  type ProductCategory,
  type CategoryNode,
  type OrderCurrency,
} from "@/lib/marketplace.functions";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { Button } from "@/components/ui/button";

const FALLBACK_CATEGORIES: CategoryNode[] = [
  {
    id: "themes",
    slug: "themes",
    name: "Themes",
    description: "",
    kind: "digital",
    parentId: null,
    sortOrder: 10,
    children: [],
  },
  {
    id: "plugins",
    slug: "plugins",
    name: "Plugins",
    description: "",
    kind: "digital",
    parentId: null,
    sortOrder: 20,
    children: [],
  },
  {
    id: "blocks",
    slug: "blocks",
    name: "Blocks",
    description: "",
    kind: "digital",
    parentId: null,
    sortOrder: 30,
    children: [],
  },
  {
    id: "scripts",
    slug: "scripts",
    name: "Scripts",
    description: "",
    kind: "digital",
    parentId: null,
    sortOrder: 40,
    children: [],
  },
];

const MAX_FILE_MB = 50;
const MAX_IMAGE_MB = 10;
const MAX_IMAGES = 5;
const fieldClass =
  "mt-1 w-full rounded-[10px] border border-contact-line bg-contact-field px-3 py-2.5 text-sm text-contact-ink outline-none transition-[border-color,box-shadow,background-color] placeholder:text-contact-muted focus:border-contact-violet focus:bg-contact-surface focus:ring-4 focus:ring-contact-violet/10";
const labelClass = "text-xs font-bold text-contact-ink";

export function SellAssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const persist = useServerFn(createProduct);
  const snapshotFx = useServerFn(snapshotFxRates);
  const loadCats = useServerFn(listMarketplaceCategories);
  const [categories, setCategories] = useState<CategoryNode[]>(FALLBACK_CATEGORIES);
  const { homeCurrency } = useOnboarding();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("themes");
  const [subcategory, setSubcategory] = useState<string>("");
  useEffect(() => {
    loadCats()
      .then((rows) => {
        const digital = (rows ?? []).filter((r) => r.kind === "digital");
        if (digital.length > 0) {
          setCategories(digital);
          setCategory((prev) => (digital.some((d) => d.slug === prev) ? prev : digital[0].slug));
        }
      })
      .catch(() => {});
  }, [loadCats]);

  const [description, setDescription] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [cashbackInput, setCashbackInput] = useState("");
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [basicInfo, setBasicInfo] = useState("");
  const [activationGuide, setActivationGuide] = useState("");
  const [inStock, setInStock] = useState(true);
  const [stockInput, setStockInput] = useState("");
  const [requiresManualDelivery, setRequiresManualDelivery] = useState(false);
  const [agreedToSplit, setAgreedToSplit] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [success, setSuccess] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = {
      overflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      overscrollBehavior: document.documentElement.style.overscrollBehavior,
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previous.overflow;
      document.documentElement.style.overflow = previous.htmlOverflow;
      document.documentElement.style.overscrollBehavior = previous.overscrollBehavior;
    };
  }, [open]);

  if (!open) return null;

  const reset = () => {
    setName("");
    setDescription("");
    setBasicInfo("");
    setActivationGuide("");
    setPriceInput("");
    setDiscountInput("");
    setIsFree(false);
    setFile(null);
    setExternalUrl("");
    setMode("file");
    setProgress("");
    setRequiresManualDelivery(false);
    setAgreedToSplit(false);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages([]);
    setPreviews([]);
    setSuccess(false);
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} is not an image`);
        continue;
      }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        toast.error(`${f.name} over ${MAX_IMAGE_MB}MB`);
        continue;
      }
      valid.push(f);
    }
    const next = [...images, ...valid].slice(0, MAX_IMAGES);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (i: number) => {
    const next = images.filter((_, idx) => idx !== i);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const handleFile = (f: File | null) => {
    if (!f) return setFile(null);
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error("File too large", { description: `Max ${MAX_FILE_MB}MB per asset.` });
      return;
    }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return toast.error("Asset name required");
    if (!description.trim()) return toast.error("Description required");
    if (images.length < 1) return toast.error("Add at least 1 product image (first is cover)");
    if (!isFree && !agreedToSplit)
      return toast.error("Please agree to the 80/20 revenue split to continue");
    const mainLocal = isFree ? 0 : Number(priceInput);
    const discountLocal = isFree ? 0 : discountInput.trim() ? Number(discountInput) : 0;
    if (!isFree && !(mainLocal > 0))
      return toast.error("Enter a price greater than 0 or mark as free");
    if (!isFree && discountLocal > 0 && discountLocal >= mainLocal)
      return toast.error("Discount price must be lower than the main price");
    const priceLocal = discountLocal > 0 ? discountLocal : mainLocal;

    // Instant download requires either a file or an external delivery URL.
    // Manual delivery orders skip this check — seller delivers after purchase.
    if (!requiresManualDelivery) {
      if (mode === "file" && !file)
        return toast.error("Attach a digital file or switch to External link");
      if (mode === "url" && !/^https?:\/\//i.test(externalUrl.trim()))
        return toast.error("Provide a valid https:// delivery URL for instant download");
    }

    setSubmitting(true);
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData.user) throw new Error("You must be signed in to sell.");
      const uid = userData.user.id;
      const email = userData.user.email ?? "";
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", uid)
        .maybeSingle();
      const vendorName =
        (prof?.display_name && String(prof.display_name).trim()) ||
        (prof?.username && String(prof.username).trim()) ||
        (email ? email.split("@")[0] : "") ||
        "Member";

      setProgress(`Uploading images (0/${images.length})…`);
      const imagePaths: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const safe = img.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        setProgress(`Uploading “${img.name}” (${i + 1}/${images.length})…`);
        const { error: uErr2 } = await supabase.storage
          .from("product-covers")
          .upload(path, img, { contentType: img.type, upsert: false });
        if (uErr2) throw new Error(uErr2.message);
        imagePaths.push(path);
      }

      let filePath: string | null = null;
      if (mode === "file" && file) {
        setProgress("Uploading asset file…");
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("product-files")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw new Error(upErr.message);
        filePath = path;
      }

      setProgress("Locking market rate…");
      const snapshot = await snapshotFx();
      const rate = Number(snapshot.rates[homeCurrency] ?? 1);
      const priceUSD = isFree
        ? 0
        : homeCurrency === "USD"
          ? priceLocal
          : Number((priceLocal / rate).toFixed(2));

      const fmtLocal = (n: number) =>
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: homeCurrency,
          maximumFractionDigits: 2,
        }).format(n);
      const noteLines: string[] = [];
      if (discountLocal > 0)
        noteLines.push(`🏷️ On sale — was ${fmtLocal(mainLocal)}, now ${fmtLocal(discountLocal)}`);
      const fullDescription =
        noteLines.length > 0
          ? `${noteLines.join("\n")}\n\n${description.trim()}`
          : description.trim();

      setProgress("Submitting for review…");
      await persist({
        data: {
          name: name.trim(),
          category,
          subcategory: subcategory || null,

          description: fullDescription,
          priceUSD,
          cashbackPct: isFree ? 0 : Math.max(0, Math.min(50, Number(cashbackInput) || 0)),
          originalCurrency: homeCurrency,
          originalAmount: priceLocal,
          fxSnapshot: snapshot,
          vendor: vendorName,
          externalUrl: mode === "url" ? externalUrl.trim() : null,
          filePath,
          coverPath: imagePaths[0] ?? null,
          imagePaths,
          requiresManualDelivery,
          inStock,
          stockQuantity: stockInput.trim() === "" ? null : Math.max(0, Math.floor(Number(stockInput) || 0)),
          basicInfo: basicInfo.trim() || null,
          activationGuide: activationGuide.trim() || null,
        },
      });
      setSuccess(true);
    } catch (err) {
      toast.error("Listing failed", {
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  };

  return (
    <div
      className="modal-light web-sell-asset fixed inset-0 z-[70] flex h-[100dvh] w-screen items-start justify-center overflow-hidden px-0 pt-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Sell an asset"
    >
      <div className="absolute inset-0 bg-foreground/55 backdrop-blur-[2px]" onClick={submitting ? undefined : onClose} />
      <div className="web-sell-panel slide-up relative flex max-h-[calc(100dvh-0.75rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[20px] border border-contact-line bg-contact-surface text-contact-ink shadow-contact-sheet sm:max-h-[calc(100dvh-3rem)] sm:rounded-[18px]">
        <div className="grid h-1.5 shrink-0 grid-cols-5" aria-hidden="true">
          <span className="bg-contact-whatsapp" />
          <span className="bg-contact-blue" />
          <span className="bg-contact-violet" />
          <span className="bg-contact-gold" />
          <span className="bg-contact-coral" />
        </div>
        <div className="sell-asset-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
        {success ? (
          <div className="px-5 py-10 text-center sm:px-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] border border-contact-whatsapp/25 bg-contact-whatsapp-soft">
              <CheckCircle2 className="h-8 w-8 text-contact-whatsapp" />
            </div>
            <h2 className="mb-2 text-xl font-black text-contact-ink">
              Submitted for review
            </h2>
            <p className="mx-auto mb-3 max-w-md text-sm text-contact-copy">
              Your asset has been submitted. Our system is scanning it for malware and verifying
              licensing.
            </p>
            <p className="mx-auto mb-6 max-w-md text-xs text-contact-muted">
              If the product is not genuine, missing a valid license, nulled, or contains malware,
              it will be rejected and the poster may be banned. Only upload genuine products with
              valid GPL/commercial licenses.
            </p>
            <Button
              onClick={() => {
                reset();
                onClose();
              }}
              className="h-11 rounded-[10px] bg-contact-whatsapp px-6 font-bold text-contact-on-whatsapp shadow-none hover:bg-contact-whatsapp-strong"
            >
              OK
            </Button>
          </div>
        ) : (
          <>
            <header className="sell-asset-header sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-contact-line bg-contact-surface/95 px-4 py-3 backdrop-blur-md sm:px-7 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-contact-violet/10 text-contact-violet sm:h-12 sm:w-12">
                  <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-extrabold uppercase text-contact-violet">
                    Marketplace publish
                  </span>
                  <h2 className="truncate text-lg font-black leading-tight text-contact-ink sm:text-xl">
                    Sell a digital product
                  </h2>
                  <p className="mt-0.5 hidden text-xs text-contact-copy sm:block">
                    Add your product details, delivery and pricing.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                disabled={submitting}
                className="h-9 w-9 shrink-0 rounded-full text-contact-muted hover:bg-contact-field hover:text-contact-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-[10px] border border-contact-gold/25 bg-contact-gold/10 p-3 sm:mx-7">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-contact-gold" />
              <p className="text-[11px] font-medium leading-relaxed text-contact-ink sm:text-xs">
                Every submission is scanned for malware and verified for licensing. Nulled, pirated,
                or malicious uploads are rejected and posters may be banned. Only upload genuine
                products with valid licenses (GPL or commercial).
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-7">
              <section className="rounded-[10px] border border-contact-blue/20 bg-contact-blue/5 p-3.5 sm:p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase text-contact-blue">Product details</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Asset name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Neon Analytics Dashboard"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Category</span>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as ProductCategory);
                      setSubcategory("");
                    }}
                    className={fieldClass}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                </div>
              {(() => {
                const chosen = categories.find((c) => c.slug === category);
                if (!chosen || chosen.children.length === 0) return null;
                return (
                  <label className="block">
                    <span className={labelClass}>Subcategory (optional)</span>
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">— None —</option>
                      {chosen.children.map((s) => (
                        <option key={s.id} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })()}
              </section>

              <section className="rounded-[10px] border border-contact-violet/20 bg-contact-violet/5 p-3.5 sm:p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase text-contact-violet">Pricing & earnings</p>
                <label className="flex items-center gap-2 text-sm font-semibold text-contact-ink">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="accent-contact-violet"
                  />
                  This is a free product
                </label>
                {!isFree && (
                  <div className="mt-2">
                    <label className="block">
                      <span className={labelClass}>Price ({homeCurrency})</span>
                      <input
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        inputMode="decimal"
                        placeholder="29.00"
                        className={fieldClass}
                      />
                    </label>
                  </div>
                )}
                {!isFree && (
                  <div className="mt-2">
                    <label className="block">
                      <span className={labelClass}>Buyer cashback (% of the sale, optional)</span>
                      <input
                        value={cashbackInput}
                        onChange={(e) => setCashbackInput(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className={fieldClass}
                      />
                    </label>
                    <p className="mt-1 text-[10px] leading-relaxed text-contact-muted">
                      Reward buyers with Oventric credit on this product. It is paid out of your own
                      80% share (max 50%), and buyers can spend it on future Oventric purchases.
                    </p>
                  </div>
                )}
                {!isFree &&
                  Number(priceInput) > 0 &&
                  (() => {
                    const cur = homeCurrency as OrderCurrency;
                    const priceLocal = Number(priceInput);
                    const cbPct = Math.max(0, Math.min(50, Number(cashbackInput) || 0));
                    const platformLocal = priceLocal * 0.2;
                    const sellerGrossLocal = priceLocal * 0.8;
                    const cashbackLocal = Math.min(sellerGrossLocal, (priceLocal * cbPct) / 100);
                    const sellerLocal = sellerGrossLocal - cashbackLocal;
                    const fmt = (n: number) =>
                      new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: cur,
                        maximumFractionDigits: 2,
                      }).format(n);
                    return (
                      <div className="mt-2 space-y-1.5 rounded-[10px] border border-contact-whatsapp/20 bg-contact-whatsapp-soft p-3 text-xs">
                        <div className="flex items-center justify-between text-contact-ink">
                          <span>
                            You keep{" "}
                            <span className="font-bold text-contact-whatsapp-strong">
                              80%
                            </span>{" "}
                            → your main wallet
                          </span>
                          <span className="font-semibold text-contact-whatsapp-strong">
                            {fmt(sellerGrossLocal)}
                          </span>
                        </div>
                        {cashbackLocal > 0 && (
                          <div className="flex items-center justify-between text-contact-copy">
                            <span>
                              Buyer cashback you fund{" "}
                              <span className="font-bold">{cbPct}%</span>
                            </span>
                            <span className="font-medium">− {fmt(cashbackLocal)}</span>
                          </div>
                        )}
                        {cashbackLocal > 0 && (
                          <div className="flex items-center justify-between text-contact-ink">
                            <span className="font-semibold">Your final earnings</span>
                            <span className="font-bold text-contact-whatsapp-strong">
                              {fmt(sellerLocal)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-contact-copy">
                          <span>
                            Oventric Digital Solutions keeps <span className="font-bold">20%</span>
                          </span>
                          <span className="font-medium">{fmt(platformLocal)}</span>
                        </div>
                        <div className="border-t border-contact-whatsapp/15 pt-1 text-[10px] leading-relaxed text-contact-muted">
                          Buyer pays {fmt(priceLocal)}. Your earnings are credited to your Oventric
                          wallet and can be withdrawn to your local bank at any time.
                        </div>
                      </div>
                    );
                  })()}
                {!isFree && (
                  <label
                    className={`mt-2 flex cursor-pointer items-start gap-2 rounded-[10px] border p-3 text-xs ${agreedToSplit ? "border-contact-violet/35 bg-contact-violet/10 text-contact-ink" : "border-contact-line bg-contact-surface text-contact-copy"}`}
                  >
                    <input
                      type="checkbox"
                      checked={agreedToSplit}
                      onChange={(e) => setAgreedToSplit(e.target.checked)}
                      className="mt-0.5 accent-contact-violet"
                    />
                    <span>
                      I agree to the{" "}
                      <span className="font-semibold text-contact-ink">
                        80/20 revenue split
                      </span>{" "}
                      — I keep 80% of every sale, and Oventric Digital Solutions keeps 20% as a
                      platform fee.
                    </span>
                  </label>
                )}
              </section>

              <section className="rounded-[10px] border border-contact-coral/20 bg-contact-coral/5 p-3.5 sm:p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase text-contact-coral">Description & instructions</p>
              <label className="block">
                <span className={labelClass}>Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What buyers get, tech stack, key features…"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                  className={`${fieldClass} min-h-[76px] resize-y`}
                />
              </label>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Basic Info</span>
                  <textarea
                    value={basicInfo}
                    onChange={(e) => setBasicInfo(e.target.value)}
                    rows={3}
                    placeholder="Key specifications, requirements..."
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                    className={`${fieldClass} min-h-[76px] resize-y`}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Activation Guide</span>
                  <textarea
                    value={activationGuide}
                    onChange={(e) => setActivationGuide(e.target.value)}
                    rows={3}
                    placeholder="How to activate/install the product..."
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                    className={`${fieldClass} min-h-[76px] resize-y`}
                  />
                </label>
              </div>
              </section>

              <StockToggleField inStock={inStock} onChange={setInStock} appearance="light" />

              <label className="block">
                <span className={labelClass}>Stock available (optional)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  placeholder="Leave blank for unlimited"
                  className={fieldClass}
                />
                <span className="mt-1 block text-[11px] text-contact-muted">
                  Shown on the product page as &quot;X in stock&quot;. Blank means unlimited copies.
                </span>
              </label>

              <section className="rounded-[10px] border border-contact-blue/20 bg-contact-blue/5 p-3.5 sm:p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase text-contact-blue">Product gallery</p>
                <span className={labelClass}>
                  Product images (up to {MAX_IMAGES}, first is cover)
                </span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    addImages(e.target.files);
                    if (e.target) e.target.value = "";
                  }}
                  className="sr-only"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                  className="mt-2 flex h-auto w-full min-w-0 cursor-pointer select-none items-center justify-start gap-3 whitespace-normal rounded-[10px] border border-dashed border-contact-blue/35 bg-contact-surface p-3 text-left transition-colors hover:border-contact-blue"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] border border-contact-blue/20 bg-contact-blue/10 text-contact-blue sm:h-16 sm:w-16">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 text-left text-xs leading-relaxed text-contact-copy">
                    Tap to add images from your phone or camera roll. PNG/JPG up to {MAX_IMAGE_MB}MB
                    each. {images.length}/{MAX_IMAGES} added.
                  </div>
                </Button>

                {previews.length > 0 && (
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {previews.map((src, i) => (
                      <div
                        key={i}
                        className={`relative aspect-square overflow-hidden rounded-[10px] border ${i === 0 ? "border-contact-blue" : "border-contact-line"}`}
                      >
                        <img loading="lazy" decoding="async" src={src} alt="" className="w-full h-full object-cover" />
                        {i === 0 && (
                          <span className="absolute left-1 top-1 rounded bg-contact-blue px-1 text-[9px] font-bold uppercase text-contact-surface">
                            Cover
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => removeImage(i)}
                          className="absolute right-1 top-1 h-7 w-7 rounded-[8px] shadow-none"
                          aria-label={`Remove image ${i + 1}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {!requiresManualDelivery && (
              <section className="rounded-[10px] border border-contact-gold/25 bg-contact-gold/5 p-3.5 sm:p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase text-contact-gold">Delivery</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode("file")}
                    className={`h-11 rounded-[10px] border px-3 text-sm shadow-none ${mode === "file" ? "border-contact-gold/50 bg-contact-gold/15 text-contact-ink" : "border-contact-line bg-contact-surface text-contact-copy hover:bg-contact-field hover:text-contact-ink"}`}
                  >
                    <Upload className="w-4 h-4" /> Upload file
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode("url")}
                    className={`h-11 rounded-[10px] border px-3 text-sm shadow-none ${mode === "url" ? "border-contact-gold/50 bg-contact-gold/15 text-contact-ink" : "border-contact-line bg-contact-surface text-contact-copy hover:bg-contact-field hover:text-contact-ink"}`}
                  >
                    <Link2 className="w-4 h-4" /> External link
                  </Button>
                </div>

                {mode === "file" ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        handleFile(e.target.files?.[0] ?? null);
                        if (e.target) e.target.value = "";
                      }}
                      accept=".zip,.rar,.7z,.tar,.gz,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 block w-full cursor-pointer select-none rounded-[10px] border border-dashed border-contact-gold/40 bg-contact-surface p-4 text-center transition-colors hover:border-contact-gold"
                    >
                      {file ? (
                        <div className="text-sm text-contact-ink">
                          <div className="font-medium truncate">{file.name}</div>
                          <div className="mt-1 text-xs text-contact-muted">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB — tap to replace
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-contact-copy">
                          <Upload className="mx-auto mb-2 h-5 w-5 text-contact-gold" />
                          <div className="font-medium text-contact-ink">
                            Tap to upload product ZIP file
                          </div>
                          <div className="text-xs mt-1">ZIP / RAR / 7Z — max {MAX_FILE_MB}MB</div>
                        </div>
                      )}
                    </Button>
                  </>
                ) : (
                  <input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://your-delivery-link.com/download"
                    className={fieldClass}
                  />
                )}
              </section>
              )}

              {requiresManualDelivery && (
                <div className="rounded-[10px] border border-contact-coral/25 bg-contact-coral/5 p-3 text-[12px] leading-relaxed text-contact-copy sm:text-xs">
                  <div className="mb-1 font-semibold text-contact-ink">
                    Manual delivery selected — file / link fields are locked.
                  </div>
                  After a buyer pays, funds are held in escrow and you must deliver on Oventric
                  (share a link, upload a file, or attach it in the buyer's chat). We also relay the
                  order to your Oventric inbox and email. Payment releases to your wallet only after
                  the buyer confirms receipt.{" "}
                  <span className="font-semibold text-contact-ink">
                    Never finish deals on WhatsApp or any other app
                  </span>{" "}
                  — escrow, refunds and dispute mediation only cover trades completed on Oventric.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-2 rounded-[10px] border p-3 text-sm ${!requiresManualDelivery ? "border-contact-whatsapp/30 bg-contact-whatsapp-soft text-contact-ink" : "border-contact-line bg-contact-field text-contact-copy"}`}
                >
                  <input
                    type="checkbox"
                    checked={!requiresManualDelivery}
                    onChange={(e) => setRequiresManualDelivery(!e.target.checked)}
                    className="mt-0.5 accent-contact-whatsapp"
                  />
                  <span>
                    <span className="flex items-center gap-1 font-medium">
                      <Zap className="h-3.5 w-3.5 text-contact-whatsapp" /> Instant
                      download
                    </span>
                    <span className="mt-0.5 block text-[11px] text-contact-copy">
                      Buyer gets the file (or link) automatically as soon as payment is confirmed —
                      no action needed from you. Best for themes, plugins, scripts, and any packaged
                      download.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-2 rounded-[10px] border p-3 text-sm ${requiresManualDelivery ? "border-contact-coral/30 bg-contact-coral/5 text-contact-ink" : "border-contact-line bg-contact-field text-contact-copy"}`}
                >
                  <input
                    type="checkbox"
                    checked={requiresManualDelivery}
                    onChange={(e) => setRequiresManualDelivery(e.target.checked)}
                    className="mt-0.5 accent-contact-coral"
                  />
                  <span>
                    <span className="block font-medium">Requires manual delivery / setup</span>
                    <span className="mt-0.5 block text-[11px] text-contact-copy">
                      Check this if the buyer needs custom deployment (SaaS setup, provisioning,
                      license issuance) instead of an instant download. We’ll collect their email at
                      checkout and open an order chat so you can deliver in-app.
                    </span>
                  </span>
                </label>
              </div>

              <div className="sticky bottom-0 z-10 -mx-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-contact-line bg-contact-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:-mx-7 sm:px-7 sm:pb-0">
                <div className="min-h-[1rem] truncate text-xs text-contact-muted">
                  {progress}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={submitting}
                    className="h-11 rounded-[10px] border-contact-line bg-contact-surface px-3 text-contact-copy shadow-none hover:bg-contact-field hover:text-contact-ink sm:px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || (!isFree && !agreedToSplit)}
                    className="h-11 rounded-[10px] bg-contact-violet px-3 text-sm font-bold text-contact-surface shadow-none hover:bg-contact-violet/90 sm:px-4"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? "Submitting…" : "Submit for review"}
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
