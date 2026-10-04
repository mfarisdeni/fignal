import "server-only";

import { adminAuth } from "@/lib/firebase/server";

/**
 * Session facts the client is not allowed to decide for itself.
 *
 * The ID token is minted by Firebase and verified with the project's public
 * keys, so these booleans are trustworthy in a way that anything read from
 * localStorage never was. `admin` is a custom claim, set once by
 * scripts/seed-admin.mjs.
 *
 * Force-refresh matters: a claim change does not land in an already-issued
 * token, so the master account would keep seeing the old claims until the token
 * expired (an hour). The admin gate calls refresh() after sign-in.
 */

export type SessionFacts = {
  uid: string;
  email: string | null;
  username: string | null;
  isAdmin: boolean;
  /** Paid and not expired - the member gate. Admins bypass this. */
  isMember: boolean;
  planExpiresAt: number | null;
};

const UNPAID: SessionFacts = {
  uid: "",
  email: null,
  username: null,
  isAdmin: false,
  isMember: false,
  planExpiresAt: null,
};

export async function sessionFacts(idToken: string | undefined): Promise<SessionFacts> {
  if (!idToken) return UNPAID;

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!decoded.uid) return UNPAID;

    const [username, member] = await Promise.all([
      readUsername(decoded.uid),
      readMembership(decoded.uid),
    ]);

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      username,
      isAdmin: decoded.admin === true,
      isMember: member.active,
      planExpiresAt: member.expiresAt,
    };
  } catch {
    // Expired, revoked, or signed by the wrong project. Treat as signed out.
    return UNPAID;
  }
}

async function readUsername(uid: string): Promise<string | null> {
  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    const snap = await getFirestore().collection("users").doc(uid).get();
    return snap.get("username") ?? null;
  } catch {
    return null;
  }
}

/**
 * Membership is a server-owned record, not a client assertion. The QRIS webhook
 * is the only writer - see app/api/payments/webhook/route.ts - so a member
 * cannot grant themselves access by editing a field.
 */
async function readMembership(
  uid: string,
): Promise<{ active: boolean; expiresAt: number | null }> {
  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    const snap = await getFirestore().collection("members").doc(uid).get();
    if (!snap.exists) return { active: false, expiresAt: null };

    const data = snap.data() ?? {};
    const expiresAt = typeof data.expiresAt === "number" ? data.expiresAt : null;
    // No expiry means a perpetual membership (the founding desk, for example).
    const active = data.active === true && (expiresAt === null || expiresAt > Date.now());
    return { active, expiresAt };
  } catch {
    return { active: false, expiresAt: null };
  }
}