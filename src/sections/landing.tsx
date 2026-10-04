import { Link } from "react-router";
import { ArrowRight, Gem } from "lucide-react";
import { FignalMark } from "@/components/layout/top-nav";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

/**
 * Fignal landing page - /
 *
 * Deliberately thin for now: the product only ships the Platinum member area,
 * so the page states what Fignal is and hands over. The real landing page will
 * replace this copy without touching the subscribe hand-off to /platinum.
 */
export function Landing() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-14 w-full max-w-[1280px] items-center px-4 sm:px-6">
        <FignalMark />
        <div className="ml-auto">
          <LanguageToggle />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="animate-enter w-full max-w-md text-center">
<span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
            <Gem className="h-3 w-3" aria-hidden="true" />
            {t("nav.member")}
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("landing.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("landing.subtitle")}
          </p>

          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-gold text-background hover:bg-gold/90"
          >
            <Link to="/platinum">
              {t("landing.subscribe")}
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            {t("risk.body")}
          </p>
        </div>
      </div>
    </main>
  );
}
