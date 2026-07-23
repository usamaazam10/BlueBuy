/**
 * Firebase configuration, sourced entirely from environment variables.
 *
 * Nothing is hardcoded — see `.env.example` for the required keys. All values
 * are `NEXT_PUBLIC_*` because the Firebase Web SDK runs in the browser and its
 * config is not secret (security is enforced by Firebase Security Rules, not by
 * hiding these values).
 *
 * Supports development and production via the same variables; point them at a
 * different Firebase project to switch environments (see README).
 */
import type { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** The minimum keys required for the SDK to initialise meaningfully. */
const REQUIRED_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'appId',
] as const satisfies readonly (keyof FirebaseOptions)[];

/** True when all required config values are present. */
export function isFirebaseConfigured(): boolean {
  return REQUIRED_KEYS.every((key) => {
    const value = firebaseConfig[key];
    return typeof value === 'string' && value.length > 0;
  });
}

/** Names of any missing required config keys (for diagnostics). */
export function getMissingConfigKeys(): string[] {
  return REQUIRED_KEYS.filter((key) => {
    const value = firebaseConfig[key];
    return typeof value !== 'string' || value.length === 0;
  });
}

/** Current runtime environment. */
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_DEVELOPMENT = !IS_PRODUCTION;

/**
 * Whether to route the SDK to local Firebase emulators. Enable by setting
 * NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true (typically only in development).
 */
export const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === 'true';

/** Emulator host/ports, overridable via env for CI or custom setups. */
export const EMULATOR_CONFIG = {
  host: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST ?? '127.0.0.1',
  authPort: Number(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT ?? 9099),
  firestorePort: Number(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080),
  storagePort: Number(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT ?? 9199),
} as const;
