"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Admin gate state for /admin.
 *
 * Two ways in, because the desk should be reachable from a phone:
 *
 * 1. The `admin` custom claim on the Firebase ID token. The real control - the
 *    server mints it at seed time and Firestore Rules check it independently on
 *    every write, so this component's belief is not what actually protects data.
 * 2. The desk PIN, which you asked to keep. It is verified server-side against
 *    ADMIN_PIN by /api/admin/pin and exchanged for a signed, httpOnly cookie, so
 *    unlike the old bundle-embedded ADMIN_PASSCODE it cannot be read out of
 *    devtools.
 *
 * Both live here rather than in AdminGate so the dashboard and the gate cannot
 * disagree about whether the desk is open - that mismatch renders a blank page.
 */

type AdminAuthContextValue = {
  /** Claim or PIN session. */
  isUnlocked: boolean;
  /** True while the session is still being resolved, to avoid a false "locked". */
  ready: boolean;
  /** True when a PIN cookie is currently held. */
  pinUnlocked: boolean;
  unlockWithPin: (pin: string) => Promise<void>;
  lock: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { isAdmin, ready, signOut } = useAuth();
  const [pinUnlocked, setPinUnlocked] = useState(false);

  // Ask the server whether a PIN cookie is already live so a refresh does not
  // demand the code again.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/pin", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { unlocked?: boolean }) => {
        if (!cancelled) setPinUnlocked(Boolean(d?.unlocked));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const response = await fetch("/api/admin/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Wrong PIN.");
    }
    setPinUnlocked(true);
  }, []);

  // Closing the desk drops the PIN cookie and signs out the account, so there is
  // nothing left to walk back into.
  const lock = useCallback(() => {
    setPinUnlocked(false);
    void fetch("/api/admin/pin", { method: "DELETE" }).catch(() => undefined);
    void signOut();
  }, [signOut]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({ isUnlocked: isAdmin || pinUnlocked, ready, pinUnlocked, unlockWithPin, lock }),
    [isAdmin, pinUnlocked, ready, unlockWithPin, lock],
  );

  return (
    <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}