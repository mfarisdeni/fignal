import { ConfidenceBadge } from "./confidence-badge";
import { useLanguage } from "@/hooks/use-language";
import { CONFIDENCE_ORDER } from "@/types/signal";

/**
 * Compact confidence legend. Fixed order A+ > A > B+ > B.
 * Letter grades only - never percentages or scores.
 */
export function ConfidenceLegend() {
  const { t } = useLanguage();

  return (
    <section
      aria-label={t("legend.aria")}
      className="animate-enter rounded-lg border border-border bg-card px-4 py-3 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("legend.label")}
        </span>
        {CONFIDENCE_ORDER.map((c) => (
          <div key={c} className="flex items-center gap-2">
            <ConfidenceBadge confidence={c} size="sm" />
            {/* The wording is long in both languages, so it earns its place only
                once there is room for it. */}
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t(`conf.${c}`)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
