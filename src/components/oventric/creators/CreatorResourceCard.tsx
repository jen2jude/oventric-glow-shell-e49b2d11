import { logCreatorEvent } from "@/lib/creator-events";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Download, FileText, Lock, Pencil, Share2, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CREATOR_CONTENT_TYPES,
  deleteCreatorPost,
  getCreatorResourceDownload,
  saveCreatorPostToCollection,
  type CreatorPostDTO,
} from "@/lib/creators.functions";
import { createOrder } from "@/lib/marketplace.functions";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { visibleProductPrice } from "@/lib/money-visibility";
import { FollowButton } from "@/components/oventric/FollowButton";
import { CreatorPublishModal } from "./CreatorPublishModal";

const CRIMSON = "#E5484D";

export function contentTypeLabel(key?: string | null) {
  return CREATOR_CONTENT_TYPES.find((c) => c.key === key)?.label ?? "Showcase";
}

function openUrl(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Content type, category, tools and tags for a creator post. */
export function CreatorPostDetails({ post, dark }: { post: CreatorPostDTO; dark?: boolean }) {
  const chip = dark
    ? "border-white/10 bg-white/[0.04] text-white/70"
    : "border-slate-200 bg-slate-50 text-slate-600";
  const tools = post.postTools?.length ? post.postTools : (post.author.tools ?? []);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
      <span
        className="rounded-full px-2.5 py-1"
        style={dark ? { background: `${CRIMSON}1f`, color: "#FF7A7E" } : { background: "#0f172a", color: "#ffffff" }}
      >
        {contentTypeLabel(post.contentType)}
      </span>
      {post.category && <span className={`rounded-full border px-2.5 py-1 ${chip}`}>{post.category}</span>}
      {tools.slice(0, 4).map((t) => (
        <span key={t} className={`rounded-full border px-2.5 py-1 ${chip}`}>{t}</span>
      ))}
      {(post.tags ?? []).slice(0, 5).map((t) => (
        <span key={t} className={dark ? "text-white/40" : "text-slate-400"}>#{t}</span>
      ))}
    </div>
  );
}

