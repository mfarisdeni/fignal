import { useLanguage } from "@/hooks/use-language";
import { Flag } from "@/components/layout/flag";
import { LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Flag-only language switcher.
 *
 * Both flags stay visible with the active one lifted, so the control explains
 * itself without a word on it - you can see there are two choices and which one
 * you are on. Clicking the active flag is a no-op rather than a toggle to the
 * other language, because "toggle" reads as "flip me" and a two-state flag
 * switch is clearer than a single button that changes meaning.
 *
 * The full language name stays in aria-label and title, so the flags are never
 * the only thing a screen reader or a hover has to go on.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-card/70 p-0.5 backdrop-blur-md",
        className,
      )}
    >
      {LANGUAGES.map((option) => {
        const active = option.code === language;
        return (
          <button
            key={option.code}
            type="button"
            lang={option.code}
            onClick={() => setLanguage(option.code)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            className={cn(
              "flex h-8 w-9 items-center justify-center rounded-full transition-all duration-150",
              active
                ? "bg-foreground/10 shadow-card ring-1 ring-border"
                : "opacity-55 hover:bg-muted/60 hover:opacity-100",
            )}
          >
            <Flag language={option.code} className="h-[15px] w-[26px]" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Same control, pinned to a screen corner for the centred gate screens, where
 * there is no navigation bar to sit in.
 */
export function LanguageToggleFloating({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("fixed right-4 top-4 z-20 sm:right-6 sm:top-6", className)}>
      <LanguageToggle />
    </div>
  );
}
