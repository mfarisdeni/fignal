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
  createUserWithEmailAndPassword,
  getIdToken,
  getIdTokenResult,
  getRedirectResult,
  GoogleAuthProvider,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth,
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
  /**
   * Non-null when this build is missing the NEXT_PUBLIC Firebase config, i.e.
   * sign-in cannot work here at all. Null on a healthy deployment.
   */
  configError: string | null;
  /**
   * Last failure from a redirect sign-in, which resolves away from any form.
   * The gate shows it once; any new attempt clears it.
   */
  authError: string | null;
  clearAuthError: () => void;
  /** Google sign-in, falling back to a full-page redirect when popups cannot open. */
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  /**
   * Sends the Firebase reset email to our /reset-password handler. Always
   * resolves the same way so an address cannot be probed for an account.
   */
  sendPasswordReset: (email: string) => Promise<void>;
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
  /**
   * Set when this build has no usable Firebase config, so gated routes can say
   * "the deployment is missing env vars" instead of offering a sign-in form
   * that cannot possibly work.
   */
  const [configError, setConfigError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = useCallback(() => setAuthError(null), []);

  /**
   * Make sure the server profile exists for a freshly signed-in user, then
   * reload the session so the new username shows up immediately. A failure
   * here never fails the sign-in: the Firebase session is real, the profile
   * write is retried on the next token change, and the member gate reads the
   * membership record, not the profile.
   */
  const ensureProfile = useCallback(async (user: User) => {
    try {
      const token = await user.getIdToken();
      const provisioned = await fetch("/api/auth/provision", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!provisioned.ok) return;
      const response = await fetch("/api/session", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const facts = (await response.json()) as SessionFacts;
      setSession({ ...facts, user });
    } catch {
      /* transient; the next token change retries */
    }
  }, []);

  useEffect(() => {
    let auth: Auth;

    // firebaseAuth() throws when the NEXT_PUBLIC config is absent from this
    // build. That used to happen outside any try/catch, and because
    // AuthProvider sits above every route it took the landing page down too -
    // one missing env var rendered the whole site as "this page could not load".
    // Failing into a known state keeps the public pages readable and lets the
    // gated ones say what is actually wrong.
    try {
      auth = firebaseAuth();
    } catch (caught) {
      setConfigError(
        caught instanceof Error ? caught.message : "Firebase is not configured.",
      );
      setSession(SIGNED_OUT);
      setReady(true);
      return;
    }

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
        // A user without a profile just arrived (redirect sign-in, or an
        // account created before provisioning existed). Established members
        // already have a username, so this fires once per account, not hourly.
        if (!facts.username) void ensureProfile(user);
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
  }, [ensureProfile]);

  // Collect the result of a redirect sign-in. The user (if any) flows through
  // onIdTokenChanged above; only a failure needs handling here, since it
  // resolves away from whatever form started it.
  useEffect(() => {
    let cancelled = false;
    let auth: Auth;
    try {
      auth = firebaseAuth();
    } catch {
      return; // configError in the main effect already says this
    }
    void getRedirectResult(auth).catch((caught: unknown) => {
      if (!cancelled) setAuthError(friendlyAuthError(caught));
    });
    return () => {
      cancelled = true;
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

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const auth = firebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const credential = await signInWithPopup(auth, provider);
      await ensureProfile(credential.user);
    } catch (caught) {
      const code = (caught as { code?: string })?.code ?? "";
      // Popup blockers and embedded webviews cannot open the Google window;
      // continue with a full-page redirect instead of failing.
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw toAuthError(caught);
    }
  }, [ensureProfile]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      try {
        const credential = await signInWithEmailAndPassword(
          firebaseAuth(),
          email.trim(),
          password,
        );
        await ensureProfile(credential.user);
      } catch (caught) {
        throw toAuthError(caught);
      }
    },
    [ensureProfile],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      try {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth(),
          email.trim(),
          password,
        );
        await ensureProfile(credential.user);
      } catch (caught) {
        throw toAuthError(caught);
      }
    },
    [ensureProfile],
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    const target = email.trim();
    if (!/.+@.+\..+/.test(target)) {
      throw new Error("Enter a valid email address.");
    }
    try {
      await sendPasswordResetEmail(firebaseAuth(), target, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
    } catch (caught) {
      const code = (caught as { code?: string })?.code ?? "";
      // Never reveal whether the address has an account.
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        return;
      }
      throw toAuthError(caught);
    }
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
      configError,
      authError,
      clearAuthError,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      signOut,
      refreshClaims,
    }),
    [
      session,
      ready,
      configError,
      authError,
      clearAuthError,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      signOut,
      refreshClaims,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Firebase error codes translated for display. Sign-in failures deliberately
 * do not distinguish "no such account" from "wrong password": telling them
 * apart would let anyone probe which email addresses have accounts. An empty
 * string means the user aborted (closed the popup) - the caller shows nothing.
 */
function friendlyAuthError(caught: unknown): string {
  const code = (caught as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/user-cancelled":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Wrong email or password.";
    case "auth/invalid-email":
    case "auth/missing-email":
      return "Enter a valid email address.";
    case "auth/email-already-in-use":
      return "That email is already registered. Sign in instead.";
    case "auth/weak-password":
      return "Use at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a bit and try again.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    case "auth/account-exists-with-different-credential":
      return "That email is registered another way. Sign in with your original method.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled yet.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for sign-in.";
    default:
      return "Could not sign in. Try again.";
  }
}

function toAuthError(caught: unknown): Error {
  const code = (caught as { code?: string })?.code ?? "";
  return Object.assign(new Error(friendlyAuthError(caught)), { code });
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