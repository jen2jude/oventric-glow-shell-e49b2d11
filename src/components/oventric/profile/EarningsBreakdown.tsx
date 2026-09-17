import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, TrendingUp, Wallet as WalletIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import {
  getMyEarningsBreakdown,
  getMyPayoutTimeline,
  type EarningsRange,
  type PayoutTimelineStatus,
} from "@/lib/earnings.functions";

interface EarningsBreakdownProps {
  isOwner: boolean;
}

const RANGE_OPTIONS: { value: EarningsRange; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All time" },
];

const STATUS_OPTIONS: { value: PayoutTimelineStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
];

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  approved: "bg-sky-400",
  paid: "bg-emerald-400",
  rejected: "bg-rose-500",
  cancelled: "bg-slate-500",
};

const STATUS_TEXT: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  rejected: "Failed",
  cancelled: "Cancelled",
};

const SOURCE_BAR: Record<string, string> = {
  marketplace: "bg-sky-500",
  affiliate: "bg-emerald-500",
  other: "bg-slate-400",
};

export function EarningsBreakdown({ isOwner }: EarningsBreakdownProps) {
  const [range, setRange] = useState<EarningsRange>("30d");
  const [status, setStatus] = useState<PayoutTimelineStatus>("ALL");

  const fetchBreakdown = useServerFn(getMyEarningsBreakdown);
  const fetchTimeline = useServerFn(getMyPayoutTimeline);

  const breakdownQuery = useQuery({
    queryKey: ["earnings-breakdown", range],
    queryFn: () => fetchBreakdown({ data: { range } }),
    enabled: isOwner,
  });

  const timelineQuery = useQuery({
    queryKey: ["earnings-payout-timeline", status],
    queryFn: () => fetchTimeline({ data: { status } }),
    enabled: isOwner,
  });

  if (!isOwner) return null;

  const homeCurrency = (breakdownQuery.data?.homeCurrency ?? "USD") as Currency;

  return (
    <Card className="bg-[#18181d] md:bg-white border-white/10 md:border-slate-200 text-slate-200 md:text-slate-700">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-base text-slate-100 md:text-slate-900">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          Earnings breakdown
        </CardTitle>
        <div className="flex items-center gap-1 rounded-[10px] bg-black/30 md:bg-slate-100 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-[10px] transition-colors",
                range === opt.value
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 md:text-slate-500 hover:text-slate-100 md:hover:text-slate-900",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {breakdownQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : breakdownQuery.isError ? (
          <ErrorState onRetry={() => breakdownQuery.refetch()} />
        ) : (
          <>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Total earned</div>
              <div className="text-3xl font-bold text-slate-100 md:text-slate-900">
                {formatMoney(breakdownQuery.data?.totalHome ?? 0, homeCurrency)}
              </div>
            </div>

            {(breakdownQuery.data?.totalHome ?? 0) <= 0 ? (
              <EmptyState label="No earnings recorded for this period yet." />
            ) : (
              <div className="space-y-3">
                {breakdownQuery.data?.breakdown.map((row) => (
                  <div key={row.source} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 md:text-slate-600">{row.label}</span>
                      <span className="font-medium text-slate-100 md:text-slate-900">
                        {formatMoney(row.amountHome, homeCurrency)}
                        <span className="ml-1.5 text-xs text-slate-500">{row.pct}%</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-black/30 md:bg-slate-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          SOURCE_BAR[row.source] ?? "bg-slate-400",
                        )}
                        style={{ width: `${Math.min(100, row.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="border-t border-white/10 md:border-slate-200 pt-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h4 className="text-sm font-semibold text-slate-200 md:text-slate-800 flex items-center gap-2">
              <WalletIcon className="h-4 w-4 text-sky-400" />
              Payout timeline
            </h4>
            <div className="flex items-center gap-1 rounded-[10px] bg-black/30 md:bg-slate-100 p-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-[10px] transition-colors",
                    status === opt.value
                      ? "bg-sky-500 text-white"
                      : "text-slate-400 md:text-slate-500 hover:text-slate-100 md:hover:text-slate-900",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {timelineQuery.isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-3 w-3 rounded-full mt-1" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : timelineQuery.isError ? (
            <ErrorState onRetry={() => timelineQuery.refetch()} />
          ) : (timelineQuery.data?.length ?? 0) === 0 ? (
            <EmptyState label="No payout requests match this filter." />
          ) : (
            <ol className="relative space-y-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-white/10 md:before:bg-slate-200">
              {timelineQuery.data?.map((item) => (
                <li key={item.id} className="relative pl-6">
                  <span
                    className={cn(
                      "absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[#18181d] md:ring-white",
                      STATUS_DOT[item.status] ?? "bg-slate-400",
                    )}
                  />
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="font-medium text-slate-100 md:text-slate-900">
                      {formatMoney(item.amount, item.currency as Currency)}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        item.status === "paid"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : item.status === "rejected"
                            ? "bg-rose-500/15 text-rose-400"
                            : item.status === "pending"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-slate-500/15 text-slate-400",
                      )}
                    >
                      {STATUS_TEXT[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 capitalize">
                    {item.method} ·{" "}
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-slate-500 py-4 text-center">{label}</p>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <AlertTriangle className="h-5 w-5 text-amber-400" />
      <p className="text-sm text-slate-400">Couldn't load this data.</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
