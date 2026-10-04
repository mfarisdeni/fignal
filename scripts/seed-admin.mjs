import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * One-shot seeder for the master admin account.
 *
 * Run it from the machine that holds the service-account key, then delete the
 * password from .env.local - the script needs it once, at creation time, and
 * nothing at runtime ever reads it.
 *
 *   node --env-file=.env.local scripts/seed-admin.mjs
 *
 * Why a custom claim rather than a password check: a claim is minted by the
 * server and travels inside the Firebase ID token, so both the /admin page and
 * the Firestore Rules can verify the same fact. A password compared in the
 * browser - which is what ADMIN_PASSCODE did - can only ever be obfuscation, and
 * once signals are shared between devices it is the only thing standing between
 * a stranger and the publish button.
 */

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;
const username = process.env.ADMIN_SEED_USERNAME ?? "admin";

const missing = [];
if (!projectId) missing.push("FIREBASE_PROJECT_ID");
if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
if (!email) missing.push("ADMIN_SEED_EMAIL");
if (!password) missing.push("ADMIN_SEED_PASSWORD");

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  console.error("Copy .env.example to .env.local and fill them in.");
  process.exit(1);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });

const auth = getAuth(app);

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Found existing user ${user.email} (${user.uid}); resetting password + claim.`);
    await auth.updateUser(user.uid, { password, emailVerified: true });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    user = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: username,
    });
    console.log(`Created ${email} (${user.uid}).`);
  }

  // The claim the app and the rules both read.
  await auth.setCustomUserClaims(user.uid, { admin: true, username });

  // Reserve the handle and write the profile, or username login cannot find this
  // account and the desk would have to sign in by email instead.
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  const db = getFirestore(app);
  const handle = username.trim().toLowerCase();

  await db.collection("usernames").doc(handle).set(
    { uid: user.uid, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  await db.collection("users").doc(user.uid).set(
    {
      username,
      usernameLower: handle,
      email,
      displayName: username,
      locale: "en",
      role: "admin",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`Claim set: admin=true, username=${username}`);
  console.log(`Reserved handle: usernames/${handle} -> ${user.uid}`);
  console.log(
    "Open /admin and sign in with this account. It bypasses the member payment gate.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});