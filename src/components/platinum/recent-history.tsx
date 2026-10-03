import { ConfidenceBadge } from "./confidence-badge";
import { DirectionBadge } from "./direction-badge";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/signals";
import type { HistoricalSignal } from "@/types/signal";

const RESULT_LABEL: Record<HistoricalSignal["result"], string> = {
  TP1_HIT: "TP1 hit",
  TP2_HIT: "TP2 hit",
  SL_HIT: "SL hit",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const RESULT_TONE: Record<HistoricalSignal["result"], string> = {
  TP1_HIT: "text-buy border-buy/30 bg-buy/10",
  TP2_HIT: "text-buy border-buy/30 bg-buy/10",
  SL_HIT: "text-sell border-sell/30 bg-sell/10",
  EXPIRED: "text-muted-foreground border-border bg-muted/60",
  CANCELLED: "text-muted-foreground border-border bg-muted/60",
};

/** Compact list of recently completed signals. */
export function RecentHistory({
  history,
  limit,
}: {
  history: HistoricalSignal[];
  limit?: number;
}) {
  const rows = limit ? history.slice(0, limit) : history;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card/50 px-5 py-8 text-center text-sm text-muted-foreground">
        No completed signals yet. Results appear here as setups close.
      </p>
    );
  }

  return (
    <ul className="animate-enter divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-card">
      {rows.map((h) => (
        <li
          key={h.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors duration-150 hover:bg-muted/40"
        >
          <ConfidenceBadge confidence={h.confidence} size="sm" />
          <span className="text-sm font-semibold tracking-tight">{h.pair}</span>
          <DirectionBadge direction={h.direction} size="sm" />
          <span
            className={cn(
              "ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
              RESULT_TONE[h.result],
            )}
          >
            {RESULT_LABEL[h.result]}
          </span>
          <span className="tnum text-xs text-muted-foreground">
            {formatDateShort(h.closedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
