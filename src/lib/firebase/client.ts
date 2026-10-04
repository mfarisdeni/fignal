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
 */

type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let cached: FirebaseClient | null = null;

function required(name: string): string {
  const value = process.env[name];
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
  const names = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const absent = names.filter((name) => !process.env[name]);
  return absent.length ? `Missing ${absent.join(", ")}` : null;
}

export function firebaseClient(): FirebaseClient {
  if (cached) return cached;

  const config = {
    apiKey: required("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: required("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: required("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: required("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: required("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };

  const app = getApps().length ? getApp() : initializeApp(config);
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}

/** Convenience accessors, so callers do not destructure three times. */
export const firebaseAuth = (): Auth => firebaseClient().auth;
export const firestore = (): Firestore => firebaseClient().db;