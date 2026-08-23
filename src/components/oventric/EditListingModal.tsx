import { useEffect, useState } from "react";
import { X, ImagePlus, Loader2, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateAndResubmitProduct, type ProductDTO } from "@/lib/marketplace.functions";
import { StockToggleField } from "@/components/oventric/StockToggleField";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const PHYS_CATEGORIES = [
  {
    value: "electronics",
    label: "Electronics",
    subs: ["Phones", "Laptops", "Accessories", "Audio", "Cameras"],
  },
  { value: "fashion", label: "Fashion", subs: ["Men", "Women", "Kids", "Shoes", "Watches"] },
  { value: "home", label: "Home & Living", subs: ["Furniture", "Appliances", "Decor", "Kitchen"] },
  {
    value: "beauty",
    label: "Beauty & Health",
    subs: ["Skincare", "Makeup", "Wellness", "Fragrance"],
  },
  { value: "vehicles", label: "Vehicles", subs: ["Cars", "Bikes", "Parts", "Accessories"] },
  { value: "sports", label: "Sports & Outdoors", subs: ["Fitness", "Outdoor", "Team Sports"] },
  { value: "other", label: "Other", subs: [] },
];

const CONDITIONS = ["Brand New", "Used", "Refurbished"];
const YN = ["Yes", "No", "Maybe"];

interface Props {
  product: ProductDTO;
  onClose: () => void;
  onResubmitted: () => void;
}

/**
 * Prefilled edit form for rejected listings. Handles both digital and physical
 * products: fields shown vary by `product.kind`. Existing images are shown and
 * can be removed; new images can be appended (physical only). On submit the
 * product moves back to `pending` and admins are notified.
 */
