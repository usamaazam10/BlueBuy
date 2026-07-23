/**
 * Firestore instance (singleton).
 *
 * Access via `getDb()`. Initialised lazily and memoised, so it is created once
 * per runtime. When emulators are enabled it connects to the local Firestore
 * emulator exactly once.
 */
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFirebaseApp } from './app';
import { USE_EMULATORS, EMULATOR_CONFIG } from './config';

let cachedDb: Firestore | null = null;
let emulatorConnected = false;

/** Returns the shared Firestore instance. */
export function getDb(): Firestore {
  if (cachedDb) return cachedDb;

  cachedDb = getFirestore(getFirebaseApp());

  if (USE_EMULATORS && !emulatorConnected) {
    connectFirestoreEmulator(cachedDb, EMULATOR_CONFIG.host, EMULATOR_CONFIG.firestorePort);
    emulatorConnected = true;
  }

  return cachedDb;
}
