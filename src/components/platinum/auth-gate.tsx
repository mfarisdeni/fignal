"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { LanguageToggleFloating } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { FignalMark } from "@/components/layout/top-nav";
import { PaymentPanel } from "@/components/platinum/payment-panel";
import { validatePassword } from "@/lib/auth/username";

/**
 * Gated state for the protected /platinum route: sign in, register, or wait
 * for payment.
 *
 * Sign-in is native Firebase: Google, or email with a password. There is no
 * username to invent and no second form after signup - a new account lands
 * straight on payment, which is the only remaining step.
 *
 * Three states rather than one, because registration and payment are separate
 * facts. A member who has an account but has not paid is neither signed out nor
 * a member, and collapsing those two cases into a single "sign in" button is
 * what hid the missing backend in the first place.
 */

type Mode = "signIn" | "register" | "pending";

/** Google "G" mark for the sign-in button (inline SVG, no extra dependency). */
function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.8 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.2-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.8 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.2-3.9z"
      />
    </svg>
  );
}

export function AuthGate() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    authError,
    clearAuthError,
    session,
    isAuthenticated,
    configError,
  } = useAuth();
  const { t } = useLanguage();

  // A member account with no entitlement is not an error - it is the normal
  // state between "registered" and "paid", so it gets its own screen.
  const [mode, setMode] = useState<Mode>(
    isAuthenticated ? "pending" : "signIn",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const submitting = useRef(false);

  // A redirect sign-in resolves away from any form, so its failure surfaces
  // through context instead of a catch block. Show it once.
  useEffect(() => {
    if (!authError) return;
    setError(authError);
    toast.error(authError);
    clearAuthError();
  }, [authError, clearAuthError]);

  /** Runs an auth attempt with the shared busy/duplicate/error handling. */
  async function attempt(
    run: () => Promise<void>,
    done: { notice: string; toast: string },
  ) {
    // The buttons disable on `busy`, but two submits landing in the same tick
    // would both see the old state - the ref is what actually prevents a
    // duplicate account or a double popup.
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await run();
      // Pending mode is the payment step: it renders the existing PaymentPanel
      // (inline KlikQRIS checkout, never a popup) directly below this notice.
      setMode("pending");
      setNotice(done.notice);
      toast.success(done.toast);
    } catch (caught) {
      // An empty message means the user aborted (closed the Google popup) -
      // show nothing rather than an error for a deliberate cancel.
      const message = caught instanceof Error ? caught.message : "";
      if (message) {
        setError(message);
        toast.error(message);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function onGoogle() {
    void attempt(() => signInWithGoogle(), {
      notice: "Signed in with Google.",
      toast: "Signed in — complete payment to activate.",
    });
  }

  function onEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    if (mode === "register") {
      const problem = validatePassword(password);
      if (problem) {
        setError(problem);
        return;
      }
      void attempt(() => signUpWithEmail(email, password), {
        notice: "Account created. Complete payment to activate Platinum.",
        toast: "Account created — complete payment to activate.",
      });
      return;
    }

    void attempt(() => signInWithEmail(email, password), {
      notice: "Signed in.",
      toast: "Signed in — complete payment to activate.",
    });
  }

  function onReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("resetEmail") ?? "");
    setError("");
    sendPasswordReset(email)
      .then(() => {
        setShowReset(false);
        // Deliberately the same whether or not the address has an account.
        setNotice("If that address has an account, a reset link is on its way.");
      })
      .catch((caught: unknown) => {
        const message =
          caught instanceof Error ? caught.message : "Could not send the link.";
        setError(message);
      });
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <LanguageToggleFloating />

      <div className="animate-enter w-full max-w-sm text-center">
        <div className="flex justify-center">
          <FignalMark />
        </div>

        {configError && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-left"
          >
            <p className="text-xs font-semibold text-destructive">
              This deployment is not configured
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Sign-in cannot work here: {configError}. These are inlined when the
              site is built, so add them on the host and redeploy.
            </p>
          </div>
        )}

        <div className="mx-auto mt-8 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-card">
          {mode === "pending" ? (
            <Mail className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          {mode === "register"
            ? "Create your account"
            : mode === "pending"
              ? "Payment required"
              : t("auth.title")}
        </h1>

        {mode === "pending" ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You are signed in as{" "}
              <span className="font-medium text-foreground">
                {session.username ?? session.email}
              </span>
              . Your account is active; Platinum access unlocks once your payment
              is verified.
            </p>
            {notice && (
              <p className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {notice}
              </p>
            )}

            <PaymentPanel />
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {mode === "register"
                ? "One account for everything. Google or email - no username to invent."
                : t("auth.subtitle")}
            </p>

            <div className="mt-7">
              <Button
                type="button"
                variant="outline"
                onClick={onGoogle}
                disabled={busy}
                className="w-full rounded-full"
              >
                <GoogleMark />
                <span className="ml-2">Continue with Google</span>
              </Button>

              <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                or continue with email
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
            </div>

            <div
              role="tablist"
              aria-label={mode === "register" ? "Account" : "Welcome"}
              className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted p-1"
            >
              {(["signIn", "register"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab}
                  onClick={() => {
                    setMode(tab);
                    setError("");
                    setNotice("");
                    setShowReset(false);
                  }}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                    mode === tab
                      ? "bg-background text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "signIn" ? t("auth.signIn") : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={onEmailAuth} className="mt-4 space-y-3 text-left">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Password
                </span>
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={mode === "register" ? 8 : undefined}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              {error && <p className="text-xs text-destructive">{error}</p>}
              {notice && !error && (
                <p className="text-xs text-muted-foreground">{notice}</p>
              )}

              <Button type="submit" disabled={busy} className="w-full rounded-full">
                {busy
                  ? "Working..."
                  : mode === "register"
                    ? "Create account"
                    : t("auth.signIn")}
              </Button>
            </form>

            <div className="mt-4 text-left text-xs">
              {mode === "signIn" ? (
                showReset ? (
                  <form
                    onSubmit={onReset}
                    className="flex items-center gap-2"
                  >
                    <input
                      name="resetEmail"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="Email address"
                      aria-label="Email address for the reset link"
                      className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button type="submit" size="sm" className="shrink-0 rounded-full">
                      Send link
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReset(true)}
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Forgot password
                  </button>
                )
              ) : (
                <span className="text-muted-foreground">
                  Rp10.000 to activate after signup
                </span>
              )}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              {t("risk.body")}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
