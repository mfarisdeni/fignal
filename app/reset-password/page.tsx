"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { checkActionCode, confirmPasswordReset } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { FignalMark } from "@/components/layout/top-nav";

/**
 * /reset-password - landing target for the link in the reset email.
 *
 * Firebase sends the user here with the one-time action code in the URL hash;
 * we exchange it for a real session, then let them set a new password. The code
 * is single use and short lived, so the page checks it on arrival and says so
 * rather than failing at submit time with a generic error.
 */

type Phase = "checking" | "ready" | "submitting" | "done" | "invalid";

export default function ResetPassword() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const oobCode = params.get("oobCode") ?? new URLSearchParams(window.location.search).get("oobCode") ?? "";
        if (!oobCode) {
          if (!cancelled) setPhase("invalid");
          return;
        }
        await checkActionCode(firebaseAuth(), oobCode);
        if (!cancelled) {
          setCode(oobCode);
          setPhase("ready");
        }
      } catch {
        if (!cancelled) setPhase("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setError("");
    setPhase("submitting");
    try {
      await confirmPasswordReset(firebaseAuth(), code, password);
      setPhase("done");
    } catch {
      setError("That link has expired or already been used. Request a new one.");
      setPhase("ready");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-16">
      <Link href="/" className="mb-8" aria-label="Fignal home">
        <FignalMark />
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-7 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">Set a new password</h1>

        {phase === "checking" && (
          <p className="mt-3 text-sm text-muted-foreground">Checking your link...</p>
        )}

        {phase === "invalid" && (
          <div className="mt-3 space-y-4 text-sm">
            <p className="text-muted-foreground">
              This reset link is missing, expired, or already used. Reset links last
              60 minutes and work once.
            </p>
            <Link href="/platinum" className="text-primary underline underline-offset-4">
              Request a new link
            </Link>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-3 space-y-4 text-sm">
            <p className="text-muted-foreground">
              Password updated. You are signed in on this device.
            </p>
            <Link href="/platinum" className="text-primary underline underline-offset-4">
              Go to the dashboard
            </Link>
          </div>
        )}

        {(phase === "ready" || phase === "submitting") && (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                New password
              </span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Confirm password
              </span>
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={phase === "submitting"}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {phase === "submitting" ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}