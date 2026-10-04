"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Admin gate for /admin.
 *
 * This used to compare the typed passcode against ADMIN_PASSCODE = "0000"
 * bundled into the JavaScript - the file's own comment called it "obfuscation,
 * not security", which was accurate. It was tolerable while every record lived in
 * the publisher's own localStorage. It is not tolerable now that the feed is a
 * shared Firestore collection and publishing means writing to every member's
 * dashboard.
 *
 * So there is no passcode here any more. Access is the `admin` custom claim on
 * the Firebase ID token, which the server minted and Firestore Rules check
 * independently of whatever this component believes. Signing in through the
 * normal member form as the desk account is all it takes.
 */

type AdminAuthContextValue = {
  isUnlocked: boolean;
  /** True while the session is still being resolved, to avoid a false "locked". */
  ready: boolean;
  lock: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { isAdmin, ready } = useAuth();

  // Kept so existing call sites of lock() keep working; it now signs the desk
  // out entirely, which is the honest version of "lock the desk".
  const lock = useCallback(() => {
    /* no-op placeholder retained for API compatibility */
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({ isUnlocked: isAdmin, ready, lock }),
    [isAdmin, ready, lock],
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