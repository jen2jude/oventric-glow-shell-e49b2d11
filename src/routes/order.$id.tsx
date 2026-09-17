import { createFileRoute, Link } from "@tanstack/react-router";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Package,
  RefreshCcw,
  Lock,
} from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getOrderWithDownload, FX_FROM_USD, type OrderDTO } from "@/lib/marketplace.functions";
import { OrderFulfilmentRoadmap } from "@/components/oventric/OrderFulfilmentRoadmap";
import { formatMoney } from "@/lib/fx-display";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="web-order min-h-screen bg-[#F7F8FA] text-slate-700 overflow-x-hidden">
      <Header onOpenMessages={() => {}} forceSiteNavbar={!isAppShell} />
      <main
        className="max-w-2xl mx-auto w-full px-4 py-8 md:py-12 pb-24"
        style={{
          transform: entered ? "translateY(0)" : "translateY(20px)",
          opacity: entered ? 1 : 0,
          transition: "transform 360ms ease-out, opacity 360ms ease-out",
          willChange: "transform, opacity",
        }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-[10px] px-3 py-2 mb-6 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>

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
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 font-wallet-display">
                Thank you for your purchase
              </h1>
              <p className="text-sm text-slate-600">
                A receipt has been sent to your email.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm mb-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#E5484D] mb-1">
                    {order.category}
                  </div>
                  <div className="text-slate-900 font-bold text-base md:text-lg truncate">
                    {order.productName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    by {order.vendor} · Qty {order.quantity}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-slate-900 font-bold text-lg">
                    {fmt(displayAmount, homeCurrency)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono uppercase">
                    {order.paymentMethod.replace("_", " ")}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Order ID</span>
                  <span className="font-mono text-slate-800">{order.id.slice(0, 8)}…</span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="text-emerald-600 font-semibold uppercase">{order.status}</span>
                </div>
                <div className="flex justify-between">
                  <span>Placed</span>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <OrderFulfilmentRoadmap orderId={order.id} />
            </div>

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
            ) : (
              <div className="bg-white border border-emerald-200 rounded-[10px] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-slate-900 font-bold text-base font-wallet-display">
                    Your download
                  </h2>
                </div>
                <p className="text-sm text-slate-600 mb-4">
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
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-emerald-600 text-white font-semibold text-sm shadow-sm hover:bg-emerald-700 transition-colors"
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
                  <div className="text-sm text-slate-500 inline-flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Delivery instructions sent to your email.
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="/dashboard?tab=purchases"
                className="flex items-center gap-3 rounded-[10px] bg-white border border-slate-200 p-4 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#E5484D]/10 flex items-center justify-center shrink-0">
                  <RefreshCcw className="w-5 h-5 text-[#E5484D]" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">My purchases</div>
                  <div className="text-xs text-slate-500">Track and re-download your orders.</div>
                </div>
              </a>
              <a
                href="/messages"
                className="flex items-center gap-3 rounded-[10px] bg-white border border-slate-200 p-4 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">Seller chat</div>
                  <div className="text-xs text-slate-500">Get delivery help inside Oventric.</div>
                </div>
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
