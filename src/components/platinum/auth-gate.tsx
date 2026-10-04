import { ArrowRight, LockKeyhole } from "lucide-react";
import { LanguageToggleFloating } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { FignalMark } from "@/components/layout/top-nav";

/**
 * Gated state for the protected /platinum route.
 * Placeholder auth: "Sign in" flips the local session flag until the real
 * provider is connected. No payment flow in the MVP.
 */
export function AuthGate() {
  const { signIn } = useAuth();
  const { t } = useLanguage();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <LanguageToggleFloating />

      <div className="animate-enter w-full max-w-sm text-center">
        <div className="flex justify-center">
          <FignalMark />
        </div>

        <div className="mx-auto mt-8 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-card">
          <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          {t("auth.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("auth.subtitle")}
        </p>

        <div className="mt-7 flex flex-col gap-2.5">
          <Button onClick={signIn} className="rounded-full">
            {t("auth.signIn")}
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={signIn}
            aria-label={t("auth.joinAria")}
          >
            {t("auth.join")}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          {t("risk.body")}
        </p>
      </div>
    </main>
  );
}
