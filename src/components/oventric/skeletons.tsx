import { Skeleton } from "@/components/ui/skeleton";

/* -------------------------------------------------------------------------- */
/*  Reusable dark-themed skeleton building blocks. These intentionally avoid   */
/*  gradients, blur, shadows and heavy compositor effects so they stay safe   */
/*  on low-end Android GPUs. The base Skeleton pulse is automatically frozen  */
/*  to a static block by the html.low-gpu stylesheet override.                */
/* -------------------------------------------------------------------------- */

function SkeletonIcon({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "w-11 h-11" : size === "md" ? "w-9 h-9" : "w-8 h-8";
  return <Skeleton className={`${cls} rounded-[10px] bg-white/10 md:bg-slate-100 shrink-0`} />;
}

function SkeletonText({
  width,
  height = "h-4",
  className,
}: {
  width: string;
  height?: string;
  className?: string;
}) {
  return (
    <Skeleton
      className={`${height} ${width} rounded bg-white/10 md:bg-slate-100 ${className ?? ""}`}
    />
  );
}

function SkeletonRow({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white">
      <SkeletonIcon />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonText width="w-1/2" height="h-3.5" />
        {lines > 1 && <SkeletonText width="w-3/4" height="h-3" />}
      </div>
      <SkeletonText width="w-4" height="h-4" />
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-3 flex items-center justify-between gap-3 md:block">
      <div className="flex items-center gap-2 min-w-0">
        <SkeletonIcon size="sm" />
        <SkeletonText width="w-20" height="h-3.5" />
      </div>
      <SkeletonText width="w-12" height="h-6" />
    </div>
  );
}

function SkeletonLargeCard() {
  return (
    <div className="text-left rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-5">
      <SkeletonText width="w-24" height="h-3" />
      <SkeletonText width="w-32" height="h-8" className="mt-2" />
      <SkeletonText width="w-40" height="h-3" className="mt-1" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard skeletons                                                       */
/* -------------------------------------------------------------------------- */

export function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      {/* Key cards skeleton (orders / messages / revenue / activity) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={`key-${i}`} />
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`act-${i}`} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-[10px] bg-white/10 md:bg-slate-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-white/10 md:bg-slate-200 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-white/5 md:bg-slate-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile safe overview skeleton */}
      <div className="block md:hidden pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
      </div>

      {/* Desktop overview skeleton */}
      <div className="hidden grid-cols-1 gap-3 md:grid md:grid-cols-3">
        <SkeletonLargeCard />
        <SkeletonLargeCard />
        <SkeletonLargeCard />
      </div>
      <div className="hidden grid-cols-1 gap-2 md:grid md:grid-cols-4 md:gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function WalletSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SkeletonLargeCard />
        <SkeletonLargeCard />
      </div>
      <div>
        <SkeletonText width="w-28" height="h-3" className="mb-2" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <SkeletonIcon />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonText width="w-24" height="h-3.5" />
                  <SkeletonText width="w-40" height="h-3" />
                </div>
              </div>
              <SkeletonText width="w-16" height="h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SocialSkeleton() {
  return (
    <div>
      <div className="inline-flex rounded-[10px] bg-[#141418] md:bg-white border border-white/10 md:border-slate-200 p-1 mb-4 gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="w-24 h-9 rounded-[10px] bg-white/10 md:bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-3 flex items-center gap-3"
          >
            <Skeleton className="w-10 h-10 rounded-full bg-white/10 md:bg-slate-100 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonText width="w-1/2" height="h-3.5" />
              <SkeletonText width="w-1/3" height="h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListingsSkeleton() {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="w-20 h-8 rounded-full bg-white/10 md:bg-slate-100" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-3 flex gap-3"
          >
            <Skeleton className="shrink-0 w-20 h-20 rounded-[10px] bg-white/10 md:bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonText width="w-24" height="h-3" />
              <SkeletonText width="w-3/4" height="h-4" />
              <SkeletonText width="w-1/2" height="h-3" />
              <div className="pt-1 flex gap-2">
                <Skeleton className="w-20 h-7 rounded-[10px] bg-white/10 md:bg-slate-100" />
                <Skeleton className="w-20 h-7 rounded-[10px] bg-white/10 md:bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DigitalSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-3 flex gap-3"
        >
          <Skeleton className="shrink-0 w-20 h-20 rounded-[10px] bg-white/10 md:bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonText width="w-16" height="h-3" />
                <SkeletonText width="w-3/4" height="h-4" />
                <SkeletonText width="w-1/3" height="h-3" />
              </div>
              <Skeleton className="w-14 h-5 rounded-full bg-white/10 md:bg-slate-100 shrink-0" />
            </div>
            <div className="pt-1 flex gap-2">
              <Skeleton className="w-20 h-7 rounded-[10px] bg-white/10 md:bg-slate-100" />
              <Skeleton className="w-24 h-7 rounded-[10px] bg-white/10 md:bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PhotoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-[10px] bg-white/10 md:bg-slate-100" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ads Manager skeletons                                                     */
/* -------------------------------------------------------------------------- */

export function AdsManagerSkeleton() {
  return (
    <div className="min-h-screen bg-[#0b0b0d] md:bg-slate-50 text-slate-200 md:text-slate-700">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <SkeletonText width="w-32" height="h-4" className="mb-6" />
        <div className="mb-6 flex items-start gap-3">
          <SkeletonIcon size="lg" />
          <div className="space-y-2">
            <SkeletonText width="w-40" height="h-8" />
            <SkeletonText width="w-56" height="h-3.5" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SkeletonText width="w-32" height="h-4" />
                    <Skeleton className="w-14 h-5 rounded-full bg-white/10 md:bg-slate-100" />
                    <Skeleton className="w-20 h-4 rounded bg-white/10 md:bg-slate-100" />
                  </div>
                  <SkeletonText width="w-3/4" height="h-3" />
                </div>
                <SkeletonText width="w-4" height="h-4" />
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 rounded-[10px] bg-white/10 md:bg-slate-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CampaignDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#0b0b0d] md:bg-slate-50 text-slate-200 md:text-slate-700 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <SkeletonText width="w-32" height="h-4" />
        <div className="space-y-2">
          <SkeletonText width="w-56" height="h-8" />
          <SkeletonText width="w-3/4" height="h-3.5" />
          <SkeletonText width="w-32" height="h-3" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-3"
            >
              <SkeletonText width="w-16" height="h-3" />
              <SkeletonText width="w-20" height="h-6" className="mt-1" />
              <SkeletonText width="w-12" height="h-3" className="mt-0.5" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-4 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="space-y-2">
              <SkeletonText width="w-24" height="h-3" />
              <SkeletonText width="w-32" height="h-6" />
            </div>
            <div className="space-y-2 text-right">
              <SkeletonText width="w-24" height="h-3" />
              <SkeletonText width="w-24" height="h-6" />
            </div>
          </div>
          <Skeleton className="h-2 rounded-full bg-white/10 md:bg-slate-100 mt-3" />
          <div className="flex justify-between">
            <SkeletonText width="w-20" height="h-3" />
            <SkeletonText width="w-8" height="h-3" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-4 space-y-3">
            <SkeletonText width="w-24" height="h-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                <SkeletonText width="w-20" height="h-3" />
                <SkeletonText width="w-full" height="h-3.5" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-4 space-y-3">
            <SkeletonText width="w-32" height="h-4" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                <SkeletonText width="w-24" height="h-3" />
                <SkeletonText width="w-full" height="h-3.5" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white p-4 space-y-3">
          <SkeletonText width="w-28" height="h-4" />
          <Skeleton className="h-40 rounded-[10px] bg-white/10 md:bg-slate-100" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-[10px] bg-white/10 md:bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
