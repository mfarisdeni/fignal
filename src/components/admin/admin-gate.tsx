"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, LockKeyhole } from "lucide-react";
import { LanguageToggleFloating } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { FignalMark } from "@/components/layout/top-nav";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useAuth } from "@/hooks/use-auth";

/**
 * Gate for /admin.
 *
 * There is no passcode here any more. The four-slot form is gone because it
 * compared what you typed against ADMIN_PASSCODE, a constant shipped in the
 * JavaScript bundle - readable by anyone who opened devtools, and the only thing
 * between a stranger and the publish button once the feed became a shared
 * Firestore collection.
 *
 * Access is now the `admin` custom claim on the Firebase ID token: minted by the
 * server at seed time, checked by this component, and checked independently by
 * Firestore Rules on the actual write. The desk signs in with its own account,
 * which is why it can reach this route without a Platinum membership.
 */

export function AdminGate() {
  const { isUnlocked, ready } = useAdminAuth();
  const { signIn, isAuthenticated, refreshClaims, signOut, session } = useAuth();

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // A claim is granted server side, so a tab that was open before the seed ran
  // would otherwise keep showing the gate with a stale token for up to an hour.
  useEffect(() => {
    if (isAuthenticated && !isUnlocked) void refreshClaims();
  }, [isAuthenticated, isUnlocked, refreshClaims]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await signIn(String(data.get("username") ?? ""), String(data.get("password") ?? ""));
      await refreshClaims();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </main>
    );
  }

  // Already a member, just not the desk - say so instead of offering a form that
  // cannot succeed.
  if (isAuthenticated && !isUnlocked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <FignalMark />
        <h1 className="mt-6 text-lg font-semibold tracking-tight">
          Desk access only
        </h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          You are signed in as {session.username ?? session.email}, which is not the
          admin account.
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
          Sign in with the desk account to publish signals.
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-3 text-left">
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

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full rounded-full">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}