import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Star,
  Trash2,
  Pencil,
  Plus,
  X,
  ImagePlus,
  FileArchive,
  Check,
  XCircle,
  Eye,
  MapPin,
  RefreshCw,
  PackageX,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllProducts,
  deleteProductAdmin,
  setProductPromoted,
  adminCreateProduct,
  adminUpdateProduct,
  approveProduct,
  rejectProduct,
  adminSetProductStock,
} from "@/lib/admin.functions";
import { SellSwitcherModal } from "@/components/oventric/SellSwitcherModal";
import { computeDisplayPrice, formatMoney, usdRate } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";

import { ResponsiveImage } from "@/components/ui/responsive-image";

const PRICE_CURRENCIES: Currency[] = ["USD", "NGN", "GHS"];
export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [{ title: "Products · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ProductsPage,
});

type Row = Record<string, unknown>;

const CATEGORIES = ["themes", "plugins", "blocks", "scripts"] as const;

interface FormState {
  id?: string;
  // Oventric is digital-only; physical listings no longer exist.
  kind: "digital";
  name: string;
  category: string;
  subcategory: string;
  description: string;
  price_usd: string;
  vendor: string;
  external_url: string;
  promoted: boolean;
  cover_path: string | null;
  cover_preview: string | null;
  file_path: string | null;
  file_name: string | null;
  brand: string;
  condition: string;
  location: string;
  negotiable: string;
  delivery: string;
  seller_phone: string;
  whatsapp_number: string;
  social_link: string;
}

const emptyForm: FormState = {
  kind: "digital",
  name: "",
  category: "themes",
  subcategory: "",
  description: "",
  price_usd: "",
  vendor: "",
  external_url: "",
  promoted: false,
  cover_path: null,
  cover_preview: null,
  file_path: null,
  file_name: null,
  brand: "",
  condition: "Brand New",
  location: "",
  negotiable: "Yes",
  delivery: "No",
  seller_phone: "",
  whatsapp_number: "",
  social_link: "",
};

const MAX_ASSET_MB = 50;