/** Share, Save and Follow — reuses existing collections and follow systems. */
export function CreatorPostActions({ post, dark }: { post: CreatorPostDTO; dark?: boolean; isOwner?: boolean }) {
  const save = useServerFn(saveCreatorPostToCollection);
  const remove = useServerFn(deleteCreatorPost);
  const [saving, setSaving] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);
  const isOwner = !!meId && meId === post.author.userId;

  const onDelete = async () => {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    try {
      await remove({ data: { postId: post.id } });
      toast.success("Post deleted");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    }
  };
  const btn = dark
    ? "border-white/10 bg-white/[0.04] text-white/80"
    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  const share = async () => {
    const url = `${window.location.origin}/feed?creatorPost=${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
      logCreatorEvent(post.id, "share", { target: "share" });
    } catch {
      /* user cancelled */
    }
  };

  const onSave = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return toast.error("Sign in to save posts");
    setSaving(true);
    try {
      const res = await save({
        data: { postId: post.id, title: post.title, imageUrl: post.media[0]?.posterUrl ?? post.media[0]?.url ?? null },
      });
      toast.success(res.alreadySaved ? "Already in your Saved board" : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-bold ${btn}`}>
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>
      <button type="button" disabled={saving} onClick={onSave} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-bold disabled:opacity-50 ${btn}`}>
        <Bookmark className="h-3.5 w-3.5" /> Save
      </button>
      {isOwner ? (
        <>
          <button type="button" onClick={() => setEditOpen(true)} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-bold ${btn}`}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={onDelete} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-bold ${btn}`}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <CreatorPublishModal open={editOpen} editPostId={post.id} onClose={() => setEditOpen(false)} onPublished={() => window.location.reload()} />
        </>
      ) : (
        <FollowButton targetId={post.author.userId} compact={dark} className="!h-8 !px-3 !py-0 !text-[11.5px]" />
      )}
    </div>
  );
}

/** Attached Oventric product (existing shop listing). */
export function CreatorProductAttachment({ post, dark }: { post: CreatorPostDTO; dark?: boolean }) {
  const { homeCurrency, balancesHidden } = useOnboarding();
  const p = post.showcaseProduct;
  if (!p) return null;
  const price = visibleProductPrice(
    { price_usd: p.priceUsd, original_currency: p.originalCurrency ?? "USD", original_amount: p.originalAmount ?? p.priceUsd, fx_snapshot: p.fxSnapshot },
    (homeCurrency ?? "USD") as Currency,
    balancesHidden,
  );
  return (
    <Link
      to="/product/$id"
      params={{ id: p.slug ?? p.id }}
      className={`mt-3 flex items-center gap-3 rounded-[10px] border p-2.5 ${dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white hover:bg-slate-50"}`}
    >
      <span className={`h-12 w-12 shrink-0 overflow-hidden rounded-[8px] ${dark ? "bg-white/5" : "bg-slate-100"}`}>
        {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[10px] font-bold uppercase ${dark ? "text-white/40" : "text-slate-400"}`}>Featured product</span>
        <span className={`block truncate text-[13px] font-bold ${dark ? "text-white" : "text-slate-900"}`}>{p.name}</span>
      </span>
      <span className={`shrink-0 text-[12px] font-bold ${dark ? "text-white/80" : "text-slate-900"}`}>{price}</span>
    </Link>
  );
}

/**
 * Resource card: thumbnail, creator, title, type, description, Free/Paid,
 * price, license and the secure Get Resource / Buy & Download action.
 * Access is decided by the server against paid orders, never the client.
 */
export function CreatorResourceCard({ post, dark, onDone }: { post: CreatorPostDTO; dark?: boolean; onDone?: () => void }) {
  const { baseCurrency, homeCurrency, balancesHidden } = useOnboarding();
  const navigate = useNavigate();
  const getDownload = useServerFn(getCreatorResourceDownload);
  const freeOrder = useServerFn(createOrder);
  const [busy, setBusy] = useState(false);
  const [owned, setOwned] = useState(false);
  const asset = post.asset;

  // Signed-in buyers who already own a paid resource see "Download".
  useEffect(() => {
    let alive = true;
    if (!asset?.available || asset.isFree) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      try {
        const r = await getDownload({ data: { postId: post.id } });
        if (alive && r.authorized) setOwned(true);
      } catch {
        /* not owned */
      }
    });
    return () => {
      alive = false;
    };
  }, [asset?.available, asset?.isFree, post.id, getDownload]);

  if (!asset) return null;
  const thumb = post.media[0]?.posterUrl ?? (post.media[0]?.type === "image" ? post.media[0].url : null);
  const price = asset.isFree
    ? "Free"
    : visibleProductPrice(
        { price_usd: asset.priceUsd, original_currency: asset.originalCurrency ?? "USD", original_amount: asset.originalAmount ?? asset.priceUsd, fx_snapshot: asset.fxSnapshot },
        (homeCurrency ?? "USD") as Currency,
        balancesHidden,
      );
  const license = post.resource?.license ?? [];

  const act = async () => {
    if (busy) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      toast.error(asset.isFree ? "Sign in to get this resource" : "Sign in to buy this resource");
      return;
    }
    setBusy(true);
    try {
      let r = await getDownload({ data: { postId: post.id } });
      if (!r.authorized && r.reason === "no_access" && asset.isFree) {
        // Free: record the download as a zero-value order, then authorize.
        await freeOrder({
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
        r = await getDownload({ data: { postId: post.id } });
      }
      if (r.authorized) {
        openUrl(r.url);
        toast.success("Download started", { description: "It's saved in your dashboard for later." });
        onDone?.();
        return;
      }
      if (r.reason === "no_access" && !asset.isFree) {
        onDone?.();
        navigate({ to: "/product/$id", params: { id: asset.productId } });
        return;
      }
      toast.error("This resource isn't available right now");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open this resource");
    } finally {
      setBusy(false);
    }
  };

  const shell = dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white";
  const muted = dark ? "text-white/45" : "text-slate-500";
  const strong = dark ? "text-white" : "text-slate-900";

  return (
    <div className={`mt-4 overflow-hidden rounded-[10px] border ${shell}`} data-testid="creator-resource-card">
      <div className="flex gap-3 p-3">
        <span className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[8px] ${dark ? "bg-white/5" : "bg-slate-100"}`}>
          {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <FileText className={`h-6 w-6 ${muted}`} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase ${muted}`}>{post.resource?.type || asset.category || "Resource"}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[9.5px] font-bold"
              style={asset.isFree ? { background: dark ? "#ffffff14" : "#ecfdf5", color: dark ? "#ffffffcc" : "#047857" } : { background: `${CRIMSON}1f`, color: dark ? "#FF7A7E" : CRIMSON }}
            >
              {asset.isFree ? "Free" : "Paid"}
            </span>
          </div>
          <p className={`mt-0.5 line-clamp-1 text-[13.5px] font-bold ${strong}`}>{post.title}</p>
          <p className={`text-[11px] ${muted}`}>by {post.author.name}</p>
          {post.caption && <p className={`mt-1 line-clamp-2 text-[11.5px] ${muted}`}>{post.caption}</p>}
        </div>
      </div>
      {(license.length > 0 || post.resource?.licenseNote) && (
        <div className={`flex flex-wrap gap-1.5 px-3 pb-2 text-[10px] font-bold ${muted}`}>
          <span>License:</span>
          {license.map((l) => (
            <span key={l} className={`rounded-full border px-2 py-0.5 ${dark ? "border-white/10" : "border-slate-200"}`}>{l}</span>
          ))}
          {post.resource?.licenseNote && <span className="font-medium">{post.resource.licenseNote}</span>}
        </div>
      )}
      <div className={`flex items-center justify-between gap-3 border-t px-3 py-2.5 ${dark ? "border-white/10" : "border-slate-100"}`}>
        <span className={`text-[14px] font-bold ${strong}`}>{price}</span>
        {asset.available ? (
          <button
            type="button"
            disabled={busy}
            onClick={act}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold disabled:opacity-50"
            style={{ background: CRIMSON, color: "#ffffff" }}
          >
            {asset.isFree || owned ? <Download className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            {busy ? "Checking…" : asset.isFree ? "Get Resource" : owned ? "Download" : "Buy & Download"}
          </button>
        ) : (
          <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold ${muted}`}>
            <Lock className="h-3.5 w-3.5" /> Pending review
          </span>
        )}
      </div>
    </div>
  );
}
