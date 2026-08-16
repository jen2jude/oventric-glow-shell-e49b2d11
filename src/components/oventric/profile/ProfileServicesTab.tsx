import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass, PenTool, Plus, Send, Sparkles } from "lucide-react";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";
import { ServiceComposerModal } from "@/components/oventric/services/ServiceComposerModal";
import { ServicePackagesModal } from "@/components/oventric/services/ServicePackagesModal";

const ACCENT = "#E5484D";

function Cover({ url, className }: { url?: string | null; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-[#1C1C21] md:bg-slate-100 ${className ?? ""}`}>
      {url ? (
        <img loading="lazy" decoding="async" src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <PenTool className="h-6 w-6 text-white/25 md:text-slate-400" />
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { icon: Compass, title: "1. Discuss", body: "We talk about your needs" },
  { icon: PenTool, title: "2. Design", body: "I work and iterate" },
  { icon: Send, title: "3. Deliver", body: "You get the final deliverables" },
];

/**
 * Services tab for the identity hub — "Services I Offer" rows with a starting
 * price and a circular action arrow, plus a simple work-process explainer.
 */
export function ProfileServicesTab({
  items,
  isOwner,
  price,
  onPublished,
}: {
  items: ProfileListing[];
  isOwner: boolean;
  price: (usd: number) => string;
  onPublished?: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const [editingPackages, setEditingPackages] = useState<ProfileListing | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-white md:text-slate-900">Services I Offer</h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1 text-sm font-bold"
            style={{ color: ACCENT }}
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> Add service
          </button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {items.map((s) => (
          <div key={s.id} className="relative">
          <Link
            to="/product/$id"
            params={{ id: s.id }}
            className="flex items-stretch gap-3 rounded-2xl border border-white/10 bg-[#141417] p-3 transition-colors hover:bg-[#1A1A1F] md:web-card md:hover:bg-transparent"
          >
            <Cover url={s.coverUrl} className="h-[104px] w-[92px] shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-white md:text-slate-900">
                  {s.title}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400 md:text-slate-500">
                  {s.blurb?.trim() || s.category}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white md:text-slate-900">
                  Starting from{" "}
                  <span className="font-black">{price(s.priceUsd)}</span>
                </span>
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={3} />
                </span>
              </div>
            </div>
          </Link>
          {isOwner && (
            <button
              type="button"
              onClick={() => setEditingPackages(s)}
              className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-xs font-bold text-white md:border-slate-200 md:bg-white md:text-slate-700"
            >
              Edit packages
            </button>
          )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/12 bg-[#121216] p-6 text-center md:web-card">
            <Sparkles className="mx-auto h-6 w-6" style={{ color: ACCENT }} />
            <p className="mt-2 text-sm font-bold text-white md:text-slate-900">
              {isOwner ? "You haven't listed a service yet" : "No services listed yet"}
            </p>
            <p className="mt-1 text-xs text-slate-400 md:text-slate-500">
              {isOwner
                ? "Package what you do into a clear offer with a starting price."
                : "Check back soon — or send a message to ask about custom work."}
            </p>
            {isOwner && (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black text-white"
                style={{ backgroundColor: ACCENT }}
              >
                <Plus className="h-4 w-4" strokeWidth={3} /> Add your first service
              </button>
            )}
          </div>
        )}
      </div>

      <h3 className="mt-8 text-base font-black text-white md:text-slate-900">Work Process</h3>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#141417] p-4 md:web-card">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className={`px-2 text-center ${i > 0 ? "border-l border-white/10 md:border-slate-200" : ""}`}
          >
            <span
              className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-[#1C1C21] md:border-slate-200 md:bg-slate-50"
              style={{ color: ACCENT }}
            >
              <s.icon className="h-5 w-5" />
            </span>
            <div className="mt-2 text-xs font-bold text-white md:text-slate-900">{s.title}</div>
            <div className="mt-1 text-[11px] leading-snug text-slate-400 md:text-slate-500">
              {s.body}
            </div>
          </div>
        ))}
      </div>

      {isOwner && editingPackages && (
        <ServicePackagesModal
          open
          productId={editingPackages.id}
          serviceTitle={editingPackages.title}
          onClose={() => setEditingPackages(null)}
          onSaved={() => onPublished?.()}
        />
      )}

      {isOwner && (
        <ServiceComposerModal
          open={composing}
          onClose={() => setComposing(false)}
          onPublished={() => onPublished?.()}
        />
      )}
    </div>
  );
}