function ProductsPage() {
  const listFn = useServerFn(listAllProducts);
  const delFn = useServerFn(deleteProductAdmin);
  const promFn = useServerFn(setProductPromoted);
  const createFn = useServerFn(adminCreateProduct);
  const updateFn = useServerFn(adminUpdateProduct);
  const approveFn = useServerFn(approveProduct);
  const rejectFn = useServerFn(rejectProduct);
  const stockFn = useServerFn(adminSetProductStock);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "rejected">(
    "pending",
  );
  
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectHint, setRejectHint] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showSellSwitcher, setShowSellSwitcher] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [priceCurrency, setPriceCurrency] = useState<Currency>("USD");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await listFn();
      setRows(r as Row[]);
      setLastRefreshAt(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [listFn]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  // If the current status filter is empty for the selected kind, fall back to "all"
  // so switching to a tab (e.g. Physical) never looks empty when rows actually exist.
  useEffect(() => {
    if (!rows || statusFilter === "all") return;
    const inKind = rows.filter((r) =>
      kindFilter === "all" ? true : ((r.kind as string) ?? "digital") === kindFilter,
    );
    if (
      inKind.length > 0 &&
      inKind.filter((r) => (r.status as string) === statusFilter).length === 0
    ) {
      setStatusFilter("all");
    }
  }, [rows, kindFilter, statusFilter]);

  const filtered = (rows ?? []).filter((p) => {
    if (statusFilter !== "all" && (p.status as string) !== statusFilter) return false;
    if (kindFilter !== "all" && ((p.kind as string) ?? "digital") !== kindFilter) return false;
    return true;
  });

  const openCreate = () => setShowSellSwitcher(true);
  const openEdit = async (p: Row) => {
    const imagePaths = Array.isArray(p.image_paths) ? (p.image_paths as string[]) : [];
    const coverPath = ((p.cover_path as string) || imagePaths[0]) ?? null;
    let coverPreview: string | null = null;
    if (coverPath) {
      const { data: signed } = await supabase.storage
        .from("product-covers")
        .createSignedUrl(coverPath, 60 * 60);
      coverPreview = signed?.signedUrl ?? null;
    }
    const filePath = (p.file_path as string) ?? null;
    setModal({
      id: p.id as string,
      kind: (p.kind as string) === "physical" ? "physical" : "digital",
      name: (p.name as string) ?? "",
      category: (p.category as string) ?? "themes",
      subcategory: (p.subcategory as string) ?? "",
      description: (p.description as string) ?? "",
      price_usd: String(p.price_usd ?? ""),
      vendor: (p.vendor as string) ?? "",
      external_url: (p.external_url as string) ?? "",
      promoted: Boolean(p.promoted),
      cover_path: coverPath,
      cover_preview: coverPreview,
      file_path: filePath,
      file_name: filePath ? (filePath.split("/").pop() ?? null) : null,
      brand: (p.brand as string) ?? "",
      condition: (p.condition as string) ?? "Brand New",
      location: (p.location as string) ?? "",
      negotiable: (p.negotiable as string) ?? "Yes",
      delivery: (p.delivery as string) ?? "No",
      seller_phone: (p.seller_phone as string) ?? "",
      whatsapp_number: (p.whatsapp_number as string) ?? "",
      social_link: (p.social_link as string) ?? "",
    });
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);

  const handleCoverPick = async (file: File) => {
    if (!modal) return;
    if (!file.type.startsWith("image/")) return toast.error("Cover must be an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploadingCover(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id ?? "admin";
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage
        .from("product-covers")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("product-covers")
        .createSignedUrl(path, 60 * 60);
      setModal((m) =>
        m ? { ...m, cover_path: path, cover_preview: signed?.signedUrl ?? null } : m,
      );
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleAssetPick = async (file: File) => {
    if (!modal) return;
    if (file.size > MAX_ASSET_MB * 1024 * 1024) return toast.error(`Max ${MAX_ASSET_MB}MB`);
    setUploadingAsset(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id ?? "admin";
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage
        .from("product-files")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      setModal((m) => (m ? { ...m, file_path: path, file_name: file.name } : m));
      toast.success("Product file uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingAsset(false);
    }
  };

  const save = async () => {
    if (!modal) return;
    if (!modal.name.trim()) return toast.error("Name is required");
    const price = Number(modal.price_usd);
    if (!(price > 0)) return toast.error("Price must be > 0");
    setSaving(true);
    try {
      if (modal.id) {
        await updateFn({
          data: {
            id: modal.id,
            name: modal.name,
            category: modal.category,
            description: modal.description,
            price_usd: price,
            vendor: modal.vendor,
            subcategory: modal.subcategory || null,
            external_url: modal.external_url || null,
            cover_path: modal.cover_path,
            file_path: modal.file_path,
            promoted: modal.promoted,
            brand: modal.kind === "physical" ? modal.brand || null : undefined,
            condition: modal.kind === "physical" ? modal.condition || null : undefined,
            location: modal.kind === "physical" ? modal.location || null : undefined,
            negotiable: modal.kind === "physical" ? modal.negotiable || null : undefined,
            delivery: modal.kind === "physical" ? modal.delivery || null : undefined,
            seller_phone: modal.kind === "physical" ? modal.seller_phone || null : undefined,
            whatsapp_number: modal.kind === "physical" ? modal.whatsapp_number || null : undefined,
            social_link: modal.kind === "physical" ? modal.social_link || null : undefined,
          },
        });
        toast.success("Product updated");
      } else {
        await createFn({
          data: {
            name: modal.name,
            category: modal.category,
            description: modal.description,
            price_usd: price,
            vendor: modal.vendor,
            external_url: modal.external_url || null,
            cover_path: modal.cover_path,
            file_path: modal.file_path,
            promoted: modal.promoted,
          },
        });
        toast.success("Product created");
      }
      setModal(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const byKind = (rows ?? []).filter((p) =>
    kindFilter === "all" ? true : ((p.kind as string) ?? "digital") === kindFilter,
  );
  const kindCount = (k: "all" | "digital" | "physical") =>
    k === "all"
      ? (rows?.length ?? 0)
      : (rows ?? []).filter((r) => ((r.kind as string) ?? "digital") === k).length;
  const statusCountInKind = (s: "all" | "pending" | "active" | "rejected") =>
    s === "all" ? byKind.length : byKind.filter((r) => (r.status as string) === s).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-black">Products</h1>
          <p className="text-sm text-slate-400">
            {filtered.length} of {rows?.length ?? 0} listings
            {lastRefreshAt && (
              <span className="text-slate-600">
                {" "}
                · updated {new Date(lastRefreshAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex rounded-[10px] bg-[#141418] border border-white/10 p-0.5"
            role="group"
            aria-label="Price currency"
          >
            {PRICE_CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setPriceCurrency(c)}
                className={`px-2.5 py-1 rounded-[10px] text-xs font-bold transition ${
                  priceCurrency === c
                    ? "bg-emerald-500 text-black"
                    : "text-slate-300 hover:text-white"
                }`}
                aria-pressed={priceCurrency === c}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="text-xs text-slate-400 inline-flex items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-emerald-500"
            />
            Auto
          </label>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold rounded-[10px] flex items-center gap-2 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-[10px] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New product
          </button>
        </div>
      </header>

      {/* Primary: product type */}
      <div className="mb-3 inline-flex rounded-xl bg-[#141418] border border-white/10 p-1">
        {(["all", "digital", "physical"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            className={`px-4 py-2 rounded-[10px] text-sm font-semibold transition ${
              kindFilter === k ? "bg-emerald-500 text-black" : "text-slate-300 hover:text-white"
            }`}
          >
            {k === "all" ? "All" : k === "digital" ? "Digital Products" : "Physical Products"}
            <span
              className={`ml-2 text-[11px] font-bold ${kindFilter === k ? "text-black/70" : "text-slate-500"}`}
            >
              {kindCount(k)}
            </span>
          </button>
        ))}
      </div>

      {/* Secondary: status within selected type */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["pending", "active", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              statusFilter === s
                ? s === "pending"
                  ? "bg-amber-500/15 border-amber-500/50 text-amber-200"
                  : s === "active"
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                    : s === "rejected"
                      ? "bg-red-500/15 border-red-500/50 text-red-300"
                      : "bg-white/10 border-white/20 text-white"
                : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white"
            }`}
          >
            {s === "pending" ? "Pending Approval" : s.charAt(0).toUpperCase() + s.slice(1)} (
            {statusCountInKind(s)})
          </button>
        ))}
      </div>

      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No products in this view.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const id = p.id as string;
            const status = (p.status as string) ?? "active";
            const kind = (p.kind as string) ?? "digital";
            return (
              <div
                key={id}
                data-admin-product-row
                className="bg-[#141418] border border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-3"
              >
                <div className="flex-1 min-w-[220px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white font-bold truncate">{p.name as string}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${
                        status === "active"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : status === "pending"
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                            : "bg-red-500/15 border-red-500/40 text-red-300"
                      }`}
                    >
                      {status}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${kind === "physical" ? "bg-sky-500/15 border-sky-500/40 text-sky-300" : "bg-white/5 border-white/10 text-slate-400"}`}
                    >
                      {kind}
                    </span>
                    {(p.promoted as boolean) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 uppercase font-bold">
                        Promoted
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.category as string} ·{" "}
                    {
                      computeDisplayPrice(
                        {
                          price_usd: Number(p.price_usd) || 0,
                          original_currency: (p.original_currency as string) ?? "USD",
                          original_amount: Number(p.original_amount ?? p.price_usd) || 0,
                          fx_snapshot: p.fx_snapshot,
                        },
                        priceCurrency,
                      ).formatted
                    }{" "}
                    · by {(p.vendor as string) ?? "—"}
                    {p.location ? ` · ${p.location as string}` : ""}
                  </div>
                  {status === "rejected" && Boolean(p.reject_reason) && (
                    <div className="text-[11px] text-red-300 mt-1 truncate">
                      Reason: {p.reject_reason as string}
                    </div>
                  )}
                </div>
                <div className="w-full sm:w-auto flex flex-wrap items-center justify-start sm:justify-end gap-2">
                  <button
                    onClick={() => setPreviewId(id)}
                    className="px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                    aria-label={`View ${kind} product`}
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  {status !== "active" && (
                    <button
                      onClick={async () => {
                        setBusy(id);
                        try {
                          await approveFn({ data: { id } });
                          toast.success("Approved");
                          refresh();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                        setBusy(null);
                      }}
                      disabled={busy === id}
                      className="px-3 py-2 rounded-[10px] bg-emerald-500 text-black text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  {status !== "rejected" && (
                    <button
                      onClick={() => {
                        setRejectingId(id);
                        setRejectReason("");
                        setRejectHint("");
                      }}
                      disabled={busy === id}
                      className="px-3 py-2 rounded-[10px] bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      setBusy(id);
                      try {
                        await promFn({ data: { id, promoted: !(p.promoted as boolean) } });
                        refresh();
                        toast.success((p.promoted as boolean) ? "Promotion removed" : "Promoted");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                      setBusy(null);
                    }}
                    disabled={busy === id}
                    className="px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    aria-label={`Toggle ${kind} product promotion`}
                  >
                    <Star className={`w-3.5 h-3.5 ${p.promoted ? "fill-amber-300" : ""}`} /> Promote
                  </button>
                  <button
                    onClick={async () => {
                      const next = p.in_stock === false;
                      setBusy(id);
                      try {
                        await stockFn({ data: { id, inStock: next } });
                        refresh();
                        toast.success(next ? "Marked in stock" : "Marked out of stock");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                      setBusy(null);
                    }}
                    disabled={busy === id}
                    className={`px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 ${p.in_stock === false ? "text-[#E5484D]" : "text-emerald-300"}`}
                    aria-label={`Toggle ${kind} product stock`}
                  >
                    {p.in_stock === false ? (
                      <><PackageX className="w-3.5 h-3.5" /> Out of stock</>
                    ) : (
                      <><PackageCheck className="w-3.5 h-3.5" /> In stock</>
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                    aria-label={`Edit ${kind} product`}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
                      setBusy(id);
                      try {
                        await delFn({ data: { id } });
                        refresh();
                        toast.success("Deleted");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                      setBusy(null);
                    }}
                    disabled={busy === id}
                    className="px-3 py-2 rounded-[10px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    aria-label={`Delete ${kind} product`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejectingId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-[#141418] border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-bold text-lg mb-3">Reject product</h3>
            <label className="block mb-3">
              <span className="text-xs text-slate-300">Reason (sent to seller)</span>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1 w-full bg-[#0F0F12] border border-white/10 rounded-[10px] p-2 text-sm text-white"
              />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-slate-300">Recommendation (optional)</span>
              <textarea
                rows={2}
                value={rejectHint}
                onChange={(e) => setRejectHint(e.target.value)}
                className="mt-1 w-full bg-[#0F0F12] border border-white/10 rounded-[10px] p-2 text-sm text-white"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 rounded-[10px] border border-white/10 text-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!rejectReason.trim()) return toast.error("Reason is required");
                  const id = rejectingId;
                  setBusy(id);
                  try {
                    await rejectFn({
                      data: {
                        id,
                        reason: rejectReason.trim(),
                        recommendation: rejectHint.trim() || undefined,
                      },
                    });
                    toast.success("Rejected — seller notified");
                    setRejectingId(null);
                    refresh();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                  setBusy(null);
                }}
                className="px-4 py-2 rounded-[10px] bg-red-500 text-white text-sm font-bold"
              >
                Send rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {previewId &&
        (() => {
          const p = (rows ?? []).find((r) => r.id === previewId);
          if (!p) return null;
          return <ProductPreviewModal product={p} onClose={() => setPreviewId(null)} />;
        })()}

      {showSellSwitcher && (
        <SellSwitcherModal
          open
          onClose={() => {
            setShowSellSwitcher(false);
            refresh();
          }}
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-lg bg-[#141418] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-black text-lg">
                {modal.id ? `Edit ${modal.kind} product` : "New product"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 rounded-[10px] hover:bg-white/10 text-slate-400"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                  Product image
                </span>
                <p className="text-[11px] text-slate-500 -mt-0.5 mb-2">
                  Shown as the cover on marketplace cards. PNG/JPG/WebP, up to 5MB.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverPick(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-dashed border-white/15 hover:border-emerald-500/50 bg-black/20 hover:bg-black/30 disabled:opacity-50 text-left"
                >
                  {modal.cover_preview ? (
                    <ResponsiveImage
                      sizes="80px"
                      src={modal.cover_preview}
                      alt="Cover preview"
                      className="w-20 h-20 object-cover rounded-[10px] border border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-[10px] border border-white/10 bg-white/5 flex items-center justify-center text-slate-500">
                      <ImagePlus className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    {uploadingCover ? (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                      </div>
                    ) : modal.cover_preview ? (
                      <>
                        <div className="text-slate-200 font-medium">Image attached</div>
                        <div className="text-slate-500 mt-0.5">Click to replace</div>
                      </>
                    ) : (
                      <div className="text-slate-400">
                        Click to upload a cover image (recommended 4:3).
                      </div>
                    )}
                  </div>
                  {modal.cover_preview && !uploadingCover && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal((m) => (m ? { ...m, cover_path: null, cover_preview: null } : m));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          setModal((m) =>
                            m ? { ...m, cover_path: null, cover_preview: null } : m,
                          );
                        }
                      }}
                      className="p-1.5 rounded-[10px] bg-white/5 hover:bg-red-500/20 border border-white/10 text-red-300"
                      aria-label="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              </div>

              <Field label="Name">
                <input
                  value={modal.name}
                  onChange={(e) => setModal({ ...modal, name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  {modal.kind === "digital" ? (
                    <select
                      value={modal.category}
                      onChange={(e) => setModal({ ...modal, category: e.target.value })}
                      className={inputCls}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={modal.category}
                      onChange={(e) => setModal({ ...modal, category: e.target.value })}
                      className={inputCls}
                    />
                  )}
                </Field>
                <Field label="Price (USD)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modal.price_usd}
                    onChange={(e) => setModal({ ...modal, price_usd: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Vendor">
                <input
                  value={modal.vendor}
                  onChange={(e) => setModal({ ...modal, vendor: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={modal.description}
                  onChange={(e) => setModal({ ...modal, description: e.target.value })}
                  rows={4}
                  className={inputCls}
                />
              </Field>
              <>

                  <Field label="External download URL (optional)">
                    <input
                      value={modal.external_url}
                      onChange={(e) => setModal({ ...modal, external_url: e.target.value })}
                      placeholder="https://…"
                      className={inputCls}
                    />
                  </Field>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                      Product file (.zip)
                    </span>
                    <p className="text-[11px] text-slate-500 -mt-0.5 mb-2">
                      Digital asset buyers download. ZIP/RAR/7Z or any file, up to {MAX_ASSET_MB}MB.
                      Optional if you set an external URL above.
                    </p>
                    <input
                      ref={assetInputRef}
                      type="file"
                      accept=".zip,.rar,.7z,.tar,.gz,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAssetPick(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => assetInputRef.current?.click()}
                      disabled={uploadingAsset}
                      className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-dashed border-white/15 hover:border-emerald-500/50 bg-black/20 hover:bg-black/30 disabled:opacity-50 text-left"
                    >
                      <div className="w-12 h-12 rounded-[10px] border border-white/10 bg-white/5 flex items-center justify-center text-emerald-400">
                        <FileArchive className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0 text-xs">
                        {uploadingAsset ? (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                          </div>
                        ) : modal.file_name ? (
                          <>
                            <div className="text-slate-200 font-medium truncate">
                              {modal.file_name}
                            </div>
                            <div className="text-slate-500 mt-0.5">Click to replace</div>
                          </>
                        ) : (
                          <div className="text-slate-400">
                            Click to upload the product ZIP file (max {MAX_ASSET_MB}MB).
                          </div>
                        )}
                      </div>
                      {modal.file_name && !uploadingAsset && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setModal((m) => (m ? { ...m, file_path: null, file_name: null } : m));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              setModal((m) => (m ? { ...m, file_path: null, file_name: null } : m));
                            }
                          }}
                          className="p-1.5 rounded-[10px] bg-white/5 hover:bg-red-500/20 border border-white/10 text-red-300"
                          aria-label="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  </div>
              </>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={modal.promoted}
                  onChange={(e) => setModal({ ...modal, promoted: e.target.checked })}
                  className="accent-emerald-500"
                />
                Promoted
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  disabled={saving}
                  onClick={save}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-[10px] flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {modal.id ? "Save changes" : "Create product"}
                </button>
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold rounded-[10px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full bg-black/30 border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function ProductPreviewModal({ product, onClose }: { product: Row; onClose: () => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cover = (product.cover_path as string) ?? null;
    const imgs = Array.isArray(product.image_paths) ? (product.image_paths as string[]) : [];
    const paths = Array.from(new Set([cover, ...imgs].filter(Boolean))) as string[];
    if (paths.length === 0) {
      setLoading(false);
      return;
    }
    (async () => {
      const signed: string[] = [];
      for (const path of paths) {
        const { data } = await supabase.storage
          .from("product-covers")
          .createSignedUrl(path, 60 * 60);
        if (data?.signedUrl) signed.push(data.signedUrl);
      }
      if (!cancelled) {
        setUrls(signed);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product]);

  const kind = String(product.kind ?? "digital");
  const status = String(product.status ?? "active");
  const cur = urls[active];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-[#141418] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${kind === "physical" ? "bg-sky-500/15 border-sky-500/40 text-sky-300" : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"}`}
              >
                {kind}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${
                  status === "active"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : status === "pending"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                      : "bg-red-500/15 border-red-500/40 text-red-300"
                }`}
              >
                {status}
              </span>
              {Boolean(product.promoted) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold bg-amber-500/15 border border-amber-500/40 text-amber-200">
                  Promoted
                </span>
              )}
            </div>
            <h3 className="text-white font-bold text-lg truncate">{product.name as string}</h3>
            <div className="text-xs text-slate-400 mt-0.5">
              {String(product.category ?? "")}
              {product.subcategory ? ` · ${product.subcategory as string}` : ""} · by{" "}
              {(product.vendor as string) ?? "—"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[10px] hover:bg-white/10 text-slate-400 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4">
          <div className="relative aspect-[4/3] rounded-xl bg-[#0F0F12] border border-white/10 overflow-hidden flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            ) : cur ? (
              <ResponsiveImage
                src={cur}
                alt={product.name as string}
                sizes="(min-width:768px) 640px, 100vw"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="text-xs text-slate-500">No images</div>
            )}
          </div>
          {urls.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {urls.map((u, i) => (
                <button
                  key={u}
                  onClick={() => setActive(i)}
                  className={`shrink-0 w-16 h-16 rounded-[10px] overflow-hidden border-2 ${i === active ? "border-emerald-500" : "border-white/10"}`}
                >
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {!loading && urls.length > 0 && (
            <div className="mt-1 text-[10px] text-slate-500">
              {urls.length} image{urls.length === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="bg-black/30 border border-white/10 rounded-[10px] p-3">
            <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Price</div>
            <div className="text-white font-bold text-lg">
              ${Number(product.price_usd).toFixed(2)}
            </div>
            {product.original_amount && product.original_currency ? (
              <div className="text-slate-500 text-[11px] mt-0.5">
                Seller published {String(product.original_currency)}{" "}
                {String(product.original_amount)}
              </div>
            ) : null}
            <div className="text-slate-400 text-[11px] mt-1">
              Live equivalent ·{" "}
              {(["NGN", "GHS"] as const)
                .map((c) => formatMoney(Number(product.price_usd) * usdRate(c), c))
                .join(" · ")}
            </div>
          </div>
          {product.location ? (
            <div className="bg-black/30 border border-white/10 rounded-[10px] p-3">
              <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                Location
              </div>
              <div className="text-slate-200 inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {product.location as string}
              </div>
            </div>
          ) : null}
        </div>

        {Boolean(product.description) && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Description
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">
              {product.description as string}
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {product.brand ? (
            <>
              <dt className="text-slate-500">Brand</dt>
              <dd className="text-slate-200">{product.brand as string}</dd>
            </>
          ) : null}
          {product.condition ? (
            <>
              <dt className="text-slate-500">Condition</dt>
              <dd className="text-slate-200">{product.condition as string}</dd>
            </>
          ) : null}
          {product.negotiable ? (
            <>
              <dt className="text-slate-500">Negotiable</dt>
              <dd className="text-slate-200">{product.negotiable as string}</dd>
            </>
          ) : null}
          {product.delivery ? (
            <>
              <dt className="text-slate-500">Delivery</dt>
              <dd className="text-slate-200">{product.delivery as string}</dd>
            </>
          ) : null}
          {product.seller_phone ? (
            <>
              <dt className="text-slate-500">Phone</dt>
              <dd className="text-slate-200">+{product.seller_phone as string}</dd>
            </>
          ) : null}
          {product.whatsapp_number ? (
            <>
              <dt className="text-slate-500">WhatsApp</dt>
              <dd className="text-slate-200">+{product.whatsapp_number as string}</dd>
            </>
          ) : null}
        </dl>

        {status === "rejected" && Boolean(product.reject_reason) && (
          <div className="mt-4 rounded-[10px] border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 whitespace-pre-wrap">
            <div className="font-bold text-red-300 mb-1">Rejection reason</div>
            {product.reject_reason as string}
          </div>
        )}
      </div>
    </div>
  );
}
