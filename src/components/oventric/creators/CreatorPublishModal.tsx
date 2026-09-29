import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileUp, ImagePlus, Link2, Sparkles, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { publishCreatorPost } from "@/lib/creators.functions";
import { isCommunityLink } from "@/lib/video-embed";
import {
  createProduct,
  listMarketplaceCategories,
  type CategoryNode,
  type ProductCategory,
} from "@/lib/marketplace.functions";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { Button } from "@/components/ui/button";

interface Attachment {
  file: File;
  url: string;
  kind: "image" | "video";
}

const MAX_ASSET_MB = 50;
/** Uploaded showcase clips stay short and light — 1 min 30s / 50MB max. */
const MAX_CLIP_SECONDS = 90;
const MAX_CLIP_LABEL = "1 min 30s";
const MAX_CLIP_MB = 50;
const MAX_CLIP_BYTES = MAX_CLIP_MB * 1024 * 1024;

/** Creator showcase publisher: title, caption, media, sellable asset, links. */
export function CreatorPublishModal({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const publish = useServerFn(publishCreatorPost);
  const persistProduct = useServerFn(createProduct);
  const snapshotFx = useServerFn(snapshotFxRates);
  const loadCats = useServerFn(listMarketplaceCategories);
  const { homeCurrency } = useOnboarding();

  const fileRef = useRef<HTMLInputElement>(null);
  const assetRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [community, setCommunity] = useState("");
  const [busy, setBusy] = useState(false);
  const [compressing, setCompressing] = useState(false);
  /** Set when a long/heavy video was auto-cut to the allowed first part. */
  const [trimmedFrom, setTrimmedFrom] = useState<number | null>(null);
  const [fullVideoUrl, setFullVideoUrl] = useState("");

  // Sellable asset
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetLink, setAssetLink] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [priceInput, setPriceInput] = useState("");
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [category, setCategory] = useState<ProductCategory | "">("");

  useEffect(() => {
    if (!open) return;
    loadCats()
      .then((rows) => {
        const digital = (rows ?? []).filter((r) => r.kind === "digital");
        setCategories(digital);
        setCategory((prev) => (prev && digital.some((d) => d.slug === prev) ? prev : (digital[0]?.slug ?? "")));
      })
      .catch(() => {});
  }, [open, loadCats]);

  // Survive a failed publish: a retry reuses what was already saved instead
  // of creating another copy of the product or re-uploading media.
  const savedRef = useRef<{ productId?: string; mediaPaths?: string[]; mediaType?: "image" | "video"; coverPath?: string | null }>({});
  const submittingRef = useRef(false);

  useEffect(() => {
    if (open) return;
    savedRef.current = {};
    setTitle("");
    setCaption("");
    setAttachments([]);
    setCommunity("");
    setTrimmedFrom(null);
    setFullVideoUrl("");
    setAssetFile(null);
    setAssetLink("");
    setIsFree(true);
    setPriceInput("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const pick = async (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).slice(0, 10);
    const next: Attachment[] = [];
    for (const raw of picked) {
      const kind: "image" | "video" = raw.type.startsWith("video/") ? "video" : "image";
      let file = raw;
      if (kind === "video") {
        // Short clips only — long videos belong on YouTube/Vimeo and stream
        // from there, so hosting never fills up with heavy uploads.
        setCompressing(true);
        try {
          const { getVideoDuration, trimVideoSegment } = await import("@/lib/media/videoTrim");
          const duration = await getVideoDuration(file);
          const tooLong = duration > MAX_CLIP_SECONDS + 0.5;
          if (tooLong || file.size > MAX_CLIP_BYTES) {
            // Keep only the allowed opening part; the rest is discarded.
            const compact = await trimVideoSegment(
              file,
              0,
              Math.max(1, Math.min(MAX_CLIP_SECONDS, duration || MAX_CLIP_SECONDS)),
            );
            if (compact && (tooLong || compact.size < file.size)) file = compact;
            else if (tooLong) {
              toast.error("Couldn't shorten this video on your device. Trim it to " + MAX_CLIP_LABEL + " and try again.");
              continue;
            }
          }
          if (file.size > MAX_CLIP_BYTES) {
            toast.error(
              `That clip is still over ${MAX_CLIP_MB}MB. Compress it below ${MAX_CLIP_MB}MB and upload again.`,
            );
            continue;
          }
          if (tooLong) {
            setTrimmedFrom(duration || MAX_CLIP_SECONDS);
            toast.message(`Only the first ${MAX_CLIP_LABEL} of your video will be uploaded`, {
              description: "Add a link to the full video below so viewers can get all of it.",
            });
          } else {
            setTrimmedFrom(null);
          }
        } finally {
          setCompressing(false);
        }
      }
      next.push({ file, url: URL.createObjectURL(file), kind });
    }
    if (!next.length) return;
    // A video showcase is a single clip; images can be a set.
    setAttachments(next[0]?.kind === "video" ? next.slice(0, 1) : next);
  };

  const submit = async () => {
    if (title.trim().length < 2) {
      toast.error("Add a title");
      return;
    }
    if (fullVideoUrl.trim() && !/^https?:\/\//i.test(fullVideoUrl.trim())) {
      toast.error("Full video link must start with https://");
      return;
    }
    if (community.trim() && !isCommunityLink(community)) {
      toast.error("Community link must be a Telegram or WhatsApp link");
      return;
    }

    const hasAsset = Boolean(assetFile) || assetLink.trim().length > 0;
    const priceLocal = Number(priceInput);
    if (hasAsset) {
      if (assetLink.trim() && !/^https?:\/\//i.test(assetLink.trim())) {
        toast.error("Download link must start with https://");
        return;
      }
      if (!category) {
        toast.error("Pick a category for your asset");
        return;
      }
      if (!isFree && !(priceLocal > 0)) {
        toast.error("Enter a price or switch to Free");
        return;
      }
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");

      let mediaPaths: string[] | undefined;
      let mediaType: "image" | "video" | undefined;
      let coverImage: File | null = null;
      if (savedRef.current.mediaPaths) {
        mediaPaths = savedRef.current.mediaPaths;
        mediaType = savedRef.current.mediaType;
        coverImage = attachments.find((a) => a.kind === "image")?.file ?? null;
      } else if (attachments.length > 0) {
        const uploaded: string[] = [];
        for (const a of attachments) {
          const ext = (a.file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
          const path = `${uid}/creator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error } = await supabase.storage.from("post-media").upload(path, a.file, {
            contentType: a.file.type,
            cacheControl: "31536000",
            upsert: false,
          });
          if (error) throw error;
          uploaded.push(path);
          if (a.kind === "image" && !coverImage) coverImage = a.file;
          if (a.kind === "video") {
            try {
              const { generateVideoPoster, posterPathFor } = await import("@/lib/media/videoPoster");
              const poster = await generateVideoPoster(a.file);
              if (poster) {
                await supabase.storage.from("post-media").upload(posterPathFor(path), poster, {
                  contentType: "image/jpeg",
                  cacheControl: "31536000",
                  upsert: true,
                });
              }
            } catch {
              /* poster is best-effort */
            }
          }
        }
        mediaPaths = uploaded;
        mediaType = attachments[0].kind;
        savedRef.current.mediaPaths = mediaPaths;
        savedRef.current.mediaType = mediaType;
      }

      // The sellable asset becomes a normal marketplace listing: same review,
      // same 80/20 split, same wallet + dashboard reporting, instant download.
      let productId: string | undefined = savedRef.current.productId;
      if (hasAsset && !productId) {
        let filePath: string | null = null;
        if (assetFile) {
          const safe = assetFile.name.replace(/[^\w.\-]+/g, "_");
          const path = `${uid}/${Date.now()}-${safe}`;
          const { error } = await supabase.storage
            .from("product-files")
            .upload(path, assetFile, { contentType: assetFile.type || undefined, upsert: false });
          if (error) throw new Error(error.message);
          filePath = path;
        }

        let coverPath: string | null = null;
        if (coverImage) {
          const safe = coverImage.name.replace(/[^\w.\-]+/g, "_");
          const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
          const { error } = await supabase.storage
            .from("product-covers")
            .upload(path, coverImage, { contentType: coverImage.type, upsert: false });
          if (!error) coverPath = path;
        }

        const snapshot = await snapshotFx();
        const rate = Number(snapshot.rates[homeCurrency] ?? 1);
        const priceUSD = isFree
          ? 0
          : homeCurrency === "USD"
            ? priceLocal
            : Number((priceLocal / rate).toFixed(2));

        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("user_id", uid)
          .maybeSingle();
        const vendorName =
          (prof?.display_name && String(prof.display_name).trim()) ||
          (prof?.username && String(prof.username).trim()) ||
          "Creator";

        const created = await persistProduct({
          data: {
            name: title.trim(),
            category: category as ProductCategory,
            description: caption.trim() || title.trim(),
            priceUSD,
            originalCurrency: homeCurrency,
            originalAmount: isFree ? 0 : priceLocal,
            fxSnapshot: snapshot,
            vendor: vendorName,
            externalUrl: assetFile ? null : assetLink.trim(),
            filePath,
            coverPath,
            imagePaths: coverPath ? [coverPath] : [],
            // Premade assets only — always instant download, never manual.
            requiresManualDelivery: false,
            inStock: true,
            // Creator asset: downloadable from the Creators tab, never listed
            // as a marketplace product.
            creatorAsset: true,
          },
        });
        productId = created.id;
        savedRef.current.productId = productId;
      }

      await publish({
        data: {
          title: title.trim(),
          caption: caption.trim() || undefined,
          mediaPaths,
          mediaType,
          communityLink: community.trim() || undefined,
          fullVideoUrl:
            trimmedFrom !== null && mediaType === "video" && fullVideoUrl.trim()
              ? fullVideoUrl.trim()
              : undefined,
          productId,
        },
      });
      toast.success(hasAsset ? "Published — your asset is on its way to the shop" : "Published to Creators");
      onPublished();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't publish. Try again.");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 p-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="flex max-h-[calc(100dvh-28px)] w-full max-w-lg flex-col overflow-hidden rounded-[18px] border border-white/80 bg-white shadow-2xl sm:max-h-[92vh]">
        <div className="grid h-1.5 shrink-0 grid-cols-5" aria-hidden="true">
          <span className="bg-emerald-500" />
          <span className="bg-sky-500" />
          <span className="bg-violet-500" />
          <span className="bg-amber-400" />
          <span className="bg-rose-500" />
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-violet-50 text-violet-600">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900">Showcase your work</p>
              <p className="truncate text-[11px] font-semibold text-slate-500">Share the craft behind your creator profile</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-9 w-9 shrink-0 rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/40 px-4 py-4 [scroll-behavior:smooth]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-[10px] border border-slate-200 px-3 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
          />
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption — tell people about this piece"
            rows={3}
            className="w-full resize-none rounded-[10px] border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400"
          />

          <div className="rounded-[10px] border border-dashed border-sky-200 bg-sky-50/60 p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => void pick(e.target.files)}
            />
            {attachments.length === 0 ? (
              <button
                type="button"
                disabled={compressing}
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-1.5 rounded-[10px] py-5 text-slate-600 transition-colors hover:bg-white/70 disabled:opacity-60"
              >
                <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-sky-100 text-sky-600">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <span className="text-xs font-bold">
                  {compressing ? "Preparing your clip…" : "Add images or a video"}
                </span>
                <span className="px-4 text-center text-[11px] font-semibold text-slate-400">
                  Videos up to {MAX_CLIP_LABEL} and {MAX_CLIP_MB}MB — longer videos are cut to the
                  first {MAX_CLIP_LABEL} automatically.
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative h-20 overflow-hidden rounded-[10px] bg-slate-100">
                    {a.kind === "video" ? (
                      <video src={a.url} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      <img loading="lazy" decoding="async" src={a.url} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => {
                        setAttachments((prev) => prev.filter((_, idx) => idx !== i));
                        if (a.kind === "video") setTrimmedFrom(null);
                      }}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid h-20 place-items-center rounded-[10px] border border-slate-200 text-slate-400"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {trimmedFrom !== null && attachments[0]?.kind === "video" && (
            <div className="space-y-2 rounded-[10px] border border-violet-100 bg-violet-50/60 p-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-violet-600" />
                <p className="text-xs font-black text-slate-900">Paste link to full video (optional)</p>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Your video is longer than {MAX_CLIP_LABEL}, so only the first {MAX_CLIP_LABEL} will be
                uploaded and played. Add a link to the full video — a direct file link (ends in .mp4,
                Dropbox/Drive download link) gives viewers a "Download full video" button; any other
                link (YouTube, Drive page…) shows a "Watch full video" button instead.
              </p>
              <input
                value={fullVideoUrl}
                onChange={(e) => setFullVideoUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
                className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400"
              />
            </div>
          )}

          {/* Sellable asset */}
          <div className="space-y-3 rounded-[10px] border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-black text-slate-900">Sell this asset (optional)</p>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Premade files only — buyers download instantly, no manual delivery.
            </p>

            <input
              ref={assetRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > MAX_ASSET_MB * 1024 * 1024) {
                  toast.error(`File too large — max ${MAX_ASSET_MB}MB`);
                  return;
                }
                setAssetFile(f);
                if (f) setAssetLink("");
              }}
            />
            <button
              type="button"
              onClick={() => assetRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-600"
            >
              <FileUp className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="truncate">{assetFile ? assetFile.name : "Upload the downloadable file"}</span>
            </button>
            {assetFile && (
              <button
                type="button"
                onClick={() => setAssetFile(null)}
                className="text-[11px] font-bold text-[#E5484D]"
              >
                Remove file
              </button>
            )}

            <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2.5">
              <Link2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <input
                value={assetLink}
                onChange={(e) => {
                  setAssetLink(e.target.value);
                  if (e.target.value) setAssetFile(null);
                }}
                placeholder="…or paste a download link (Drive, Dropbox, etc.)"
                className="w-full text-sm outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className={`rounded-[10px] border px-3 py-2 text-xs font-black transition-colors ${
                  isFree ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setIsFree(false)}
                className={`rounded-[10px] border px-3 py-2 text-xs font-black transition-colors ${
                  !isFree ? "border-[#E5484D] bg-[#E5484D] text-white" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                Paid
              </button>
            </div>

            {!isFree && (
              <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-xs font-black text-slate-500">{homeCurrency}</span>
                <input
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder="Price"
                  className="w-full text-sm font-bold outline-none"
                />
              </div>
            )}

            {categories.length > 0 && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
              <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              Paid assets follow the normal marketplace rules — 80/20 split, earnings in your wallet and dashboard.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-[10px] border border-violet-100 bg-violet-50/55 px-3 py-2.5 focus-within:border-violet-300">
            <Link2 className="h-4 w-4 shrink-0 text-violet-600" />
            <input
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              placeholder="Telegram / WhatsApp channel link (optional)"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <Button
            disabled={busy}
            onClick={submit}
            className="h-12 w-full rounded-[10px] bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-200/70 hover:bg-violet-700"
          >
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
