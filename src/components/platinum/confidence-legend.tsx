import { ConfidenceBadge } from "./confidence-badge";
import { CONFIDENCE_DESCRIPTION } from "@/lib/signals";
import { CONFIDENCE_ORDER } from "@/types/signal";

/**
 * Compact confidence legend. Fixed order A+ → A → B+ → B → C.
 * Letter grades only — never percentages or scores.
 */
export function ConfidenceLegend() {
  return (
    <section
      aria-label="Confidence legend"
      className="animate-enter rounded-lg border border-border bg-card px-4 py-3 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Confidence
        </span>
        {CONFIDENCE_ORDER.map((c) => (
          <div key={c} className="flex items-center gap-2">
            <ConfidenceBadge confidence={c} size="sm" />
            <span className="hidden text-xs text-muted-foreground md:inline">
              {CONFIDENCE_DESCRIPTION[c]}
            </span>
            <span className="text-xs text-muted-foreground md:hidden">
              {CONFIDENCE_DESCRIPTION[c].replace(" confidence", "")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
