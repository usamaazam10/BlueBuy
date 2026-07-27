/**
 * Firebase App Check — request attestation for this static, serverless app.
 *
 * Because BlueBuy is a static export with no backend, checkout writes to
 * Firestore happen in the browser as an anonymous user (create a pending order,
 * decrement stock — see `firestore.rules`). Security Rules validate the shape of
 * those writes; App Check adds attestation on top so Firestore accepts requests
 * only from your app. It attaches a reCAPTCHA-backed token to every request, and
 * once enforcement is enabled in the Firebase console, requests without a valid
 * token are rejected before Rules run. App Check is free-plan compatible.
 *
 * This is intentionally **opt-in**: with no `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` set
 * it is a no-op, so nothing changes until you deliberately configure it. Roll it
 * out in "monitor" mode first (console → App Check), confirm tokens are flowing,
 * then switch Firestore to "enforce". See the setup notes in AUTHENTICATION.md.
 */
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

let cached: AppCheck | null = null;

/**
 * Initialise App Check once, in the browser, if a reCAPTCHA site key is
 * configured. Idempotent and safe to call on every `getFirebaseApp()`.
 * Returns `null` (a no-op) on the server or when unconfigured.
 */
export function initAppCheck(app: FirebaseApp): AppCheck | null {
  if (cached) return cached;
  if (typeof window === 'undefined') return null;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return null; // App Check disabled until a site key is provided.

  // In development, register a debug token (console → App Check → Manage debug
  // tokens) so localhost — which has no verifiable reCAPTCHA domain — still gets
  // a token. `true` prints a fresh token to the console to register once.
  const debugToken = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  if (debugToken) {
    (
      self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken;
  }

  cached = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    // Auto-refresh keeps a valid token in hand for long sessions.
    isTokenAutoRefreshEnabled: true,
  });
  return cached;
}
