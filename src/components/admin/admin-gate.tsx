"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, LockKeyhole } from "lucide-react";
import { LanguageToggleFloating } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { FignalMark } from "@/components/layout/top-nav";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useAuth } from "@/hooks/use-auth";

/**
 * Gate for /admin. Two doors, because the desk should be reachable from a phone.
 *
 * 1. Desk account - the Firebase `admin` custom claim. The real control, and
 *    re-checked independently by Firestore Rules on every write.
 * 2. The PIN - kept because it is genuinely convenient, but it is no longer a
 *    constant in this bundle. It is compared against ADMIN_PIN on the server by
 *    /api/admin/pin and exchanged for a signed, httpOnly cookie. Reading the PIN
 *    out of devtools no longer works, and neither does guessing it from here.
 *
 * A PIN unlock is weaker than the claim by design: the PIN is a shared convenience
 * for the owner, not a second factor. Treat one as "the owner handed the phone
 * over on purpose", and rotate the PIN if that stops being true.
 */

export function AdminGate() {
  const { isUnlocked, ready, unlockWithPin } = useAdminAuth();
  const { signIn, isAuthenticated, refreshClaims, signOut, session } = useAuth();

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"account" | "pin">("account");

  // A claim is granted server side, so a tab that was open before the seed ran
  // would otherwise keep showing the gate with a stale token for up to an hour.
  useEffect(() => {
    if (isAuthenticated && !isUnlocked) void refreshClaims();
  }, [isAuthenticated, isUnlocked, refreshClaims]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const kind = String(data.get("mode") ?? "account");

      setBusy(true);
      setError("");
      try {
        if (kind === "pin") {
          await unlockWithPin(String(data.get("pin") ?? ""));
          return;
        }

        await signIn(String(data.get("username") ?? ""), String(data.get("password") ?? ""));
        await refreshClaims();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not sign in.");
      } finally {
        setBusy(false);
      }
    },
    [refreshClaims, signIn, unlockWithPin],
  );

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </main>
    );
  }

  if (isUnlocked) return null;

  // Already a member, just not the desk - say so instead of offering a form that
  // cannot succeed. The PIN is still offered, since the desk may be unlocking on
  // the member's own session.
  if (isAuthenticated && !isUnlocked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <FignalMark />
        <h1 className="mt-6 text-lg font-semibold tracking-tight">Desk access only</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          You are signed in as {session.username ?? session.email}, which is not the admin
          account.
        </p>
        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" className="rounded-full" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Link
            href="/platinum"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

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

        <h1 className="mt-5 text-xl font-semibold tracking-tight">Desk sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Use the desk account, or the PIN if you are on your own.
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-3 text-left">
          <input type="hidden" name="mode" value={mode} />

          {mode === "account" ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Username</span>
                <input
                  name="username"
                  autoComplete="username"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">PIN</span>
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={12}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full rounded-full">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "Checking..." : mode === "account" ? "Sign in" : "Unlock"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "account" ? "pin" : "account");
              setError("");
            }}
            className="w-full text-center text-xs text-muted-foreground underline underline-offset-4"
          >
            {mode === "account" ? "Use the PIN instead" : "Use the desk account"}
          </button>
        </form>
      </div>
    </main>
  );
}