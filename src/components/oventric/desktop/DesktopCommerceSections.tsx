import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  Store,
  MessagesSquare,
  Sparkles,
  ArrowRight,
  Lock,
  Package,
} from "lucide-react";
import { listProducts, type ProductDTO } from "@/lib/marketplace.functions";
import {
  VisaMark,
  MastercardMark,
  VerveMark,
  PaystackMark,
  FlutterwaveMark,
  MiniPayMark,
  MtnMomoMark,
  BankTransferMark,
} from "@/components/oventric/desktop/PaymentLogos";

/* ------------------------------------------------------------------ */
/* Trade securely banner                                               */
/* ------------------------------------------------------------------ */

const PILLARS = [
  { Icon: Lock, title: "Dual Security", body: "Escrow for buyers and seller protection." },
  { Icon: Store, title: "Vetted Community", body: "Monitored trades and verified sellers." },
  { Icon: MessagesSquare, title: "Trusted Support", body: "24/7 assistance across 54 countries." },
];

export function TradeSecurelyBanner({ onLearnMore }: { onLearnMore: () => void }) {
  return (
    <section className="mx-auto w-full max-w-none px-4 pt-10 sm:px-8 sm:pt-20">
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(110deg,#6d7cf0_0%,#8b7bf0_45%,#c58ce8_100%)] p-6 sm:rounded-[28px] sm:p-10 lg:pr-[360px]">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-black tracking-tight text-white sm:text-4xl">
              Trade Securely with OventricProtect
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:mt-3 sm:text-base">
              Skip the scams and trade safely. We verify sellers and guarantee every purchase.
            </p>
          </div>

          {/* Mobile shield art */}
          <div className="relative grid h-16 w-16 shrink-0 place-items-center sm:h-20 sm:w-20 lg:hidden">
            <span className="absolute inset-0 rounded-full bg-white/20 blur-xl" />
            <ShieldCheck
              className="relative h-11 w-11 text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.25)] sm:h-12 sm:w-12"
              strokeWidth={1.5}
            />
          </div>
        </div>

        <div className="mt-6 grid max-w-2xl grid-cols-1 gap-5 sm:mt-8 sm:grid-cols-3 sm:gap-8">
          {PILLARS.map((p) => (
            <div key={p.title} className="flex items-start gap-3 sm:block">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 sm:mb-3 sm:h-auto sm:w-auto sm:bg-transparent">
                <p.Icon className="h-5 w-5 text-white sm:h-6 sm:w-6" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-base font-black text-white sm:text-lg">{p.title}</div>
                <p className="mt-0.5 text-sm leading-relaxed text-white/85 sm:mt-1">{p.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop shield art */}
        <div className="pointer-events-none absolute right-16 top-1/2 hidden -translate-y-1/2 lg:block">
          <div className="relative grid h-44 w-44 place-items-center">
            <span className="absolute inset-0 animate-pulse rounded-full bg-white/20 blur-2xl" />
            <ShieldCheck
              className="relative h-32 w-32 text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
              strokeWidth={1.5}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onLearnMore}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95 sm:mt-8 sm:h-11 sm:px-6 lg:absolute lg:bottom-9 lg:right-10"
        >
          Learn More <ArrowRight className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trending product rails (scrollable)                                  */
/* ------------------------------------------------------------------ */

function isAi(p: ProductDTO) {
  const hay = `${p.category ?? ""} ${p.subcategory ?? ""}`.toLowerCase();
  return hay.includes("ai");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ProductCard({ p }: { p: ProductDTO }) {
  return (
    <a
      href={`/product/${p.id}`}
      className="web-card group relative flex w-[220px] shrink-0 flex-col overflow-hidden bg-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-crimson focus:ring-offset-2"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {p.coverUrl ? (
          <img loading="lazy" decoding="async"
            src={p.coverUrl}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-800 to-slate-950" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
      </div>
      <div className="flex items-start gap-2 p-3">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-crimson" strokeWidth={2.5} />
        <span className="min-w-0 line-clamp-2 text-sm font-bold leading-snug text-white">{p.name}</span>
      </div>
    </a>
  );
}

function Rail({ items }: { items: ProductDTO[] }) {
  if (items.length === 0) return null;
  return (
    <div className="-mx-2 mt-6 flex gap-4 overflow-x-auto scroll-smooth px-2 pb-3 [scrollbar-width:thin]">
      {items.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}

export function ProductRails({ onSelect }: { onSelect: (section: string) => void }) {
  const load = useServerFn(listProducts);
  const [rows, setRows] = useState<ProductDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((r) => {
        if (!cancelled) setRows(r ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [load]);

  const active = useMemo(() => rows.filter((r) => r.status === "active"), [rows]);
  const aiRow = useMemo(() => active.filter(isAi).slice(0, 20), [active]);
  const otherRow = useMemo(() => shuffle(active.filter((p) => !isAi(p))).slice(0, 20), [active]);

  if (aiRow.length === 0 && otherRow.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-none px-5 pt-12 sm:px-8 sm:pt-16">
      <div className="flex items-end justify-between">
        <div>
          <div className="web-eyebrow">
            <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} /> Trending on the marketplace
          </div>
          <h2 className="web-accent-underline mt-4 inline-block text-3xl font-bold tracking-tight text-slate-900">
            AI platforms online
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Live AI tools and assets, plus fresh picks from every category.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect("Marketplace")}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-crimson hover:text-[#d13a3f]"
        >
          See all <ArrowRight className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>

      <Rail items={aiRow} />
      <Rail items={otherRow} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Secured payments                                                    */
/* ------------------------------------------------------------------ */

const METHODS = [
  { name: "Visa", Mark: VisaMark },
  { name: "Mastercard", Mark: MastercardMark },
  { name: "Verve", Mark: VerveMark },
  { name: "Paystack", Mark: PaystackMark },
  { name: "Flutterwave", Mark: FlutterwaveMark },
  { name: "MiniPay", Mark: MiniPayMark },
  { name: "MTN MoMo", Mark: MtnMomoMark },
  { name: "Bank transfer", Mark: BankTransferMark },
];

export function SecuredPayments() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-none px-5 py-12 text-center sm:px-8 sm:py-16">
        <div className="web-eyebrow">
          <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} /> Secured payments
        </div>
        <h2 className="web-accent-underline mt-4 inline-block text-3xl font-bold tracking-tight text-slate-900">
          Pay your way, protected end to end
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
          Every checkout is encrypted and held in escrow until delivery is confirmed. Pay with
          cards, mobile money or your Oventric wallet.
        </p>
      </div>

      {/* Solid tinted band — logos only, not interactive */}
      <div aria-hidden={false} className="w-full bg-[#EFEDF4] py-8">
        <ul className="mx-auto flex w-full max-w-none list-none flex-wrap items-center justify-center gap-x-8 gap-y-6 px-5 sm:gap-x-14 sm:gap-y-7 sm:px-8">
          {METHODS.map(({ name, Mark }) => (
            <li key={name} title={name} className="pointer-events-none flex items-center">
              <Mark />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
