import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getMyPurchaseSummary,
  generateMyPurchaseSummary,
  type PurchaseSummaryDTO,
} from "@/lib/purchase-assistant.functions";

/**
 * One-tap AI rundown of the buyer's latest orders: what was bought, from whom,
 * the order ID and the exact next step (download, open, wait, confirm).
 * The newest summary is saved to the account and restored on return.
 */
export function PurchaseAssistantPanel() {
  const loadFn = useServerFn(getMyPurchaseSummary);
  const genFn = useServerFn(generateMyPurchaseSummary);
  const [data, setData] = useState<PurchaseSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFn()
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        /* no saved summary yet */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadFn]);

  const run = useCallback(async () => {
    setWorking(true);
    try {
      setData(await genFn({}));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [genFn]);

  return (
    <section className="rounded-[10px] border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground md:text-base">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent text-primary">
              <Sparkle className="h-4 w-4" />
            </span>
            Purchase assistant
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Get a plain-language rundown of your latest orders and what to do with each one.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={working}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {working ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {data ? "Refresh" : "Summarise"}
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-16 animate-pulse rounded-[10px] bg-muted" />
        ) : working && !data ? (
          <p className="text-xs text-muted-foreground">Reading your orders…</p>
        ) : data ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {data.summary}
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Covering your last {data.orderCount} order{data.orderCount === 1 ? "" : "s"} ·
              updated {new Date(data.createdAt).toLocaleString()}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tap Summarise and your recent purchases will be explained here.
          </p>
        )}
      </div>
    </section>
  );
}
