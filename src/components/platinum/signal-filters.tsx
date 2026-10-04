import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
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
  const { t } = useLanguage();

  const states: { value: StatusFilter; text: string; aria: string }[] = [
    { value: "ALL", text: t("filters.all"), aria: t("filters.allAria") },
    {
      value: "ACTIVE",
      text: t("filters.active"),
      aria: t("filters.activeAria"),
    },
    {
      value: "COMPLETED",
      text: t("filters.completed"),
      aria: t("filters.completedAria"),
    },
  ];

  return (
    <div
      role="group"
      aria-label={t("filters.aria")}
      className="space-y-2 sm:space-y-0"
    >
      <div className="scroll-thin -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
        <Pill active={market === "ALL"} onClick={() => onMarketChange("ALL")}>
          {t("filters.all")}
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
          {states.map((state) => (
            <Pill
              key={state.value}
              active={status === state.value}
              onClick={() => onStatusChange(state.value)}
              label={state.aria}
            >
              {state.text}
            </Pill>
          ))}
        </div>
      </div>

      {/* Status pills get their own always-visible row on mobile */}
      <div className="flex items-center gap-2 sm:hidden">
        {states.map((state) => (
          <Pill
            key={state.value}
            active={status === state.value}
            onClick={() => onStatusChange(state.value)}
            label={state.aria}
          >
            {state.text}
          </Pill>
        ))}
      </div>
    </div>
  );
}
