"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase client SDK.
 *
 * Lazy on purpose: the app is prerendered at build time, and a module-level
 * initializeApp() would throw on any machine that has not filled in .env.local
 * (a fresh clone, CI, a preview build). Reading config at first use instead
 * keeps `next build` independent of credentials - the rule is that absence of
 * config fails when a member actually signs in, not when the site compiles.
 *
 * The API key here is public by design; it identifies the project, it does not
 * authorise anything. Firestore Rules and the admin claim are what actually
 * decide who may read or write.
 *
 * Every variable below is read through a literal `process.env.NEXT_PUBLIC_*`
 * member expression. That is load-bearing, not stylistic: Next.js inlines
 * public env vars at build time by static replacement, so a dynamic lookup
 * like `process.env[name]` compiles to a runtime read that is always undefined
 * in the browser bundle. Do not refactor these reads behind a helper that
 * takes the variable name.
 */

type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let cached: FirebaseClient | null = null;

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

/**
 * Whether the public Firebase config made it into this build.
 *
 * NEXT_PUBLIC_* values are inlined at build time, not read at request time, so
 * adding them on the host after a build changes nothing until the next
 * deployment. That makes "env var set but blank page" a recurring failure, and
 * it should be diagnosable rather than a white screen: check this to tell a
 * missing-config deployment apart from a broken one.
 */
export function firebaseConfigMissing(): string | null {
  // Static member access on purpose - see the module comment. The required set
  // is unchanged: the API key, auth domain, project id, storage bucket and app
  // id. The sender id stays optional, exactly as before.
  const absent: string[] = [];
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) absent.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) absent.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) absent.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    absent.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  }
  if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) absent.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  return absent.length ? `Missing ${absent.join(", ")}` : null;
}

export function firebaseClient(): FirebaseClient {
  if (cached) return cached;

  const config = {
    apiKey: required(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: required(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    ),
    projectId: required(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    ),
    storageBucket: required(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    ),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: required(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "NEXT_PUBLIC_FIREBASE_APP_ID"),
  };

  const app = getApps().length ? getApp() : initializeApp(config);
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}

/** Convenience accessors, so callers do not destructure three times. */
export const firebaseAuth = (): Auth => firebaseClient().auth;
export const firestore = (): Firestore => firebaseClient().db;