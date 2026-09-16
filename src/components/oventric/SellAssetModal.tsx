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
  const [requiresManualDelivery, setRequiresManualDelivery] = useState(false);
  const [agreedToSplit, setAgreedToSplit] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [success, setSuccess] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div
      className="modal-light fixed inset-0 z-[70] grid h-[100dvh] w-screen place-items-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sell an asset"
    >
      <div className="absolute inset-0 bg-black/70" onClick={submitting ? undefined : onClose} />
      <div className="slide-up relative my-auto w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#1E1E24] sm:bg-white border border-white/10 sm:border-slate-200 rounded-2xl p-6 shadow-2xl">
        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 sm:bg-emerald-100 border border-emerald-400/40 sm:border-emerald-300 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 sm:text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-white sm:text-slate-900 mb-2">
              Submitted for review
            </h2>
            <p className="text-sm text-slate-400 sm:text-slate-600 max-w-md mx-auto mb-3">
              Your asset has been submitted. Our system is scanning it for malware and verifying
              licensing.
            </p>
            <p className="text-xs text-slate-500 sm:text-slate-700 max-w-md mx-auto mb-6">
              If the product is not genuine, missing a valid license, nulled, or contains malware,
              it will be rejected and the poster may be banned. Only upload genuine products with
              valid GPL/commercial licenses.
            </p>
            <button
              onClick={() => {
                reset();
                onClose();
              }}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-[10px]"
            >
              OK
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white sm:text-slate-900">
                  Sell a Digital Asset
                </h2>
                <p className="text-xs text-slate-400 sm:text-slate-600 mt-1">
                  List your digital product in the marketplace. Reviewed by admin before going live.
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="p-2 rounded-[10px] hover:bg-white/5 sm:hover:bg-slate-100 text-slate-400 sm:text-slate-600 hover:text-white sm:hover:text-slate-900 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 flex items-start gap-2 p-3 rounded-[10px] bg-amber-500/5 sm:bg-amber-50 border border-amber-500/20 sm:border-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-400 sm:text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs text-amber-200/90 sm:text-amber-900 leading-relaxed font-medium">
                Every submission is scanned for malware and verified for licensing. Nulled, pirated,
                or malicious uploads are rejected and posters may be banned. Only upload genuine
                products with valid licenses (GPL or commercial).
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                    Asset name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Neon Analytics Dashboard"
                    className="mt-1 w-full bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 placeholder-slate-500 sm:placeholder-slate-400 focus:border-emerald-500/60 sm:focus:border-emerald-500 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                    Category
                  </span>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as ProductCategory);
                      setSubcategory("");
                    }}
                    className="mt-1 w-full bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 outline-none focus:border-emerald-500/60 sm:focus:border-emerald-500"
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
                    <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                      Subcategory (optional)
                    </span>
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="mt-1 w-full bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 outline-none focus:border-emerald-500/60 sm:focus:border-emerald-500"
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

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-200 sm:text-slate-800">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  This is a free product
                </label>
                {!isFree && (
                  <div className="mt-2">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                        Price ({homeCurrency})
                      </span>
                      <input
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        inputMode="decimal"
                        placeholder="29.00"
                        className="mt-1 w-full bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 placeholder-slate-500 sm:placeholder-slate-400 focus:border-emerald-500/60 sm:focus:border-emerald-500 outline-none"
                      />
                    </label>
                  </div>
                )}
                {!isFree && (
                  <div className="mt-2">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                        Buyer cashback (% of the sale, optional)
                      </span>
                      <input
                        value={cashbackInput}
                        onChange={(e) => setCashbackInput(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className="mt-1 w-full bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 placeholder-slate-500 sm:placeholder-slate-400 focus:border-emerald-500/60 sm:focus:border-emerald-500 outline-none"
                      />
                    </label>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
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
                      <div className="mt-2 rounded-[10px] border border-emerald-500/20 sm:border-emerald-200 bg-emerald-500/5 sm:bg-emerald-50 p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-slate-200 sm:text-slate-800">
                          <span>
                            You keep{" "}
                            <span className="text-emerald-300 sm:text-emerald-700 font-bold">
                              80%
                            </span>{" "}
                            → your main wallet
                          </span>
                          <span className="font-semibold text-emerald-300 sm:text-emerald-700">
                            {fmt(sellerGrossLocal)}
                          </span>
                        </div>
                        {cashbackLocal > 0 && (
                          <div className="flex items-center justify-between text-slate-300 sm:text-slate-700">
                            <span>
                              Buyer cashback you fund{" "}
                              <span className="font-bold">{cbPct}%</span>
                            </span>
                            <span className="font-medium">− {fmt(cashbackLocal)}</span>
                          </div>
                        )}
                        {cashbackLocal > 0 && (
                          <div className="flex items-center justify-between text-slate-100 sm:text-slate-900">
                            <span className="font-semibold">Your final earnings</span>
                            <span className="font-bold text-emerald-300 sm:text-emerald-700">
                              {fmt(sellerLocal)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-slate-400 sm:text-slate-600">
                          <span>
                            Oventric Digital Solutions keeps <span className="font-bold">20%</span>
                          </span>
                          <span className="font-medium">{fmt(platformLocal)}</span>
                        </div>
                        <div className="text-[10px] leading-relaxed text-slate-500 sm:text-slate-500 pt-1 border-t border-white/5 sm:border-slate-200">
                          Buyer pays {fmt(priceLocal)}. Your earnings are credited to your Oventric
                          wallet and can be withdrawn to your local bank at any time.
                        </div>
                      </div>
                    );
                  })()}
                {!isFree && (
                  <label
                    className={`mt-2 flex items-start gap-2 text-xs p-3 rounded-[10px] border cursor-pointer ${agreedToSplit ? "border-emerald-500/50 sm:border-emerald-400 bg-emerald-500/5 sm:bg-emerald-50 text-slate-100 sm:text-slate-900" : "border-white/10 sm:border-slate-300 bg-[#121214] sm:bg-white text-slate-300 sm:text-slate-700"}`}
                  >
                    <input
                      type="checkbox"
                      checked={agreedToSplit}
                      onChange={(e) => setAgreedToSplit(e.target.checked)}
                      className="mt-0.5 accent-emerald-500"
                    />
                    <span>
                      I agree to the{" "}
                      <span className="font-semibold text-white sm:text-slate-900">
                        80/20 revenue split
                      </span>{" "}
                      — I keep 80% of every sale, and Oventric Digital Solutions keeps 20% as a
                      platform fee.
                    </span>
                  </label>
                )}
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What buyers get, tech stack, key features…"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                  className="mt-1 w-full min-h-[80px] bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 placeholder-slate-500 sm:placeholder-slate-400 focus:border-emerald-500/60 sm:focus:border-emerald-500 outline-none resize-y"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                    Basic Info
                  </span>
                  <textarea
                    value={basicInfo}
                    onChange={(e) => setBasicInfo(e.target.value)}
                    rows={3}
                    placeholder="Key specifications, requirements..."
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                    className="mt-1 w-full min-h-[80px] bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 placeholder-slate-500 sm:placeholder-slate-400 focus:border-emerald-500/60 sm:focus:border-emerald-500 outline-none resize-y"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                    Activation Guide
                  </span>
                  <textarea
                    value={activationGuide}
                    onChange={(e) => setActivationGuide(e.target.value)}
                    rows={3}
                    placeholder="How to activate/install the product..."
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                    className="mt-1 w-full min-h-[80px] bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 placeholder-slate-500 sm:placeholder-slate-400 focus:border-emerald-500/60 sm:focus:border-emerald-500 outline-none resize-y"
                  />
                </label>
              </div>

              <StockToggleField inStock={inStock} onChange={setInStock} />

              <div>
                <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                  Product images (up to {MAX_IMAGES}, first is cover)
                </span>
                <input
                  ref={imageInputRef}
                  id="sell-asset-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    addImages(e.target.files);
                    if (e.target) e.target.value = "";
                  }}
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none",
                  }}
                />
                <label
                  htmlFor="sell-asset-images"
                  className="mt-2 w-full flex items-center gap-3 border border-dashed border-white/15 sm:border-slate-300 rounded-[10px] p-3 hover:border-emerald-500/60 sm:hover:border-emerald-500 text-left cursor-pointer select-none"
                >
                  <div className="w-16 h-16 rounded-[10px] bg-[#121214] sm:bg-slate-100 border border-white/10 sm:border-slate-300 flex items-center justify-center text-emerald-400 sm:text-emerald-600">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-slate-400 sm:text-slate-600">
                    Tap to add images from your phone or camera roll. PNG/JPG up to {MAX_IMAGE_MB}MB
                    each. {images.length}/{MAX_IMAGES} added.
                  </div>
                </label>

                {previews.length > 0 && (
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {previews.map((src, i) => (
                      <div
                        key={i}
                        className={`relative aspect-square rounded-[10px] overflow-hidden border ${i === 0 ? "border-emerald-500/60 sm:border-emerald-500" : "border-white/10 sm:border-slate-200"}`}
                      >
                        <img loading="lazy" decoding="async" src={src} alt="" className="w-full h-full object-cover" />
                        {i === 0 && (
                          <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-emerald-500/90 text-black rounded px-1">
                            Cover
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white hover:bg-red-500/80"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={
                  requiresManualDelivery ? "opacity-50 pointer-events-none select-none" : ""
                }
                aria-disabled={requiresManualDelivery}
              >
                <span className="text-xs font-medium text-slate-300 sm:text-slate-700">
                  Delivery
                </span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("file")}
                    disabled={requiresManualDelivery}
                    className={`flex items-center gap-2 px-3 py-3 rounded-[10px] border text-sm transition-colors ${mode === "file" ? "border-emerald-500/60 sm:border-emerald-500 bg-emerald-500/10 sm:bg-emerald-50 text-white sm:text-slate-900" : "border-white/10 sm:border-slate-300 bg-[#121214] sm:bg-white text-slate-400 sm:text-slate-600 hover:text-white sm:hover:text-slate-900"}`}
                  >
                    <Upload className="w-4 h-4" /> Upload file
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("url")}
                    disabled={requiresManualDelivery}
                    className={`flex items-center gap-2 px-3 py-3 rounded-[10px] border text-sm transition-colors ${mode === "url" ? "border-emerald-500/60 sm:border-emerald-500 bg-emerald-500/10 sm:bg-emerald-50 text-white sm:text-slate-900" : "border-white/10 sm:border-slate-300 bg-[#121214] sm:bg-white text-slate-400 sm:text-slate-600 hover:text-white sm:hover:text-slate-900"}`}
                  >
                    <Link2 className="w-4 h-4" /> External link
                  </button>
                </div>

                {mode === "file" ? (
                  <>
                    <input
                      ref={fileInputRef}
                      id="sell-asset-file"
                      type="file"
                      disabled={requiresManualDelivery}
                      style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        opacity: 0,
                        pointerEvents: "none",
                      }}
                      onChange={(e) => {
                        handleFile(e.target.files?.[0] ?? null);
                        if (e.target) e.target.value = "";
                      }}
                      accept=".zip,.rar,.7z,.tar,.gz,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed"
                    />
                    <label
                      htmlFor="sell-asset-file"
                      className="mt-2 w-full block border border-dashed border-white/15 sm:border-slate-300 rounded-[10px] p-4 text-center cursor-pointer hover:border-emerald-500/60 sm:hover:border-emerald-500 transition-colors select-none"
                    >
                      {file ? (
                        <div className="text-sm text-white sm:text-slate-900">
                          <div className="font-medium truncate">{file.name}</div>
                          <div className="text-xs text-slate-400 sm:text-slate-500 mt-1">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB — tap to replace
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 sm:text-slate-600">
                          <Upload className="w-5 h-5 mx-auto mb-2 text-emerald-400 sm:text-emerald-600" />
                          <div className="font-medium text-slate-200 sm:text-slate-900">
                            Tap to upload product ZIP file
                          </div>
                          <div className="text-xs mt-1">ZIP / RAR / 7Z — max {MAX_FILE_MB}MB</div>
                        </div>
                      )}
                    </label>
                  </>
                ) : (
                  <input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    disabled={requiresManualDelivery}
                    placeholder="https://your-delivery-link.com/download"
                    className="mt-2 w-full bg-[#121214] sm:bg-white border border-white/10 sm:border-slate-300 rounded-[10px] px-3 py-3 text-sm text-white sm:text-slate-900 placeholder-slate-500 sm:placeholder-slate-400 focus:border-emerald-500/60 sm:focus:border-emerald-500 outline-none"
                  />
                )}
              </div>

              {requiresManualDelivery && (
                <div className="rounded-[10px] border border-amber-500/40 sm:border-amber-300 bg-amber-500/5 sm:bg-amber-50 p-3 text-[12px] sm:text-xs text-amber-100 sm:text-amber-900 leading-relaxed">
                  <div className="font-semibold text-amber-200 sm:text-amber-900 mb-1">
                    Manual delivery selected — file / link fields are locked.
                  </div>
                  After a buyer pays, funds are held in escrow and you must deliver on Oventric
                  (share a link, upload a file, or attach it in the buyer's chat). We also relay the
                  order to your Oventric inbox and email. Payment releases to your wallet only after
                  the buyer confirms receipt.{" "}
                  <span className="text-amber-300 sm:text-amber-800 font-semibold">
                    Never finish deals on WhatsApp or any other app
                  </span>{" "}
                  — escrow, refunds and dispute mediation only cover trades completed on Oventric.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-2 text-sm p-3 rounded-[10px] border ${!requiresManualDelivery ? "bg-emerald-500/5 sm:bg-emerald-50 border-emerald-500/30 sm:border-emerald-200 text-slate-100 sm:text-slate-900" : "bg-[#121214] sm:bg-slate-100 border-white/10 sm:border-slate-300 text-slate-200 sm:text-slate-800"}`}
                >
                  <input
                    type="checkbox"
                    checked={!requiresManualDelivery}
                    onChange={(e) => setRequiresManualDelivery(!e.target.checked)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span>
                    <span className="flex items-center gap-1 font-medium">
                      <Zap className="w-3.5 h-3.5 text-emerald-400 sm:text-emerald-600" /> Instant
                      download
                    </span>
                    <span className="block text-[11px] text-slate-400 sm:text-slate-600 mt-0.5">
                      Buyer gets the file (or link) automatically as soon as payment is confirmed —
                      no action needed from you. Best for themes, plugins, scripts, and any packaged
                      download.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-2 text-sm p-3 rounded-[10px] border ${requiresManualDelivery ? "bg-emerald-500/5 sm:bg-emerald-50 border-emerald-500/30 sm:border-emerald-200 text-slate-100 sm:text-slate-900" : "bg-[#121214] sm:bg-slate-100 border-white/10 sm:border-slate-300 text-slate-200 sm:text-slate-800"}`}
                >
                  <input
                    type="checkbox"
                    checked={requiresManualDelivery}
                    onChange={(e) => setRequiresManualDelivery(e.target.checked)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span>
                    <span className="block font-medium">Requires manual delivery / setup</span>
                    <span className="block text-[11px] text-slate-400 sm:text-slate-600 mt-0.5">
                      Check this if the buyer needs custom deployment (SaaS setup, provisioning,
                      license issuance) instead of an instant download. We’ll collect their email at
                      checkout and open an order chat so you can deliver in-app.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 sm:border-slate-200">
                <div className="text-xs text-slate-400 sm:text-slate-600 min-h-[1rem]">
                  {progress}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-3 rounded-[10px] border border-white/10 sm:border-slate-300 text-slate-300 sm:text-slate-700 hover:text-white sm:hover:text-slate-900 hover:bg-white/5 sm:hover:bg-slate-100 text-sm disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (!isFree && !agreedToSplit)}
                    className="px-4 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? "Submitting…" : "Submit for review"}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
