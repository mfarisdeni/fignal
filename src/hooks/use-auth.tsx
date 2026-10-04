import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getIdToken,
  getIdTokenResult,
  onIdTokenChanged,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import type { SessionFacts } from "@/lib/auth/session";

/**
 * Member session, backed by Firebase Auth.
 *
 * Replaces the localStorage boolean this file used to hold. That value was set
 * by a click and cleared by a click, so it proved nothing - anyone could set
 * `fignal-member-session = "1"` in devtools and be through the gate. What the
 * app holds now is an ID token the server minted and can verify, and the
 * membership flag on it comes from a Firestore record the client cannot write.
 *
 * `onIdTokenChanged` rather than `onAuthStateChanged` on purpose: Firebase
 * refreshes ID tokens hourly, and the admin claim or a membership change only
 * lands in the session when the token rotates. Listening to the token means the
 * gate re-checks on refresh instead of trusting a stale snapshot for the life of
 * the tab.
 */

export type Session = SessionFacts & { user: User | null };

type AuthContextValue = {
  /** Signed in at all - a member or the desk. */
  isAuthenticated: boolean;
  /** Signed in and past the payment gate, or an admin. */
  hasAccess: boolean;
  isAdmin: boolean;
  username: string | null;
  session: Session;
  /** Resolves once the initial token check has settled. */
  ready: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-mint the ID token so a newly granted claim is picked up immediately. */
  refreshClaims: () => Promise<void>;
};

const SIGNED_OUT: Session = {
  uid: "",
  email: null,
  username: null,
  isAdmin: false,
  isMember: false,
  planExpiresAt: null,
  user: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(SIGNED_OUT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = firebaseAuth();
    let cancelled = false;

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (cancelled) return;
      if (!user) {
        setSession(SIGNED_OUT);
        setReady(true);
        return;
      }
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/session", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const facts = (await response.json()) as SessionFacts;
        if (cancelled) return;
        setSession({ ...facts, user });
      } catch {
        if (!cancelled) setSession({ ...SIGNED_OUT, user });
      } finally {
        if (!cancelled) setReady(true);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  /**
   * Expiry has to take the screen away on its own.
   *
   * A membership is 7 days. Firebase only rotates the ID token hourly, so
   * onIdTokenChanged alone would leave an expired member looking at a dashboard
   * for up to an hour after their access lapsed. Re-reading /api/session on an
   * interval means the gate re-evaluates against the real expiry timestamp
   * instead of the hour-old token. 60s, and only while a tab is visible, so a
   * backgrounded tab does not keep polling.
   *
   * This is convenience, not enforcement. Nothing here grants access - the
   * server is the authority on every read and write, and Firestore Rules would
   * reject an expired member regardless of what this screen believes.
   */
  useEffect(() => {
    if (!session.uid) return;

    const poll = async () => {
      const user = session.user;
      if (!user || document.visibilityState !== "visible") return;
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/session", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) return;
        const facts = (await response.json()) as SessionFacts;
        setSession({ ...facts, user });
      } catch {
        /* transient; the next tick retries */
      }
    };

    const interval = setInterval(() => void poll(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session.uid, session.user]);

  const signIn = useCallback(async (username: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok: true; customToken: string }
      | { error: string }
      | null;

    if (!response.ok || !payload || !("customToken" in payload)) {
      throw new Error(
        payload && "error" in payload ? payload.error : "Could not sign in.",
      );
    }

    await signInWithCustomToken(firebaseAuth(), payload.customToken);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth());
    setSession(SIGNED_OUT);
  }, []);

  /**
   * Claims live inside the ID token, so a claim granted after sign-in is
   * invisible until the token is force-refreshed. The desk calls this right
   * after login instead of waiting out the token lifetime.
   */
  const refreshClaims = useCallback(async () => {
    const auth = firebaseAuth();
    const user = auth.currentUser;
    if (!user) return;
    await getIdToken(user, true);
    const result = await getIdTokenResult(user);
    if (result.claims.admin === true) {
      setSession((current) => ({ ...current, isAdmin: true }));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session.uid !== "",
      // Admins bypass the payment gate by design - the desk publishes the
      // signals, so gating it behind a member subscription would be circular.
      hasAccess: session.isAdmin || session.isMember,
      isAdmin: session.isAdmin,
      username: session.username,
      session,
      ready,
      signIn,
      signOut,
      refreshClaims,
    }),
    [session, ready, signIn, signOut, refreshClaims],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** The ID token for calls that must be authorised server side. */
export async function authHeaders(): Promise<{ authorization: string }> {
  const user = firebaseAuth().currentUser;
  const token = user ? await getIdToken(user) : "";
  return { authorization: token ? `Bearer ${token}` : "" };
}