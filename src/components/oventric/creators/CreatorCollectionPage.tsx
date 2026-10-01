import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, ExternalLink, FolderHeart, Play, ShoppingBag } from "lucide-react";
import type { CreatorPostDTO, PublicCollectionDTO } from "@/lib/creators.functions";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { Header } from "@/components/oventric/Header";
import { CreatorPostSheet } from "@/components/oventric/app/CreatorPostSheet";

const KIND_LABEL = { post: "Content", resource: "Resource", product: "Product", link: "Link" } as const;

/** Public collection page: content → resource → product → shop in one place. */
export function CreatorCollectionPage({ collection: c }: { collection: PublicCollectionDTO }) {
  const isApp = useIsAppShell();
  const navigate = useNavigate();
  const [openPost, setOpenPost] = useState<CreatorPostDTO | null>(null);
  const handle = c.creator.slug ?? c.creator.username;
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/creators" });
  };

  const t = isApp
    ? { page: "fixed inset-0 overflow-y-auto overscroll-contain bg-[#070A08] text-white [-webkit-overflow-scrolling:touch]", muted: "text-white/55", card: "bg-white/[0.04] border-white/10", cta: "bg-[#E5484D] text-white", ghost: "border-white/15 text-white" }
    : { page: "min-h-screen bg-white text-slate-900", muted: "text-slate-500", card: "bg-white border-slate-200 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)]", cta: "bg-slate-900 text-white", ghost: "border-slate-200 text-slate-900" };

  const cta = (it: PublicCollectionDTO["items"][number]) => {
    if (it.kind === "product" && it.product) return <Link to="/product/$id" params={{ id: it.product.slug ?? it.product.id }} className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12px] font-bold ${t.cta}`}><ShoppingBag className="h-3.5 w-3.5" /> View product</Link>;
    if (it.kind === "link" && it.url) return <a href={it.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-bold ${t.ghost}`}><ExternalLink className="h-3.5 w-3.5" /> Open</a>;
    if (it.post) return <button onClick={() => setOpenPost(it.post)} className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12px] font-bold ${it.kind === "resource" ? t.cta : `border ${t.ghost}`}`}>{it.kind === "resource" ? <><Download className="h-3.5 w-3.5" /> {it.post.asset && it.post.asset.priceUsd > 0 ? "Buy & Download" : "Get Resource"}</> : <><Play className="h-3.5 w-3.5" /> View</>}</button>;
    return null;
  };

  return (
    <div className={t.page}>
      {!isApp && <Header />}
      <div className={`mx-auto ${isApp ? "px-4 pb-28 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "max-w-4xl px-4 py-6"}`}>
        <button onClick={back} aria-label="Back" className="-ml-2 mb-3 rounded-full p-2"><ArrowLeft className="h-5 w-5" /></button>

        <div className={`overflow-hidden rounded-[10px] border ${t.card} ${isApp ? "" : "md:flex"}`}>
          <div className={`bg-black/10 ${isApp ? "aspect-[16/9]" : "aspect-[16/9] md:aspect-auto md:w-1/2"}`}>
            {c.coverUrl ? <img src={c.coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full min-h-40 items-center justify-center"><FolderHeart className="h-10 w-10 opacity-40" /></div>}
          </div>
          <div className="flex-1 p-4 md:p-6">
            <p className={`text-[11px] font-bold uppercase tracking-wide ${isApp ? "text-[#E5484D]" : "text-violet-600"}`}>Collection{c.category ? ` · ${c.category}` : ""} · {c.items.length} items</p>
            <h1 className={`mt-1 font-wallet-display font-bold ${isApp ? "text-[20px]" : "text-[28px]"}`}>{c.title}</h1>
            {handle ? (
              <Link to="/creators/$handle" params={{ handle: `@${handle}` }} className="mt-3 flex items-center gap-2">
                <span className="h-7 w-7 overflow-hidden rounded-full bg-black/20">{c.creator.avatarUrl && <img src={c.creator.avatarUrl} alt="" className="h-full w-full object-cover" />}</span>
                <span className="text-[13px] font-bold">{c.creator.name}</span>
              </Link>
            ) : (
              <p className="mt-3 text-[13px] font-bold">{c.creator.name}</p>
            )}
            {c.description && <p className={`mt-3 whitespace-pre-line text-[13.5px] leading-relaxed ${t.muted}`}>{c.description}</p>}
          </div>
        </div>

        {!c.items.length ? (
          <p className={`mt-6 text-center text-[13px] ${t.muted}`}>Nothing available in this collection right now.</p>
        ) : (
          <ol className="mt-5 space-y-2.5">
            {c.items.map((it, i) => (
              <li key={it.id} className={`flex items-center gap-3 rounded-[10px] border p-2.5 ${t.card}`}>
                <span className={`w-5 shrink-0 text-center text-[12px] font-bold ${t.muted}`}>{i + 1}</span>
                <div className={`shrink-0 overflow-hidden rounded-[8px] bg-black/10 ${isApp ? "h-14 w-14" : "h-16 w-20"}`}>{it.imageUrl && <img src={it.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-bold">{it.title}</p>
                  <p className={`text-[11px] ${t.muted}`}>{KIND_LABEL[it.kind]}{it.note ? ` · ${it.note}` : ""}</p>
                </div>
                <div className="shrink-0">{cta(it)}</div>
              </li>
            ))}
          </ol>
        )}

        {handle && c.creator.shopCount > 0 && (
          <Link to="/shop/$id" params={{ id: handle }} className={`mt-5 flex items-center justify-center gap-2 rounded-[10px] py-3 text-[13px] font-bold ${isApp ? "bg-[#E5484D] text-white" : "bg-slate-900 text-white"}`}>
            <ShoppingBag className="h-4 w-4" /> Visit {c.creator.name}'s shop ({c.creator.shopCount})
          </Link>
        )}
      </div>
      <CreatorPostSheet post={openPost} onClose={() => setOpenPost(null)} />
    </div>
  );
}
