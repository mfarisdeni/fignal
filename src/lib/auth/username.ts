/**
 * Username rules, shared by the register form and the API so the two cannot
 * disagree about what a legal handle is. A mismatch here would produce the
 * worst kind of bug: the form accepts something, then the server rejects it.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/**
 * Letters, digits, underscore and dot. The first character must be a letter or
 * digit so a handle never starts with punctuation, and the dot cannot be last.
 *
 * Deliberately not the full Unicode range: these handles appear in the admin
 * desk, in email subjects and in URLs, and the confusable-character problem
 * (Cyrillic а vs Latin a) is not worth solving for a trading product.
 */
const HANDLE = /^[a-zA-Z0-9][a-zA-Z0-9._]{1,18}[a-zA-Z0-9]$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "fignal",
  "platinum",
  "signal",
  "about",
  "help",
  "login",
  "signup",
  "settings",
  "api",
  "www",
]);

/** Firestore keys and uniqueness lookups are lowercased. */
export const normalizeUsername = (value: string): string =>
  value.trim().toLowerCase();

/**
 * Shape a display name or email local part into a legal handle, or null when
 * nothing usable survives. Used when the handle is derived rather than asked
 * for (Google sign-in), so "M Farisdeni" becomes mfarisdeni and emoji soup
 * becomes nothing instead of a broken document id.
 */
export function handleCandidate(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "");
  if (
    cleaned.length < USERNAME_MIN ||
    cleaned.length > USERNAME_MAX ||
    !HANDLE.test(cleaned) ||
    RESERVED.has(cleaned)
  ) {
    return null;
  }
  return cleaned;
}

export function validateUsername(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
    return `Use ${USERNAME_MIN}-${USERNAME_MAX} characters.`;
  }
  if (!HANDLE.test(trimmed)) {
    return "Letters, numbers, dot and underscore only. Cannot start or end with punctuation.";
  }
  if (RESERVED.has(trimmed.toLowerCase())) {
    return "That handle is reserved.";
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return "Use at least 8 characters.";
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return "Mix letters and numbers.";
  }
  return null;
}