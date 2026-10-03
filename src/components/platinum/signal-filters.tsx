import { cn } from "@/lib/utils";
import type { StatusFilter } from "@/lib/signals";
import { MARKETS, type Market } from "@/types/signal";

function Pill({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150",
        active
          ? "border-foreground/80 bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Lightweight filter bar: market pills + state pills.
 * Horizontally scrollable on mobile, no dropdowns.
 */
export function SignalFilters({
  market,
  status,
  onMarketChange,
  onStatusChange,
}: {
  market: Market | "ALL";
  status: StatusFilter;
  onMarketChange: (m: Market | "ALL") => void;
  onStatusChange: (s: StatusFilter) => void;
}) {
  return (
    <div role="group" aria-label="Signal filters" className="space-y-2 sm:space-y-0">
      <div className="scroll-thin -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
        <Pill active={market === "ALL"} onClick={() => onMarketChange("ALL")}>
          All
        </Pill>
        {MARKETS.map((m) => (
          <Pill key={m} active={market === m} onClick={() => onMarketChange(m)}>
            {m}
          </Pill>
        ))}

        <span
          className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block"
          aria-hidden="true"
        />

        <div className="hidden items-center gap-2 sm:flex">
          {(
            [
              ["ALL", "All"],
              ["ACTIVE", "Active"],
              ["COMPLETED", "Completed"],
            ] as const
          ).map(([value, text]) => (
            <Pill
              key={value}
              active={status === value}
              onClick={() => onStatusChange(value)}
              label={`${text} signals`}
            >
              {text}
            </Pill>
          ))}
        </div>
      </div>

      {/* Status pills get their own always-visible row on mobile */}
      <div className="flex items-center gap-2 sm:hidden">
        {(
          [
            ["ALL", "All"],
            ["ACTIVE", "Active"],
            ["COMPLETED", "Completed"],
          ] as const
        ).map(([value, text]) => (
          <Pill
            key={value}
            active={status === value}
            onClick={() => onStatusChange(value)}
            label={`${text} signals`}
          >
            {text}
          </Pill>
        ))}
      </div>
    </div>
  );
}
