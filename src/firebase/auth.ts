/**
 * Firebase Authentication instance (singleton) — INITIALISE ONLY.
 *
 * This module wires up Auth so the rest of the app can obtain a ready instance,
 * but it intentionally implements **no** auth flows (sign-in, sign-up, session
 * handling). Those are out of scope for this phase.
 *
 * Access via `getFirebaseAuth()`. Initialised lazily and memoised. When
 * emulators are enabled it connects to the local Auth emulator once.
 */
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirebaseApp } from './app';
import { USE_EMULATORS, EMULATOR_CONFIG } from './config';

let cachedAuth: Auth | null = null;
let emulatorConnected = false;

/** Returns the shared Auth instance (no auth logic is performed here). */
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
