import { cn } from "@/lib/utils";

/**
 * A single labelled price value. Numbers use tabular lining figures so
 * columns of prices align and stay readable at a glance.
 */
export function PriceMetric({
  label,
  value,
  emphasis = "normal",
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  /** "strong" = visually prominent (entry area, TP1) */
  emphasis?: "normal" | "strong";
  tone?: "neutral" | "buy" | "sell";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono-num tnum mt-0.5 whitespace-nowrap text-[13px] sm:text-sm",
          emphasis === "strong"
            ? "text-base font-semibold"
            : "text-sm font-medium",
          tone === "buy" && "text-buy",
          tone === "sell" && "text-sell",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
