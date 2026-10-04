import { Clock } from "lucide-react";
import { formatTimeWIB, sessionLabel } from "@/lib/signals";
import { useLanguage } from "@/hooks/use-language";

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
  const { language, t } = useLanguage();

  return (
    <div className="animate-enter flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t("header.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("header.subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
<span className="tnum">
          {updatedAt
            ? t("header.updated", {
                time: formatTimeWIB(updatedAt.toISOString(), language),
              })
            : t("header.updating")}
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 font-medium text-gold"
          title={t("header.sessionTitle")}
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          {sessionLabel(language)}
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
        <span className="tnum">
          {activeCount === 1
            ? t("header.activeOne")
            : t("header.activeMany", { n: activeCount })}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-dot"
            aria-hidden="true"
          />
          {t("header.feedLive")}
        </span>
      </div>
    </div>
  );
}
