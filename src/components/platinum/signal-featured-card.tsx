import { ConfidenceBadge } from "./confidence-badge";
import { DirectionBadge } from "./direction-badge";
import { PriceMetric } from "./price-metric";
import { SignalStatusBadge } from "./signal-status-badge";
import { cn } from "@/lib/utils";
import { formatEntry, formatPrice, formatTimeWIB } from "@/lib/signals";
import type { TradingSignal } from "@/types/signal";

/**
 * Featured signal — the highest-confidence setup, visually elevated above
 * the rest of the feed. All core values are visible without navigation.
 */
export function SignalFeaturedCard({
  signal,
  className,
}: {
  signal: TradingSignal;
  className?: string;
}) {
  const buy = signal.direction === "BUY";
  return (
    <article
      aria-label={`Featured signal: ${signal.pair} ${signal.direction}`}
      className={cn(
        "animate-enter relative overflow-hidden rounded-lg border border-border bg-card shadow-featured",
        // hairline accent in the direction colour — subtle, not a block
        buy ? "ring-1 ring-buy/20" : "ring-1 ring-sell/20",
        className,
      )}
    >
      <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Top setup
          </span>
          {signal.confidence && (
            <ConfidenceBadge confidence={signal.confidence} size="lg" />
          )}
          <h3 className="text-lg font-semibold tracking-tight">
            {signal.pair}
          </h3>
          <DirectionBadge
            direction={signal.direction as "BUY" | "SELL"}
            size="lg"
          />
          <div className="ml-auto">
            <SignalStatusBadge status={signal.status} />
          </div>
        </div>

        {/* Entry area — the single most important value */}
        <div
          className={cn(
            "mt-5 rounded-md border px-4 py-3.5",
            buy
              ? "border-buy/20 bg-buy/[0.04]"
              : "border-sell/20 bg-sell/[0.04]",
          )}
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Entry area
          </div>
          <div className="font-mono-num tnum mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {formatEntry(signal)}
          </div>
        </div>

        {/* Risk & targets */}
        <dl className="mt-5 grid grid-cols-3 gap-4">
          <PriceMetric
            label="Stop loss"
            value={signal.sl != null ? formatPrice(signal.sl, signal.pair) : "—"}
            tone="sell"
            emphasis="strong"
          />
          <PriceMetric
            label="Take profit 1"
            value={signal.tp1 != null ? formatPrice(signal.tp1, signal.pair) : "—"}
            tone="buy"
            emphasis="strong"
          />
          <PriceMetric
            label="Take profit 2"
            value={signal.tp2 != null ? formatPrice(signal.tp2, signal.pair) : "—"}
            emphasis="strong"
          />
        </dl>

        <p className="mt-5 text-xs text-muted-foreground tnum">
          Generated {formatTimeWIB(signal.generatedAt)}
        </p>
      </div>
    </article>
  );
}
