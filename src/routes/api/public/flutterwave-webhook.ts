import { createFileRoute } from "@tanstack/react-router";
import { ACTIVE_RAILS } from "@/lib/payments/active-rails";
import { timingSafeEqual } from "crypto";
import { createHash } from "crypto";
import { verifyAndSettle } from "@/lib/payments/gateway.server";
import { applyPayoutOutcome } from "@/lib/payments/payout-events.server";

/**
 * Flutterwave v3 webhook. Flutterwave authenticates with a static `verif-hash`
 * header rather than a body signature, so the handler re-verifies every charge
 * against the API before any money moves.
 */
export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      // MVP lock: Flutterwave is not an active rail. This endpoint must never
      // settle money. The legacy handler stays in git history / `flutterwave.server.ts`.
      POST: async () => {
        if (!ACTIVE_RAILS.flutterwave) {
          return new Response("Flutterwave is disabled", { status: 410 });
        }
        return new Response("Flutterwave is disabled", { status: 410 });
      },
    },
  },
});
