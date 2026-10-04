"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { LanguageToggleFloating } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { FignalMark } from "@/components/layout/top-nav";
import { PaymentPanel } from "@/components/platinum/payment-panel";
import { validatePassword, validateUsername } from "@/lib/auth/username";

/**
 * Gated state for the protected /platinum route: sign in, register, or wait
 * for payment.
 *
 * Three states rather than one, because registration and payment are separate
 * facts. A member who has an account but has not paid is neither signed out nor
 * a member, and collapsing those two cases into a single "sign in" button is
 * what hid the missing backend in the first place.
 */

type Mode = "signIn" | "register" | "pending";

export function AuthGate() {
  const { signIn, session, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  // A member account with no entitlement is not an error - it is the normal
  // state between "registered" and "paid", so it gets its own screen.
  const [mode, setMode] = useState<Mode>(
    isAuthenticated ? "pending" : "signIn",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await signIn(String(data.get("username") ?? ""), String(data.get("password") ?? ""));
      setMode("pending");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    const email = String(data.get("email") ?? "");

    const problem = validateUsername(username) ?? validatePassword(password);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { error: string }
        | null;

      if (!response.ok || !payload || !("ok" in payload)) {
        throw new Error(
          payload && "error" in payload ? payload.error : "Could not create the account.",
        );
      }

      // Signed in straight away: the account exists and the member should not be
      // made to type the same password twice to reach the payment screen.
      await signIn(username, password);
      setMode("pending");
      setNotice("Account created. Check your email to confirm the address.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not register.");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    const email = window.prompt("Email address for the reset link:");
    if (!email) return;
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // The endpoint answers the same way whether or not the address exists.
    setNotice(
      response.ok
        ? "If that address has an account, a reset link is on its way."
        : "Enter a valid email address.",
    );
    setError("");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <LanguageToggleFloating />

      <div className="animate-enter w-full max-w-sm text-center">
        <div className="flex justify-center">
          <FignalMark />
        </div>

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
                ? "Pick a username and a password. Your email is used for the reset link if you forget it."
                : t("auth.subtitle")}
            </p>

            <div
              role="tablist"
              aria-label={mode === "register" ? "Account" : "Welcome"}
              className="mt-7 grid grid-cols-2 gap-1 rounded-full border border-border bg-muted p-1"
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

            <form
              onSubmit={mode === "register" ? onRegister : onSignIn}
              className="mt-4 space-y-3 text-left"
            >
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Username
                </span>
                <input
                  name="username"
                  autoComplete="username"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              {mode === "register" && (
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
              )}

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
                  minLength={8}
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

            <div className="mt-4 flex items-center justify-between text-xs">
              {mode === "signIn" ? (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Forgot password
                </button>
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