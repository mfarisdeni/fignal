import { ArrowDownRight, ArrowUpRight, CircleSlash } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";
import type { SignalDirection } from "@/types/signal";

/**
 * BUY / SELL semantic badge, plus a neutral state for prompts that never
 * stated a side - a WAIT with no direction is not a sell, so it must not
 * borrow the sell arrow and colour.
 * The label + icon carry the meaning; colour is only reinforcement
 * (accessibility).
 */
export function DirectionBadge({
  direction,
  size = "md",
  className,
}: {
  direction: SignalDirection | "NO_TRADE";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useLanguage();
  const flat = direction === "NO_TRADE";
  const buy = direction === "BUY";
  const Icon = flat ? CircleSlash : buy ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-semibold uppercase tracking-wide leading-none",
        flat
          ? "border-border bg-muted/40 text-muted-foreground"
          : buy
            ? "border-buy/30 bg-buy/10 text-buy"
            : "border-sell/30 bg-sell/10 text-sell",
        size === "sm" && "px-1.5 py-1 text-[10px]",
        size === "md" && "px-2 py-1 text-[11px]",
        size === "lg" && "px-2.5 py-1.5 text-xs",
        className,
      )}
    >
      <Icon
        className={cn(size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3")}
        aria-hidden="true"
      />
      {flat ? t("direction.noSide") : direction}
    </span>
  );
}
