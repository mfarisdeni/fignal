import { ConfidenceBadge } from "./confidence-badge";
import { DirectionBadge } from "./direction-badge";
import { PriceMetric } from "./price-metric";
import { SignalReason } from "./signal-reason";
import { SignalStatusBadge } from "./signal-status-badge";
import { useLanguage } from "@/hooks/use-language";
import { formatEntry, formatPrice, formatTimeWIB } from "@/lib/signals";
import type { TradingSignal } from "@/types/signal";

/**
 * Standard signal card. Scannable in seconds: confidence + pair + direction
 * up top, four metric columns (Entry / SL / TP1 / TP2), status and time.
 * Stacks intelligently on mobile.
 */
export function SignalCard({
  signal,
  index = 0,
}: {
  signal: TradingSignal & { reasonId?: string | null };
  index?: number;
}) {
  const { language, t } = useLanguage();
  const buy = signal.direction === "BUY";

  return (
    <article
      aria-label={t("card.ariaSignal", {
        pair: signal.pair,
        direction: signal.direction,
        status: t(`status.${signal.status}`),
      })}
      className="animate-enter group rounded-lg border border-border bg-card shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          {signal.confidence && (
            <ConfidenceBadge confidence={signal.confidence} />
          )}
          <h3 className="text-[15px] font-semibold tracking-tight">
            {signal.pair}
          </h3>
          <DirectionBadge direction={signal.direction} />
          <div className="ml-auto">
            <SignalStatusBadge status={signal.status} />
          </div>
        </div>

        <SignalReason
          reason={signal.reason}
          reasonId={signal.reasonId}
          className="mt-2.5"
        />

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <PriceMetric
            label={t("card.entry")}
            value={formatEntry(signal)}
            emphasis="strong"
            className={buy ? "border-l-2 border-buy/40 pl-2.5" : "border-l-2 border-sell/40 pl-2.5"}
          />
          <PriceMetric
            label={t("card.stopLoss")}
            value={signal.sl != null ? formatPrice(signal.sl, signal.pair) : "-"}
            tone="sell"
          />
          <PriceMetric
            label="TP1"
            value={signal.tp1 != null ? formatPrice(signal.tp1, signal.pair) : "-"}
            tone="buy"
            emphasis="strong"
          />
          <PriceMetric
            label="TP2"
            value={signal.tp2 != null ? formatPrice(signal.tp2, signal.pair) : "-"}
          />
        </dl>

        <p className="mt-4 text-xs text-muted-foreground tnum">
          {t("card.generated", { time: formatTimeWIB(signal.generatedAt, language) })}
        </p>
      </div>
    </article>
  );
}
