import { MoonStar } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";
import type { TradingSignal } from "@/types/signal";

/**
 * Elegant NO TRADE state - the product never implies that every market
 * always has a setup. Used for a pair with no valid structure, and as the
 * generic empty feed state.
 */
export function NoTradeState({
  pair,
  note,
  compact = false,
  className,
}: {
  pair?: TradingSignal["pair"];
  note?: string;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <div
      role="status"
      className={cn(
        "animate-enter rounded-lg border border-dashed border-border bg-card/50 text-center",
        compact ? "px-5 py-6" : "px-6 py-12",
        className,
      )}
    >
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <MoonStar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-medium">
        {pair ? t("empty.noSetup", { pair }) : t("empty.noSetupGeneric")}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {note ?? t("empty.waiting")}
      </p>
    </div>
  );
}
