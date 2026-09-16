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
    <section className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm md:text-base font-bold text-white md:text-slate-900">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-[#E5484D]/10 text-[#E5484D]">
              <Sparkle className="h-4 w-4" />
            </span>
            Purchase assistant
          </h3>
          <p className="mt-1 text-xs text-slate-400 md:text-slate-500">
            Get a plain-language rundown of your latest orders and what to do with each one.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={working}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[#E5484D] px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
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
          <div className="h-16 animate-pulse rounded-[10px] bg-white/5 md:bg-slate-100" />
        ) : working && !data ? (
          <p className="text-xs text-slate-400 md:text-slate-500">Reading your orders…</p>
        ) : data ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200 md:text-slate-700">
              {data.summary}
            </p>
            <p className="mt-3 text-[11px] text-slate-500">
              Covering your last {data.orderCount} order{data.orderCount === 1 ? "" : "s"} ·
              updated {new Date(data.createdAt).toLocaleString()}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400 md:text-slate-500">
            Tap Summarise and your recent purchases will be explained here.
          </p>
        )}
      </div>
    </section>
  );
}
