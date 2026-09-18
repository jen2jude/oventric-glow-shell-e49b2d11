import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: release escrow for orders whose 24-hour buyer-confirmation window
 * has elapsed with no dispute. Called by pg_cron with the anon `apikey`
 * header; `/api/public/*` bypasses the site auth gate.
 */
export const Route = createFileRoute("/api/public/hooks/auto-release-orders")({
  server: {
    handlers: {
      POST: async () => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!anon) return new Response("misconfigured", { status: 500 });
        try {
          const { sweepEscrowTimers, notifyPreReleaseDue } = await import("@/lib/fulfilment.server");
          const swept = await sweepEscrowTimers();
          let warned = 0;
          try {
            ({ warned } = await notifyPreReleaseDue());
          } catch (e) {
            console.error("[auto-release-orders] pre-release notice failed", e);
          }
          return Response.json({ ok: true, ...swept, warned });
        } catch (e) {
          console.error("[auto-release-orders] failed", e);
          return new Response("sweep failed", { status: 500 });
        }

      },
    },
  },
});
