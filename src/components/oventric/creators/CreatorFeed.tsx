import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Download, MessageCircle, Play, Send, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listCreatorFeed, type CreatorPostDTO } from "@/lib/creators.functions";
import { computeDisplayPrice } from "@/lib/fx-display";
import { createOrder, getOrderWithDownload } from "@/lib/marketplace.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";


const TINTS = [
  "border-sky-100 bg-sky-50/70 text-sky-700",
  "border-violet-100 bg-violet-50/70 text-violet-700",
  "border-emerald-100 bg-emerald-50/70 text-emerald-700",
  "border-amber-100 bg-amber-50/70 text-amber-700",
  "border-rose-100 bg-rose-50/70 text-rose-700",
  "border-teal-100 bg-teal-50/70 text-teal-700",
];

/** Muted 10s looping preview that starts when scrolled into view; click plays it fully. */
function PreviewVideo({ src, poster }: { src: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || full) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.muted = true;
          void el.play().catch(() => {});
          // Loop a 10-second preview window.
          timer = setInterval(() => {
            if (el.currentTime > 10) el.currentTime = 0;
          }, 500);
        } else {
          el.pause();
          if (timer) clearInterval(timer);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [full]);

  return (
    <div className="relative">
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted={!full}
        loop={!full}
        playsInline
        controls={full}
        className="max-h-[70vh] w-full bg-black object-contain"
        onClick={() => {
          if (full) return;
          setFull(true);
          const el = ref.current;
          if (el) {
            el.muted = false;
            el.currentTime = 0;
            void el.play().catch(() => {});
          }
        }}
      />
      {!full && (
        <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
          <Play className="h-3 w-3" /> Tap to play
        </span>
      )}
    </div>
  );
}

/** Buy / download call-to-action for a showcase item that has a listed asset. */
function AssetCta({ asset }: { asset: NonNullable<CreatorPostDTO["asset"]> }) {
  const { baseCurrency } = useOnboarding();
  const createFreeOrder = useServerFn(createOrder);
  const loadDownload = useServerFn(getOrderWithDownload);
  const [downloading, setDownloading] = useState(false);
  if (!asset.available) {
    return (
      <div className="mb-3 inline-flex rounded-full border border-border bg-muted px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
        Asset pending review
      </div>
    );
  }
  const price = computeDisplayPrice(
        {
          price_usd: asset.priceUsd,
          original_currency: asset.originalCurrency,
          original_amount: asset.originalAmount,
          fx_snapshot: asset.fxSnapshot,
        },
        baseCurrency,
      ).formatted;

  const downloadAsset = async () => {
    if (downloading) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      toast.error("Sign in to download this asset");
      return;
    }
    setDownloading(true);
    try {
      const result = await createFreeOrder({
        data: {
          productId: asset.productId,
          quantity: 1,
          displayCurrency: baseCurrency,
          paymentMethod: "wallet",
          couponCode: null,
          deliveryEmail: null,
          deliveryWhatsapp: null,
          applyCashbackUSD: 0,
        },
      });
      const downloadable = await loadDownload({ data: { orderId: result.order.id } });
      const href = downloadable.downloadUrl ?? downloadable.order.externalUrl;
      if (!href) throw new Error("This download is not available yet");

      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "";
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success("Download started", {
        description: "This asset is saved in your dashboard for later.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the download");
    } finally {
      setDownloading(false);
    }
  };

  return asset.isFree ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={downloading}
      onClick={downloadAsset}
      className="mb-3 h-8 rounded-full border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 shadow-none hover:bg-emerald-100 hover:text-emerald-800"
    >
      <Download className="h-3.5 w-3.5" />
      {downloading ? "Starting…" : "Download this asset"}
    </Button>
  ) : (
    <Link
      to="/product/$id"
      params={{ id: asset.productId }}
      className="mb-3 inline-flex h-8 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-700 transition-colors hover:bg-rose-100"
    >
      <ShoppingBag className="h-3.5 w-3.5" />
      <span>Buy</span>
      <span className="border-l border-rose-200 pl-2 text-[10px]">{price}</span>
    </Link>
  );
}

