/**
 * Public entry point for the Firebase layer.
 *
 * Prefer importing from `@/firebase` rather than reaching into individual
 * files. Everything is exposed through lazy getters so importing this module
 * never initialises Firebase on its own.
 */
export {
  firebaseConfig,
  isFirebaseConfigured,
  getMissingConfigKeys,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  USE_EMULATORS,
} from './config';

export { getFirebaseApp, isFirebaseInitialized } from './app';
export { getDb } from './firestore';
export { getStorageInstance } from './storage';
export { getFirebaseAuth, signInWithEmail, signOutUser, observeAuthState } from './auth';

export {
  AppError,
  type AppErrorCode,
  isFirebaseError,
  toAppError,
  notImplemented,
  withAppError,
} from './errors';
