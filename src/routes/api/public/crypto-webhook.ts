/**
 * NOWPayments IPN endpoint — DISABLED in the Oventric MVP.
 *
 * Crypto deposit funding is not an active rail, so this route must never
 * settle money. It is kept as a stub (instead of deleted) so the provider URL
 * resolves without reaching any settlement code. The handler in
 * `src/lib/crypto/crypto-funding.server.ts` is intentionally not imported.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ACTIVE_RAILS } from "@/lib/payments/active-rails";

export const Route = createFileRoute("/api/public/crypto-webhook")({
  server: {
    handlers: {
      POST: async () => {
        if (!ACTIVE_RAILS.crypto) {
          return new Response("Crypto payments are disabled", { status: 410 });
        }
        return new Response("Crypto payments are disabled", { status: 410 });
      },
    },
  },
});
