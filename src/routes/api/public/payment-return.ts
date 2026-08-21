import { createFileRoute } from "@tanstack/react-router";

/**
 * Ungated landing hop for payment gateways.
 *
 * Gateways (Paystack / Flutterwave) redirect here after checkout; we forward
 * the shopper to the in-app payment status screen. Living under
 * `/api/public/*` guarantees the hop is never intercepted by site auth, so a
 * successful payment can't dead-end on a "page not found" screen.
 */
export const Route = createFileRoute("/api/public/payment-return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const reference =
          url.searchParams.get("reference") ||
          url.searchParams.get("trxref") ||
          url.searchParams.get("tx_ref") ||
          "";
        const target = new URL("/payment/return", url.origin);
        if (reference) target.searchParams.set("reference", reference);
        return new Response(null, {
          status: 302,
          headers: { location: target.toString(), "cache-control": "no-store" },
        });
      },
    },
  },
});
