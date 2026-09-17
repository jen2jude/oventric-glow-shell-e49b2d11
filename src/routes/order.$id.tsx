import { createFileRoute, Link } from "@tanstack/react-router";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, ExternalLink, Loader2, ArrowLeft, Mail } from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getOrderWithDownload, FX_FROM_USD, type OrderDTO } from "@/lib/marketplace.functions";
import { OrderFulfilmentRoadmap } from "@/components/oventric/OrderFulfilmentRoadmap";
import { formatMoney } from "@/lib/fx-display";

function fmt(v: number, c: Currency) {
  return formatMoney(v, c);
}

export const Route = createFileRoute("/order/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your order — Oventric" },
      { name: "description", content: "Track your Oventric order, download digital items and follow fulfilment status." },
      { property: "og:title", content: "Your order — Oventric" },
      { property: "og:description", content: "Track your Oventric order, download digital items and follow fulfilment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const load = useServerFn(getOrderWithDownload);
  const { homeCurrency } = useOnboarding();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load({ data: { orderId: id } })
      .then((r) => {
        if (cancelled) return;
        setOrder(r.order);
        setDownloadUrl(r.downloadUrl);
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message || "Order not found");
      });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  // Instant-download orders fire the download automatically once per order.
  useEffect(() => {
    if (!order || order.requiresManualDelivery) return;
    const href = downloadUrl ?? order.externalUrl;
    if (!href) return;
    const key = `oventric:auto-dl:${order.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — fall through and still trigger once */
    }
    window.open(href, "_blank", "noopener");
  }, [order, downloadUrl]);

  const displayAmount = order
    ? order.displayTotal * (FX_FROM_USD[homeCurrency] / FX_FROM_USD[order.displayCurrency])
    : 0;
  const href = downloadUrl ?? order?.externalUrl ?? null;

  return (
    <div className="page-light min-h-screen bg-[#121214] md:bg-slate-50 text-slate-200 md:text-slate-700 overflow-x-hidden">
      <Header onOpenMessages={() => {}} forceSiteNavbar={!useIsAppShell()} />
      <main
        className="max-w-2xl mx-auto w-full px-4 py-6 pb-24"
        style={{
          transform: entered ? "translateX(0)" : "translateX(100%)",
          transition: "transform 260ms ease-out",
          willChange: "transform",
        }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-300 md:text-slate-600 bg-[#1E1E24] md:shadow-sm md:bg-white border border-white/10 md:border-slate-200 rounded-[10px] px-3 py-2 mb-5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>

        {err && (
          <div className="bg-[#1E1E24] md:shadow-sm md:bg-white border border-amber-500/40 md:border-slate-200 rounded-[10px] p-5 text-sm text-slate-300 md:text-slate-700">
            <p className="font-semibold text-white md:text-slate-900 mb-1">
              This page shows a buyer's receipt
            </p>
            <p className="text-xs text-slate-400 md:text-slate-500 mb-3">
              If this is a sale you made, open it from your Sales &amp; Fulfilment list instead.
            </p>
            <a
              href="/dashboard?tab=sales"
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] px-4 py-2 text-sm font-semibold text-white"
            >
              Go to my sales
            </a>
          </div>
        )}
        {!order && !err && (
          <div className="flex items-center gap-2 text-slate-400 md:text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your order…
          </div>
        )}

        {order && (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-300" />
              </div>
              <h1 className="text-xl font-bold text-white md:text-slate-900 mb-1">
                Thank you for your purchase
              </h1>
              <p className="text-xs text-slate-400 md:text-slate-500">
                A receipt has been sent to your email.
              </p>
            </div>

            <div className="bg-[#1E1E24] md:shadow-sm md:bg-white border border-white/10 md:border-slate-200 rounded-[10px] p-4 mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">
                    {order.category}
                  </div>
                  <div className="text-white md:text-slate-900 font-bold text-base truncate">
                    {order.productName}
                  </div>
                  <div className="text-xs text-slate-500 md:text-slate-500 truncate">
                    by {order.vendor} · Qty {order.quantity}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white md:text-slate-900 font-bold">
                    {fmt(displayAmount, homeCurrency)}
                  </div>
                  <div className="text-[10px] text-slate-500 md:text-slate-500 font-mono uppercase">
                    {order.paymentMethod.replace("_", " ")}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 md:border-slate-200 pt-3 space-y-1.5 text-xs text-slate-400 md:text-slate-500">
                <div className="flex justify-between">
                  <span>Order ID</span>
                  <span className="font-mono text-slate-300 md:text-slate-600">
                    {order.id.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="text-emerald-300 font-semibold uppercase">{order.status}</span>
                </div>
                <div className="flex justify-between">
                  <span>Placed</span>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <OrderFulfilmentRoadmap orderId={order.id} />
            </div>

            {order.requiresManualDelivery ? (
              <div className="bg-[#1E1E24] md:shadow-sm md:bg-white border border-amber-500/40 rounded-[10px] p-4">
                <h2 className="text-white md:text-slate-900 font-bold text-base mb-1">
                  Manual delivery
                </h2>
                <p className="text-xs text-slate-400 md:text-slate-500 mb-3">
                  Payment received and held in escrow. The seller delivers this asset to you inside
                  your Oventric chat. Expect contact within 24 hours.
                </p>
                <div className="rounded-[10px] border border-amber-500/40 bg-amber-500/5 p-3 text-[11px] text-amber-100 leading-relaxed mb-3">
                  <strong className="text-amber-200">Keep the whole trade on Oventric.</strong> The
                  seller sends the file, link, or setup instructions through your in-app chat. Once
                  you have the goods, tap <em>Confirm receipt</em> to release payment.{" "}
                  <span className="text-amber-300 font-semibold">
                    Never continue on WhatsApp, Telegram or email
                  </span>{" "}
                  — escrow, refunds and dispute mediation only cover deals completed here.
                </div>
                {order.servicePackage && (
                  <div className="mb-3 rounded-[10px] border border-white/10 md:border-slate-200 bg-[#121214] md:bg-slate-50 px-3 py-2 text-xs">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                      Package
                    </div>
                    <div className="font-bold text-white md:text-slate-900">
                      {order.servicePackage.name}
                    </div>
                    {order.servicePackage.features.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-slate-400 md:text-slate-600">
                        {order.servicePackage.features.map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                      {order.servicePackage.deliveryDays != null && (
                        <span>{order.servicePackage.deliveryDays}-day delivery</span>
                      )}
                      {order.servicePackage.revisions != null && (
                        <span>{order.servicePackage.revisions} revisions</span>
                      )}
                    </div>
                  </div>
                )}
                {order.serviceBrief && Object.keys(order.serviceBrief).length > 0 && (
                  <div className="mb-3 rounded-[10px] border border-white/10 md:border-slate-200 bg-[#121214] md:bg-slate-50 px-3 py-2 text-xs">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                      Project brief
                    </div>
                    <dl className="space-y-1">
                      {Object.entries(order.serviceBrief).map(([k, v]) =>
                        v ? (
                          <div key={k}>
                            <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                              {k}
                            </dt>
                            <dd className="text-slate-300 md:text-slate-700">{v}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  </div>
                )}
                <div className="text-xs">
                  <div className="bg-[#121214] md:bg-slate-50 border border-white/10 md:border-slate-200 rounded-[10px] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 md:text-slate-500 mb-0.5">
                      Receipt email
                    </div>
                    <div className="text-white md:text-slate-900 font-mono truncate">
                      {order.deliveryEmail ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#1E1E24] md:shadow-sm md:bg-white border border-emerald-500/40 rounded-[10px] p-4">
                <h2 className="text-white md:text-slate-900 font-bold text-base mb-1">
                  Your download
                </h2>
                <p className="text-xs text-slate-400 md:text-slate-500 mb-3">
                  {downloadUrl
                    ? "Signed download link valid for 60 minutes."
                    : order.externalUrl
                      ? "Delivered from the seller's hosted link."
                      : "The seller hasn't attached a downloadable file for this listing."}
                </p>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-emerald-500 text-black font-bold text-sm"
                  >
                    {downloadUrl ? (
                      <>
                        <Download className="w-4 h-4" /> Download now
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" /> Open delivery link
                      </>
                    )}
                  </a>
                ) : (
                  <div className="text-xs text-slate-500 md:text-slate-500 inline-flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Delivery instructions sent to your email.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
