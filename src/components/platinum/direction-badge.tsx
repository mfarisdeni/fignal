import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignalDirection } from "@/types/signal";

/**
 * BUY / SELL semantic badge. The label + icon carry the meaning;
 * colour is only reinforcement (accessibility).
 */
export function DirectionBadge({
  direction,
  size = "md",
  className,
}: {
  direction: SignalDirection;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const buy = direction === "BUY";
  const Icon = buy ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-semibold uppercase tracking-wide leading-none",
        buy
          ? "border-buy/30 bg-buy/10 text-buy"
          : "border-sell/30 bg-sell/10 text-sell",
        size === "sm" && "px-1.5 py-1 text-[10px]",
        size === "md" && "px-2 py-1 text-[11px]",
        size === "lg" && "px-2.5 py-1.5 text-xs",
        className,
      )}
    >
      <Icon
        className={cn(
          size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3",
        )}
        aria-hidden="true"
      />
      {direction}
    </span>
  );
}
