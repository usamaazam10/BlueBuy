/**
 * Firebase App singleton.
 *
 * Uses `getApps()` to guarantee the app is initialised **exactly once**, even
 * across Next.js hot-reloads, multiple imports, or client/server module graphs.
 * Access the app only through `getFirebaseApp()` — it is created lazily on first
 * use so simply importing this module never triggers initialisation (important
 * for static export / prerendering).
 */
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { firebaseConfig, isFirebaseConfigured, getMissingConfigKeys } from './config';

let cachedApp: FirebaseApp | null = null;

/** Returns the shared FirebaseApp, initialising it once on first call. */
export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;

  if (!isFirebaseConfigured()) {
    // Fail loudly with an actionable message rather than a cryptic SDK error.
    throw new Error(
      `[firebase] Missing required configuration: ${getMissingConfigKeys().join(
        ', '
      )}. Copy .env.example to .env.local and fill in your Firebase project values.`
    );
  }

  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

/** True if a Firebase app has already been initialised in this runtime. */
export function isFirebaseInitialized(): boolean {
  return cachedApp !== null || getApps().length > 0;
}
