import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/crypto-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-nowpayments-sig");

        const { verifyIpnSignature } = await import("@/lib/crypto/nowpayments.server");
        let valid = false;
        try {
          valid = verifyIpnSignature(raw, signature);
        } catch (err) {
          console.error("[crypto-webhook] signature check failed", err);
          return new Response("Not configured", { status: 500 });
        }
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const paymentId = payload["payment_id"];
        const status = payload["payment_status"];
        if (!paymentId || typeof status !== "string") {
          return new Response("Bad payload", { status: 400 });
        }

        try {
          const { applyProviderUpdate } = await import("@/lib/crypto/crypto-funding.server");
          await applyProviderUpdate({
            providerPaymentId: String(paymentId),
            providerStatus: status,
            actuallyPaid:
              payload["actually_paid"] === undefined ? null : Number(payload["actually_paid"]),
            payAmount: payload["pay_amount"] === undefined ? null : Number(payload["pay_amount"]),
          });
        } catch (err) {
          console.error("[crypto-webhook] settlement failed", err);
          return new Response("Processing error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
