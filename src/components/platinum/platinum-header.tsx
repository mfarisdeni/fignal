import { formatTimeWIB, sessionLabel } from "@/lib/signals";

/**
 * Dashboard header: title, freshness, session and live-count context,
 * plus a subtle feed status indicator (UI state only).
 */
export function PlatinumHeader({
  updatedAt,
  activeCount,
}: {
  updatedAt: Date | null;
  activeCount: number;
}) {
  return (
    <div className="animate-enter flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Platinum Signals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Today&rsquo;s market setups
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="tnum">
          {updatedAt ? `Updated ${formatTimeWIB(updatedAt.toISOString())}` : "Updating…"}
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
        <span>{sessionLabel()}</span>
        <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
        <span className="tnum">
          {activeCount} active {activeCount === 1 ? "signal" : "signals"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-dot"
            aria-hidden="true"
          />
          Signal feed operational
        </span>
      </div>
    </div>
  );
}
