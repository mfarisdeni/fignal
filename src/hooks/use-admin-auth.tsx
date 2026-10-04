import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * Admin gate for /admin.
 *
 * Placeholder, exactly like the member session in `use-auth.tsx`: the passcode
 * ships as a client-side constant so the route is not left wide open while the
 * real auth provider is still pending. It is obfuscation, not security — a real
 * deployment must verify the passcode server-side before any record is read.
 */

const ADMIN_PASSCODE = "0000";
const STORAGE_KEY = "fignal-admin-session";

type AdminAuthContextValue = {
  isUnlocked: boolean;
  /** Returns whether the passcode was accepted, so the gate can show an error. */
  unlock: (passcode: string) => boolean;
  lock: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  // localStorage is synchronous, so the session can be read during the first
  // render instead of in an effect — no flash of the gate on a reload.
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      /* private mode — stay locked */
      return false;
    }
  });

  const unlock = useCallback((passcode: string) => {
    if (passcode !== ADMIN_PASSCODE) return false;
    setIsUnlocked(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    return true;
  }, []);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isUnlocked, unlock, lock }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