export function EditListingModal({ product, onClose, onResubmitted }: Props) {
  const persist = useServerFn(updateAndResubmitProduct);
  const snapshotFx = useServerFn(snapshotFxRates);
  const { baseCurrency } = useOnboarding();

  const isPhysical = product.kind === "physical";
  // Live listings stay live after an edit unless the deliverable itself changes.
  const isLive = product.status === "active";


  // Shared fields, prefilled.
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [basicInfo, setBasicInfo] = useState(product.basicInfo ?? "");
  const [inStock, setInStock] = useState(product.inStock !== false);
  const [activationGuide, setActivationGuide] = useState(isPhysical ? "" : (product.activationGuide ?? ""));
  const [category, setCategory] = useState(product.category);
  const [subcategory, setSubcategory] = useState(product.subcategory ?? "");
  // Price is edited in the seller's base currency; on submit we resnap FX.
  const initialLocal =
    product.originalCurrency === baseCurrency
      ? String(product.originalAmount)
      : String(product.priceUSD);
  const [priceInput, setPriceInput] = useState(initialLocal);

  // Physical fields.
  const [location, setLocation] = useState(product.location ?? "");
  const [brand, setBrand] = useState(product.brand ?? "");
  const [condition, setCondition] = useState(product.condition ?? "Brand New");
  const [negotiable, setNegotiable] = useState(product.negotiable ?? "Yes");
  const [delivery, setDelivery] = useState(product.delivery ?? "No");
  const [phone, setPhone] = useState(product.sellerPhone ?? "");
  const [socialLink, setSocialLink] = useState(product.socialLink ?? "");

  // Digital fields.
  const [externalUrl, setExternalUrl] = useState(product.externalUrl ?? "");
  // Optional replacement asset file (digital only).
  const [assetFile, setAssetFile] = useState<File | null>(null);

  // Existing images. Each item pairs a storage path with its signed preview URL
  // so we can render + remove without re-uploading.
  const [existing, setExisting] = useState<Array<{ path: string; url: string }>>(
    product.imagePaths.map((p, i) => ({ path: p, url: product.imageUrls[i] ?? "" })),
  );

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const [sellerResponse, setSellerResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(
    () => () => {
      newPreviews.forEach((p) => URL.revokeObjectURL(p));
    },
    [newPreviews],
  );

  const chosenCat = PHYS_CATEGORIES.find((c) => c.value === category);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const valid: File[] = [];
    for (const f of list) {
      if (!f.type.startsWith("image/")) {
        toast.error("Only images allowed");
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 5MB`);
        continue;
      }
      valid.push(f);
    }
    const combined = [...newFiles, ...valid].slice(0, 8);
    newPreviews.forEach((p) => URL.revokeObjectURL(p));
    setNewFiles(combined);
    setNewPreviews(combined.map((f) => URL.createObjectURL(f)));
  };

  const removeExisting = (idx: number) => {
    setExisting((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeNew = (idx: number) => {
    const next = newFiles.filter((_, i) => i !== idx);
    newPreviews.forEach((p) => URL.revokeObjectURL(p));
    setNewFiles(next);
    setNewPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return toast.error("Title required");
    if (!description.trim()) return toast.error("Description required");
    const priceLocal = Number(priceInput);
    if (!Number.isFinite(priceLocal) || priceLocal < 0)
      return toast.error("Enter a valid price (use 0 for free)");

    let sellerPhone: string | null | undefined = undefined;

    if (isPhysical) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 6) return toast.error("Enter a valid phone number");
      sellerPhone = digits;
      const totalImages = existing.length + newFiles.length;
      if (totalImages < 3) return toast.error("Keep at least 3 product images");
    } else if (existing.length + newFiles.length < 1) {
      return toast.error("Keep at least 1 product image");
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sign in again to save your changes");

      // Upload any newly added gallery images.
      const uploadedPaths: string[] = [];
      if (newFiles.length > 0) {
        setProgress("Uploading new images...");
        for (const img of newFiles) {
          const safe = img.name.replace(/[^\w.\-]+/g, "_");
          const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
          const { error } = await supabase.storage
            .from("product-covers")
            .upload(path, img, { contentType: img.type, upsert: false });
          if (error) throw new Error(error.message);
          uploadedPaths.push(path);
        }
      }
      const imagePaths = [...existing.map((x) => x.path), ...uploadedPaths];

      // Optional replacement asset file (digital listings only).
      let filePath: string | undefined = undefined;
      if (!isPhysical && assetFile) {
        setProgress("Uploading replacement file...");
        const safe = assetFile.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage
          .from("product-files")
          .upload(path, assetFile, { contentType: assetFile.type || undefined, upsert: false });
        if (error) throw new Error(error.message);
        filePath = path;
      }

      setProgress("Locking market rate...");
      const snapshot = await snapshotFx();
      const rate = Number(snapshot.rates[baseCurrency] ?? 1);
      const priceUSD = baseCurrency === "USD" ? priceLocal : Number((priceLocal / rate).toFixed(2));

      setProgress(isLive ? "Saving changes..." : "Resubmitting for review...");
      const res = await persist({
        data: {
          id: product.id,
          name: name.trim(),
          description: description.trim(),
          inStock,
          basicInfo: basicInfo.trim() || null,
          activationGuide: activationGuide.trim() || null,
          category,
          subcategory: subcategory || null,
          priceUSD,
          originalCurrency: baseCurrency,
          originalAmount: priceLocal,
          fxSnapshot: snapshot,
          externalUrl: isPhysical ? null : externalUrl.trim() || null,
          ...(filePath ? { filePath } : {}),
          imagePaths,
          condition: isPhysical ? condition : null,
          brand: isPhysical ? brand.trim() || null : null,
          location: isPhysical ? location.trim() || null : null,
          negotiable: isPhysical ? negotiable : null,
          delivery: isPhysical ? delivery : null,
          sellerPhone: sellerPhone ?? null,
          whatsappNumber: sellerPhone ?? null,
          socialLink: isPhysical ? socialLink.trim() || null : null,
          sellerResponse: sellerResponse.trim() || null,
        },
      });

      if (res.status === "active") {
        toast.success("Listing updated", { description: "Your changes are live." });
      } else {
        toast.success("Sent for review", {
          description: "Your listing will go live once a moderator approves it.",
        });
      }
      setSuccess(true);
      onResubmitted();
    } catch (err) {
      toast.error("Could not save changes", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });

    } finally {
      setSubmitting(false);
      setProgress("");
    }
  };

  return (
    <div
      className="modal-light fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70" onClick={submitting ? undefined : onClose} />
      <div className="slide-up relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {isLive ? "Changes saved" : "Resubmitted for review"}
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              {isLive
                ? "Your listing has been updated and stays live in the marketplace."
                : "Your changes and response have been sent back to the moderation team. You'll get a notification once they take another look."}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-[10px]"
            >
              OK
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Edit Listing</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isPhysical ? "Physical goods listing" : "Digital asset listing"} ·{" "}
                  {product.status === "pending"
                    ? "pending review"
                    : product.status === "active"
                      ? "live"
                      : "currently rejected"}
                </p>
              </div>

              <button
                onClick={onClose}
                disabled={submitting}
                className="p-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-40"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {product.rejectReason && (
              <div className="mb-4 rounded-[10px] border border-amber-500/40 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-widest text-amber-300 mb-1">
                      Moderator note
                    </div>
                    <div className="text-sm text-amber-100 whitespace-pre-wrap break-words">
                      {product.rejectReason}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-300">Title</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                />
              </label>

              {isPhysical && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-300">Category</span>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setSubcategory("");
                      }}
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white"
                    >
                      {PHYS_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {chosenCat && chosenCat.subs.length > 0 && (
                    <label className="block">
                      <span className="text-xs font-medium text-slate-300">Subcategory</span>
                      <select
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white"
                      >
                        <option value="">Optional</option>
                        {chosenCat.subs.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}

              {isPhysical && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-300">Location</span>
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-300">Brand (optional)</span>
                      <input
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                      />
                    </label>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-300">Condition</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {CONDITIONS.map((c) => (
                        <button
                          type="button"
                          key={c}
                          onClick={() => setCondition(c)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                            condition === c
                              ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                              : "bg-[#121214] border-white/10 text-slate-300"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-300">
                      Product images (min 3, first is cover)
                    </span>
                    {(existing.length > 0 || newPreviews.length > 0) && (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {existing.map((img, i) => (
                          <div
                            key={`e-${img.path}`}
                            className={`relative aspect-square rounded-[10px] overflow-hidden border ${i === 0 ? "border-emerald-500/60" : "border-white/10"}`}
                          >
                            {img.url ? (
                              <img loading="lazy"
                                src={img.url}
                                alt=""
                                decoding="async"
                                className="w-full h-full object-cover bg-[#121214]"
                              />
                            ) : (
                              <div className="w-full h-full bg-[#121214]" />
                            )}
                            {i === 0 && (
                              <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-emerald-500/90 text-black rounded px-1">
                                Cover
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeExisting(i)}
                              className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white hover:bg-red-500/80"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {newPreviews.map((src, i) => (
                          <div
                            key={`n-${i}`}
                            className="relative aspect-square rounded-[10px] overflow-hidden border border-emerald-400/40"
                          >
                            <img loading="lazy"
                              src={src}
                              alt=""
                              decoding="async"
                              className="w-full h-full object-cover bg-[#121214]"
                            />
                            <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-emerald-500/90 text-black rounded px-1">
                              New
                            </span>
                            <button
                              type="button"
                              onClick={() => removeNew(i)}
                              className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white hover:bg-red-500/80"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="mt-2 flex items-center gap-3 border border-dashed border-white/15 rounded-[10px] p-3 cursor-pointer hover:border-emerald-500/60">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => addImages(e.target.files)}
                      />
                      <div className="w-12 h-12 rounded-[10px] bg-[#121214] border border-white/10 flex items-center justify-center text-emerald-400">
                        <ImagePlus className="w-5 h-5" />
                      </div>
                      <div className="text-xs text-slate-400">
                        Add more images. PNG/JPG up to 5MB each.
                      </div>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-300">
                      Facebook / YouTube link (optional)
                    </span>
                    <input
                      value={socialLink}
                      onChange={(e) => setSocialLink(e.target.value)}
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                    />
                  </label>
                </>
              )}

              {!isPhysical && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">
                    External URL / download link (optional)
                  </span>
                  <input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://…"
                    className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-300">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60 resize-none"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Basic Info</span>
                  <textarea
                    value={basicInfo}
                    onChange={(e) => setBasicInfo(e.target.value)}
                    rows={3}
                    className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60 resize-none"
                  />
                </label>
                {!isPhysical && (
                  <label className="block">
                    <span className="text-xs font-medium text-slate-300">Activation Guide</span>
                    <textarea
                      value={activationGuide}
                      onChange={(e) => setActivationGuide(e.target.value)}
                      rows={3}
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60 resize-none"
                    />
                  </label>
                )}
              </div>

              <StockToggleField inStock={inStock} onChange={setInStock} disabled={submitting} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Price ({baseCurrency})</span>
                  <input
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    inputMode="decimal"
                    className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                  />
                </label>
                {isPhysical && (
                  <label className="block">
                    <span className="text-xs font-medium text-slate-300">
                      Phone (digits only, with country code)
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      inputMode="numeric"
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                    />
                  </label>
                )}
              </div>

              {isPhysical && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-medium text-slate-300">Open to negotiation?</span>
                    <div className="mt-1 flex gap-2">
                      {YN.map((v) => (
                        <button
                          type="button"
                          key={v}
                          onClick={() => setNegotiable(v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${negotiable === v ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-[#121214] border-white/10 text-slate-300"}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-300">Offer delivery?</span>
                    <div className="mt-1 flex gap-2">
                      {YN.map((v) => (
                        <button
                          type="button"
                          key={v}
                          onClick={() => setDelivery(v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${delivery === v ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-[#121214] border-white/10 text-slate-300"}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-300">
                  Response to moderator (optional)
                </span>
                <textarea
                  value={sellerResponse}
                  onChange={(e) => setSellerResponse(e.target.value)}
                  rows={3}
                  placeholder="Explain what you changed or clarify anything about the listing…"
                  className="mt-1 w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60 resize-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  This note is sent to the admin team along with your resubmission.
                </span>
              </label>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="text-xs text-slate-400 min-h-[1rem]">{progress}</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-3 rounded-[10px] border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? "Resubmitting…" : "Resubmit for review"}
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
