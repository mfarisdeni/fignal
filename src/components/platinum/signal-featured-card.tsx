import { Crown } from "lucide-react";
import { ConfidenceBadge } from "./confidence-badge";
import { DirectionBadge } from "./direction-badge";
import { PriceMetric } from "./price-metric";
import { SignalReason } from "./signal-reason";
import { SignalStatusBadge } from "./signal-status-badge";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";
import { formatEntry, formatPrice, formatTimeWIB } from "@/lib/signals";
import type { TradingSignal } from "@/types/signal";

/**
 * Featured signal - the highest-confidence setup, visually elevated above
 * the rest of the feed. All core values are visible without navigation.
 */
export function SignalFeaturedCard({
  signal,
  className,
}: {
  signal: TradingSignal & { reasonId?: string | null };
  className?: string;
}) {
  const { language, t } = useLanguage();
  const buy = signal.direction === "BUY";

  return (
    <article
      aria-label={t("card.ariaFeatured", {
        pair: signal.pair,
        direction: signal.direction,
      })}
      className={cn(
        "animate-enter relative overflow-hidden rounded-lg border border-border bg-card shadow-featured",
        // hairline accent in the direction colour - subtle, not a block
        buy ? "ring-1 ring-buy/20" : "ring-1 ring-sell/20",
        className,
      )}
    >
      <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
            <Crown className="h-3 w-3" aria-hidden="true" />
            {t("card.topSetup")}
          </span>
          {signal.confidence && (
            <ConfidenceBadge confidence={signal.confidence} size="lg" />
          )}
          <h3 className="text-lg font-semibold tracking-tight">
            {signal.pair}
          </h3>
          <DirectionBadge direction={signal.direction} size="lg" />
          <div className="ml-auto">
            <SignalStatusBadge status={signal.status} />
          </div>
        </div>

        <SignalReason
          reason={signal.reason}
          reasonId={signal.reasonId}
          className="mt-3"
        />

        {/* Entry area - the single most important value */}
        <div
          className={cn(
            "mt-5 rounded-md border px-4 py-3.5",
            buy
              ? "border-buy/20 bg-buy/[0.04]"
              : "border-sell/20 bg-sell/[0.04]",
          )}
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {t("card.entryArea")}
          </div>
          <div className="font-mono-num tnum mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {formatEntry(signal)}
          </div>
        </div>

        {/* Risk & targets */}
        <dl className="mt-5 grid grid-cols-3 gap-4">
          <PriceMetric
            label={t("card.stopLoss")}
            value={signal.sl != null ? formatPrice(signal.sl, signal.pair) : "-"}
            tone="sell"
            emphasis="strong"
          />
          <PriceMetric
            label={t("card.takeProfit1")}
            value={signal.tp1 != null ? formatPrice(signal.tp1, signal.pair) : "-"}
            tone="buy"
            emphasis="strong"
          />
          <PriceMetric
            label={t("card.takeProfit2")}
            value={signal.tp2 != null ? formatPrice(signal.tp2, signal.pair) : "-"}
            emphasis="strong"
          />
        </dl>

        <p className="mt-5 text-xs text-muted-foreground tnum">
          {t("card.generated", { time: formatTimeWIB(signal.generatedAt, language) })}
        </p>
      </div>
    </article>
  );
}
