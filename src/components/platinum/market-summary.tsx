import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import {
  CONFIDENCE_TEXT,
  type DaySummary,
  type PerformanceSummary,
} from "@/lib/signals";

/**
 * Today's summary - counts only. No balances, no profit figures:
 * this dashboard delivers signals, not performance marketing.
 * Win rate and average confidence are track-record figures derived from
 * closed setups, so they are not scoped to today.
 */
export function MarketSummary({
  summary,
  performance,
}: {
  summary: DaySummary;
  performance: PerformanceSummary;
}) {
  const { t } = useLanguage();

  const items: {
    label: string;
    value: string | number;
    tone?: string;
    /** Counts of zero fade back; rates and grades always stay legible. */
    muteWhenZero?: boolean;
  }[] = [
    { label: t("summary.signals"), value: summary.total, muteWhenZero: true },
    {
      label: t("summary.active"),
      value: summary.active,
      tone: "text-live",
      muteWhenZero: true,
    },
    {
      label: t("summary.tp1"),
      value: summary.tp1,
      tone: "text-buy",
      muteWhenZero: true,
    },
    {
      label: t("summary.tp2"),
      value: summary.tp2,
      tone: "text-buy",
      muteWhenZero: true,
    },
    {
      label: t("summary.sl"),
      value: summary.sl,
      tone: "text-sell",
      muteWhenZero: true,
    },
    {
      label: t("summary.winRate"),
      value:
        performance.winRate == null
          ? "-"
          : `${Math.round(performance.winRate * 100)}%`,
      tone:
        performance.winRate == null
          ? undefined
          : performance.winRate >= 0.5
            ? "text-buy"
            : "text-sell",
    },
    {
      label: t("summary.avgConfidence"),
      value: performance.avgConfidence ?? "-",
      tone: performance.avgConfidence
        ? CONFIDENCE_TEXT[performance.avgConfidence]
        : undefined,
    },
  ];

  return (
    <section aria-label={t("summary.aria")} className="animate-enter">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border bg-card px-3.5 py-3 shadow-card"
          >
            <dd
              className={cn(
                "font-mono-num tnum text-xl font-semibold leading-none",
                item.muteWhenZero && item.value === 0
                  ? "text-muted-foreground/60"
                  : item.tone,
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
