import { Sparkles } from "lucide-react";

export function CashbackBadge({ percentage, className = "" }: { percentage?: number | null; className?: string }) {
  const value = Math.max(0, Math.min(50, Number(percentage ?? 0)));
  if (value <= 0) return null;

  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-[6px] bg-primary px-2 py-1 text-[10px] font-extrabold leading-none text-primary-foreground shadow-sm ${className}`}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      {value}% cashback
    </span>
  );
}