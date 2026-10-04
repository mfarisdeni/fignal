import { useState } from "react";
import { KeyRound, LockKeyhole } from "lucide-react";
import { LanguageToggleFloating } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { FignalMark } from "@/components/layout/top-nav";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useLanguage } from "@/hooks/use-language";

/**
 * Passcode gate for /admin. Four slots, no hints about the expected value -
 * the admin should already know it, and the route is reached by URL only so
 * it never appears in member navigation.
 */
export function AdminGate() {
  const { unlock } = useAdminAuth();
  const { t } = useLanguage();
  const [passcode, setPasscode] = useState("");
  const [rejected, setRejected] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!unlock(passcode)) {
      setRejected(true);
      setPasscode("");
      return;
    }
    setRejected(false);
  };

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
          {t("adminGate.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("adminGate.subtitle")}
        </p>

        <form onSubmit={submit} className="mt-7 flex flex-col items-center gap-3">
          <InputOTP
            maxLength={4}
            value={passcode}
            onChange={(value) => {
              setPasscode(value);
              setRejected(false);
            }}
            autoFocus
            aria-label={t("adminGate.passcode")}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3].map((index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <Button type="submit" className="w-full rounded-full">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t("adminGate.unlock")}
          </Button>
        </form>

        {rejected && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {t("adminGate.wrong")}
          </p>
        )}
      </div>
    </main>
  );
}
