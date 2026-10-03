import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/signals";
import type { TradingSignal } from "@/types/signal";

type Status = TradingSignal["status"];

const styles: Record<Status, string> = {
  ACTIVE: "text-live border-live/30 bg-live/10",
  ENTRY_HIT: "text-info border-info/30 bg-info/10",
  UPCOMING: "text-upcoming border-upcoming/30 bg-upcoming/10",
  TP1_HIT: "text-buy border-buy/30 bg-buy/10",
  TP2_HIT: "text-buy border-buy/30 bg-buy/10",
  SL_HIT: "text-sell border-sell/30 bg-sell/10",
  EXPIRED: "text-muted-foreground border-border bg-muted/60",
  CANCELLED: "text-muted-foreground border-border bg-muted/60",
  NO_TRADE: "text-muted-foreground border-border bg-muted/60",
};

const dot: Record<Status, string> = {
  ACTIVE: "bg-live",
  ENTRY_HIT: "bg-info",
  UPCOMING: "bg-upcoming",
  TP1_HIT: "bg-buy",
  TP2_HIT: "bg-buy",
  SL_HIT: "bg-sell",
  EXPIRED: "bg-muted-foreground/50",
  CANCELLED: "bg-muted-foreground/50",
  NO_TRADE: "bg-muted-foreground/50",
};

export function SignalStatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const live = status === "ACTIVE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
        styles[status],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          dot[status],
          live && "animate-pulse-dot",
        )}
        aria-hidden="true"
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
