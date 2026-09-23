import { createFileRoute, Link } from "@tanstack/react-router";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Gift,
  Loader2,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Package,
  RefreshCcw,
  Lock,
  ReceiptText,
  Sparkles,
} from "lucide-react";

import { Header } from "@/components/oventric/Header";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getOrderWithDownload, FX_FROM_USD, type OrderDTO } from "@/lib/marketplace.functions";
import { OrderFulfilmentRoadmap } from "@/components/oventric/OrderFulfilmentRoadmap";
import { formatMoney } from "@/lib/fx-display";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
  const isAppShell = useIsAppShell();
  const load = useServerFn(getOrderWithDownload);
  const { homeCurrency } = useOnboarding();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const signedIn = !!data.session;
      setAuthChecked(true);
      setIsSignedIn(signedIn);
      if (!signedIn) {
        setErr("sign_in_required");
        return;
      }
      load({ data: { orderId: id } })
        .then((r) => {
          if (cancelled) return;
          setOrder(r.order);
          setDownloadUrl(r.downloadUrl);
        })
        .catch((e: Error) => {
          if (!cancelled) setErr(e.message || "Order not found");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  const displayAmount = order
    ? order.displayTotal * (FX_FROM_USD[homeCurrency] / FX_FROM_USD[order.displayCurrency])
    : 0;
  const href = downloadUrl ?? order?.externalUrl ?? null;
  const isFree = Boolean(order) && Number(order?.totalUSD ?? 0) <= 0;


  return (
    <div className="web-order min-h-screen overflow-x-hidden bg-newsfeed-blue-soft/30 text-newsfeed-ink">
      <Header onOpenMessages={() => {}} forceSiteNavbar={!isAppShell} />
      <main
        className="mx-auto w-full max-w-3xl px-3 pb-24 pt-5 sm:px-5 sm:pt-8 md:py-12"
        style={{
          transform: entered ? "translateY(0)" : "translateY(20px)",
          opacity: entered ? 1 : 0,
          transition: "transform 360ms ease-out, opacity 360ms ease-out",
          willChange: "transform, opacity",
        }}
      >
        <Button asChild variant="outline" className="mb-5 rounded-[10px] border-newsfeed-line bg-newsfeed-surface text-newsfeed-ink shadow-sm hover:bg-newsfeed-blue-soft">
          <Link to="/marketplace">
            <ArrowLeft /> Back to Marketplace
          </Link>
        </Button>

        {!authChecked && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking your session…
          </div>
        )}

        {err === "sign_in_required" && authChecked && (
          <div className="bg-white border border-slate-200 rounded-[10px] p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-slate-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2 font-wallet-display">
              Sign in to view your order
            </h1>
            <p className="text-sm text-slate-600 mb-5 max-w-xs mx-auto">
              Your receipt is linked to your account. Sign in to see order details, downloads, and delivery updates.
            </p>
            <button
              onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/order/${id}` } })}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#D63D42] transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {err && err !== "sign_in_required" && (
          <div className="bg-white border border-amber-200 rounded-[10px] p-6 shadow-sm">
            <p className="font-semibold text-slate-900 mb-1">This page shows a buyer&apos;s receipt</p>
            <p className="text-sm text-slate-600 mb-4">
              If this is a sale you made, open it from your Sales &amp; Fulfilment list instead.
            </p>
            <a
              href="/dashboard?tab=sales"
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#D63D42] transition-colors"
            >
              Go to my sales
            </a>
          </div>
        )}

        {order && (
          <>
            <section className="relative mb-5 overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface shadow-newsfeed-panel">
              <div className="grid h-1.5 grid-cols-5" aria-hidden="true">
                <span className="bg-newsfeed-coral" />
                <span className="bg-newsfeed-gold" />
                <span className="bg-newsfeed-green" />
                <span className="bg-newsfeed-blue" />
                <span className="bg-newsfeed-violet" />
              </div>
              <div className="px-5 py-7 text-center sm:px-8 sm:py-9">
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border ${isFree ? "border-newsfeed-violet/25 bg-newsfeed-violet-soft text-newsfeed-violet" : "border-newsfeed-green/25 bg-newsfeed-green-soft text-newsfeed-green"}`}>
                  {isFree ? <Gift className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
                </div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-newsfeed-green-soft px-3 py-1 text-[10px] font-extrabold uppercase text-newsfeed-green">
                  <Sparkles className="h-3 w-3" /> {isFree ? "Ready for you" : "Payment confirmed"}
                </div>
                <h1 className="mb-2 text-2xl font-extrabold text-newsfeed-ink sm:text-3xl font-wallet-display">
                  {isFree ? "Your free download is ready" : "Your purchase is ready"}
                </h1>
                <p className="mx-auto max-w-md text-sm leading-relaxed text-newsfeed-muted">
                  {isFree
                    ? "It is saved to My purchases, so you can download it again whenever you need it."
                    : order.requiresManualDelivery
                      ? "Payment is confirmed. Follow the delivery steps below while the seller prepares your order."
                      : "Your digital product has been delivered. Download it here or return from My purchases at any time."}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-newsfeed-muted">
                  <ReceiptText className="h-4 w-4 text-newsfeed-blue" /> Order {order.id.slice(0, 8)}
                </div>
              </div>
            </section>

            {!order.requiresManualDelivery && (
              <section className="mb-5 rounded-[10px] border border-newsfeed-green/25 bg-newsfeed-surface p-5 shadow-newsfeed-panel sm:p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-newsfeed-green-soft text-newsfeed-green">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-wallet-display text-base font-extrabold text-newsfeed-ink">Your download</h2>
                    <p className="mt-0.5 text-sm text-newsfeed-muted">
                      {downloadUrl
                        ? "Your secure link is valid for 60 minutes. You can create a fresh one from My purchases."
                        : order.externalUrl
                          ? "This product is delivered through the seller’s hosted link."
                          : "Delivery instructions have been sent to your email."}
                    </p>
                  </div>
                </div>
                {href ? (
                  <Button asChild className="h-11 w-full rounded-[10px] bg-newsfeed-violet font-extrabold text-newsfeed-on-accent shadow-newsfeed-panel hover:bg-newsfeed-violet/90 sm:w-auto">
                    <a href={href} target="_blank" rel="noreferrer">
                      {downloadUrl ? <Download /> : <ExternalLink />}
                      {downloadUrl ? "Download now" : "Open delivery link"}
                    </a>
                  </Button>
                ) : (
                  <div className="inline-flex items-center gap-2 text-sm text-newsfeed-muted">
                    <Mail className="h-4 w-4 text-newsfeed-gold" /> Check your receipt email for delivery details.
                  </div>
                )}
              </section>
            )}
            <section className="mb-5 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-5 shadow-newsfeed-panel">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="mb-1 text-[10px] font-bold uppercase text-newsfeed-coral">
                    {order.category}
                  </div>
                  <div className="truncate text-base font-bold text-newsfeed-ink md:text-lg">
                    {order.productName}
                  </div>
                  <div className="truncate text-xs text-newsfeed-muted">
                    by {order.vendor} · Qty {order.quantity}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isFree ? (
                    <span className="inline-flex items-center rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
                      Free
                    </span>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-newsfeed-ink">
                        {fmt(displayAmount, homeCurrency)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono uppercase">
                        {order.paymentMethod.replace("_", " ")}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-newsfeed-line pt-4 text-sm text-newsfeed-muted">
                <div className="flex justify-between">
                  <span>{isFree ? "Reference" : "Order ID"}</span>
                   <span className="font-mono text-newsfeed-ink">{order.id.slice(0, 8)}…</span>
                </div>
                {!isFree && (
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="text-emerald-600 font-semibold uppercase">{order.status}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{isFree ? "Downloaded" : "Placed"}</span>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </section>

            {!(isFree && !order.requiresManualDelivery) && (
              <div className="mb-5">
                <OrderFulfilmentRoadmap orderId={order.id} />
              </div>
            )}


            {order.requiresManualDelivery ? (
              <div className="bg-white border border-amber-200 rounded-[10px] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-amber-500" />
                  <h2 className="text-slate-900 font-bold text-base font-wallet-display">
                    Manual delivery
                  </h2>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Payment received and held in escrow. The seller delivers this asset to you inside
                  your Oventric chat. Expect contact within 24 hours.
                </p>
                <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-relaxed mb-4">
                  <strong className="text-amber-950">Keep the whole trade on Oventric.</strong> The
                  seller sends the file, link, or setup instructions through your in-app chat. Once
                  you have the goods, tap <em>Confirm receipt</em> to release payment.{" "}
                  <span className="text-amber-700 font-semibold">
                    Never continue on WhatsApp, Telegram or email
                  </span>{" "}
                  — escrow, refunds and dispute mediation only cover deals completed here.
                </div>
                {order.servicePackage && (
                  <div className="mb-4 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                      Package
                    </div>
                    <div className="font-bold text-slate-900">{order.servicePackage.name}</div>
                    {order.servicePackage.features.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-slate-600">
                        {order.servicePackage.features.map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-500">
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
                  <div className="mb-4 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
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
                            <dd className="text-slate-700">{v}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  </div>
                )}
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                    Receipt email
                  </div>
                  <div className="text-slate-900 font-mono truncate">{order.deliveryEmail ?? "—"}</div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/dashboard"
                search={{ tab: "digital" }}
                className="flex items-center gap-3 rounded-[10px] border border-newsfeed-violet/20 bg-newsfeed-surface p-4 shadow-sm transition-colors hover:bg-newsfeed-violet-soft"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-newsfeed-violet-soft">
                  <RefreshCcw className="h-5 w-5 text-newsfeed-violet" />
                </div>
                <div>
                   <div className="text-sm font-semibold text-newsfeed-ink">My purchases</div>
                   <div className="text-xs text-newsfeed-muted">Track and re-download your orders.</div>
                </div>
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-3 rounded-[10px] border border-newsfeed-blue/20 bg-newsfeed-surface p-4 shadow-sm transition-colors hover:bg-newsfeed-blue-soft"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-newsfeed-blue-soft">
                  <ShieldCheck className="h-5 w-5 text-newsfeed-blue" />
                </div>
                <div>
                   <div className="text-sm font-semibold text-newsfeed-ink">Seller chat</div>
                   <div className="text-xs text-newsfeed-muted">Get delivery help inside Oventric.</div>
                </div>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
