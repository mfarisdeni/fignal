import { cn } from "@/lib/utils";
import type { DaySummary } from "@/lib/signals";

/**
 * Today's summary — counts only. No balances, no profit figures:
 * this dashboard delivers signals, not performance marketing.
 */
export function MarketSummary({ summary }: { summary: DaySummary }) {
  const items: { label: string; value: number; tone?: string }[] = [
    { label: "Signals today", value: summary.total },
    { label: "Active", value: summary.active, tone: "text-live" },
    { label: "TP1 hit", value: summary.tp1, tone: "text-buy" },
    { label: "TP2 hit", value: summary.tp2, tone: "text-buy" },
    { label: "SL hit", value: summary.sl, tone: "text-sell" },
  ];

  return (
    <section aria-label="Today's summary" className="animate-enter">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border bg-card px-3.5 py-3 shadow-card"
          >
            <dd
              className={cn(
                "font-mono-num tnum text-xl font-semibold leading-none",
                item.value > 0 ? item.tone : "text-muted-foreground/60",
              )}
            >
              {item.value}
            </dd>
            <dt className="mt-1.5 text-[11px] font-medium text-muted-foreground">
              {item.label}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