function CreatorCard({ post, index }: { post: CreatorPostDTO; index: number }) {

  const tint = TINTS[index % TINTS.length];
  return (
    <article className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-border bg-background px-4 py-3 transition-colors hover:bg-muted/30">
      <div>
        <Link
          to="/profile/$id"
          params={{ id: post.author.slug ?? post.author.userId }}
          className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted"
        >
          {post.author.avatarUrl && (
            <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" />
          )}
        </Link>
      </div>
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="flex min-w-0 items-baseline gap-1.5">
          <Link
            to="/profile/$id"
            params={{ id: post.author.slug ?? post.author.userId }}
              className="truncate text-sm font-black text-foreground"
          >
            {post.author.name}
          </Link>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              · {new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
                -Math.max(1, Math.round((Date.now() - new Date(post.createdAt).getTime()) / 86400000)),
                "day",
              )}
            </span>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${tint}`}>
            CREATOR
          </span>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{post.fields.join(" · ") || "Creator"}</p>
        <p className="mt-2 text-[15px] font-black leading-snug text-foreground">{post.title}</p>
        {post.caption && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{post.caption}</p>}

        {post.media.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-[10px] border border-border">
            {post.media[0].type === "video" ? (
              <PreviewVideo src={post.media[0].url} poster={post.media[0].posterUrl} />
            ) : (
              <div className={`grid gap-0.5 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {post.media.slice(0, 4).map((m) => (
                  <img key={m.url} src={m.url} alt="" loading="lazy" className="h-full max-h-[60vh] w-full object-cover" />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-3">{post.asset && <AssetCta asset={post.asset} />}</div>

        {post.externalEmbedUrl && (
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-[10px] border border-border bg-foreground">
          <iframe
            src={post.externalEmbedUrl}
            title={post.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="h-full w-full"
          />
        </div>
      )}

      {(post.communityLink || (post.externalUrl && !post.externalEmbedUrl)) && (
          <div className="flex flex-wrap gap-2 pt-1">
          {post.communityLink && (
            <a
              href={post.communityLink}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"
            >
              <Send className="h-3.5 w-3.5" /> Join the channel
            </a>
          )}
          {post.externalUrl && !post.externalEmbedUrl && (
            <a
              href={post.externalUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Watch full video
            </a>
          )}
          </div>
      )}
      </div>
    </article>
  );
}

/** Creators tab feed: showcase work with auto-playing video previews. */
export function CreatorFeed({ reloadKey }: { reloadKey: number }) {
  const load = useServerFn(listCreatorFeed);
  const [posts, setPosts] = useState<CreatorPostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [field, setField] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .then((rows) => alive && setPosts(rows))
      .catch((e) => console.error("[creators] feed", e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [load, reloadKey]);

  const fields = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.fields.forEach((f) => set.add(f)));
    return Array.from(set).slice(0, 8);
  }, [posts]);

  const visible = field === "all" ? posts : posts.filter((p) => p.fields.includes(field));

  if (loading) {
    return (
      <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/60 p-10 text-center" aria-busy="true">
        <BadgeCheck className="mx-auto h-7 w-7 animate-pulse text-emerald-600" />
        <p className="mt-3 text-sm font-bold text-slate-900">Loading creators…</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/60 p-10 text-center">
        <BadgeCheck className="mx-auto h-7 w-7 text-emerald-600" />
        <p className="mt-3 text-sm font-bold text-slate-900">No creators content yet</p>
        <p className="mt-1 text-xs text-slate-500">Tap + to set up your creator profile and showcase your work.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-y border-border bg-background sm:rounded-[10px] sm:border-x">
      {fields.length > 0 && (
        <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["all", ...fields].map((f, i) => (
            <Button
              key={f}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setField(f)}
              className={`h-8 shrink-0 rounded-full px-3 text-xs font-bold shadow-none ${
                field === f ? "border-emerald-500 bg-emerald-500 text-primary-foreground hover:bg-emerald-600" : TINTS[i % TINTS.length]
              }`}
            >
              {f === "all" ? "All" : f}
            </Button>
          ))}
        </div>
      )}
      {visible.map((p, i) => (
        <CreatorCard key={p.id} post={p} index={i} />
      ))}
    </div>
  );
}
