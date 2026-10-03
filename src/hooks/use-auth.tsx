import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Placeholder authentication state for the MVP.
 *
 * `/platinum` is a protected member route. Until the real auth provider is
 * wired in, a boolean persisted in localStorage stands in for a session.
 * `signIn()` / `signOut()` are the only integration points the gate uses.
 */

type AuthContextValue = {
  isAuthenticated: boolean;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "fignal-member-session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    try {
      setIsAuthenticated(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* private mode — stay signed out */
    }
  }, []);

  const signIn = useCallback(() => {
    setIsAuthenticated(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const signOut = useCallback(() => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
