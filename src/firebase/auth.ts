/**
 * Firebase Authentication instance + email/password auth flows.
 *
 * `getFirebaseAuth()` returns the memoised {@link Auth} singleton (initialised
 * lazily so importing this module never triggers Firebase init — important for
 * static export / prerendering). The flow helpers below are thin, framework-
 * agnostic wrappers around the Firebase Web SDK so the auth logic lives in
 * exactly one place; the React layer (`@/lib/auth`) consumes them and must not
 * re-implement any of this.
 *
 * Only email/password is supported by design — no social/OAuth providers.
 */
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type Auth,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { getFirebaseApp } from './app';
import { USE_EMULATORS, EMULATOR_CONFIG } from './config';
import { AppError, isFirebaseError } from './errors';

let cachedAuth: Auth | null = null;
let emulatorConnected = false;

/** Returns the shared Auth instance, initialising it once on first call. */
export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  cachedAuth = getAuth(getFirebaseApp());

  if (USE_EMULATORS && !emulatorConnected) {
    const { host, authPort } = EMULATOR_CONFIG;
    connectAuthEmulator(cachedAuth, `http://${host}:${authPort}`, { disableWarnings: true });
    emulatorConnected = true;
  }

  return cachedAuth;
}

/**
 * Maps a raw `auth/*` provider code to a user-safe message. Deliberately vague
 * about which of email/password was wrong (never reveal whether an account
 * exists) while still being actionable for genuine mistakes.
 */
function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact an administrator.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Unable to sign in right now. Please try again.';
  }
}

/** Normalises any thrown sign-in error into an `AppError` with a friendly message. */
function toAuthError(error: unknown): AppError {
  if (isFirebaseError(error)) {
    return new AppError('unauthenticated', authErrorMessage(error.code), {
      cause: error,
      providerCode: error.code,
    });
  }
  return new AppError('unknown', 'Unable to sign in right now. Please try again.', {
    cause: error,
  });
}

/**
 * Signs an administrator in with email + password.
 *
 * `remember` controls session persistence:
 * - `true`  → `browserLocalPersistence`: the session survives tab/browser
 *   restarts (the "Remember me" case).
 * - `false` → `browserSessionPersistence`: the session is cleared when the tab
 *   is closed.
 *
 * Persistence is set **before** the sign-in call so it applies to the resulting
 * session. Throws an {@link AppError} on failure.
 */
export async function signInWithEmail(
  email: string,
  password: string,
  remember = true
): Promise<User> {
  const auth = getFirebaseAuth();
  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw toAuthError(error);
  }
}

/** Signs the current user out. Throws an {@link AppError} on failure. */
export async function signOutUser(): Promise<void> {
  try {
    await fbSignOut(getFirebaseAuth());
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Subscribes to auth-state changes. The callback fires once with the current
 * user (or `null`) as soon as the SDK resolves the persisted session, then on
 * every subsequent sign-in/out. Returns an unsubscribe function.
 */
export function observeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}
