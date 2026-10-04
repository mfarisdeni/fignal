import { Info } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

/** Subtle, professional risk notice - no fear language, no promises. */
export function RiskNotice() {
  const { t } = useLanguage();

  return (
    <footer className="animate-enter rounded-lg border border-border bg-card/60 px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <Info
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {t("risk.title")}
          </span>{" "}
          {t("risk.body")}
        </p>
      </div>
    </footer>
  );
}
