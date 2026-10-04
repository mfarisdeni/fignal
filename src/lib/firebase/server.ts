import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK - server only.
 *
 * "server-only" makes any accidental import from a client component a build
 * error rather than a runtime leak, which matters because this module holds the
 * service-account key that bypasses Firestore Rules entirely.
 *
 * Every call in here is trusted code. The client never receives the key, and
 * never gets to assert its own admin/entitlement status - it asks, and rules
 * plus custom claims decide the answer.
 */

type FirebaseAdmin = {
  app: App;
  auth: Auth;
  db: Firestore;
};

let cached: FirebaseAdmin | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function firebaseAdmin(): FirebaseAdmin {
  if (cached) return cached;

  if (getApps().length) {
    const app = getApp();
    cached = { app, auth: getAuth(app), db: getFirestore(app) };
    return cached;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    "";

  // Two ways to supply the credential, in order of preference:
  //
  // 1. FIREBASE_SERVICE_ACCOUNT_PATH - the downloaded key JSON on disk. This is
  //    the better option because the file keeps its real key formatting, so
  //    nothing has to survive being copied into a .env and having its newlines
  //    re-escaped by hand.
  // 2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY - for hosts (Vercel,
  //    Firebase Functions) that inject secrets as environment variables.
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const credential = keyPath
    ? cert(keyPath)
    : cert({
        projectId,
        clientEmail: required("FIREBASE_CLIENT_EMAIL"),
        privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      });

  const app = initializeApp({
    credential,
    projectId: projectId || undefined,
  });

  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}

export const adminAuth = (): Auth => firebaseAdmin().auth;
export const adminDb = (): Firestore => firebaseAdmin().db;