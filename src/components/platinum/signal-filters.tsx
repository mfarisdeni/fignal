import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import type { Market } from "@/types/signal";

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
 * Market filter pills. Horizontally scrollable on mobile, no dropdowns.
 *
 * Markets only: lifecycle (upcoming / results / history) is the dashboard's
 * section structure now, not a second filter row. `markets` is what the feed
 * currently holds, not the full registry: only pairs with something behind
 * them earn a pill.
 */
export function SignalFilters({
  markets,
  market,
  onMarketChange,
}: {
  markets: Market[];
  market: Market | "ALL";
  onMarketChange: (m: Market | "ALL") => void;
}) {
  const { t } = useLanguage();

  // Nothing published yet: an "All" filter would offer no choice, so the row
  // stays out entirely.
  if (markets.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("filters.aria")}
      className="scroll-thin -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      <Pill active={market === "ALL"} onClick={() => onMarketChange("ALL")}>
        {t("filters.all")}
      </Pill>
      {markets.map((m) => (
        <Pill key={m} active={market === m} onClick={() => onMarketChange(m)}>
          {m}
        </Pill>
      ))}
    </div>
  );
}
