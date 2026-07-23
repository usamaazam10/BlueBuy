/**
 * Cloud Storage instance (singleton).
 *
 * Access via `getStorageInstance()`. Initialised lazily and memoised. When
 * emulators are enabled it connects to the local Storage emulator once.
 */
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFirebaseApp } from './app';
import { USE_EMULATORS, EMULATOR_CONFIG } from './config';

let cachedStorage: FirebaseStorage | null = null;
let emulatorConnected = false;

/** Returns the shared Cloud Storage instance. */
export function getStorageInstance(): FirebaseStorage {
  if (cachedStorage) return cachedStorage;

  cachedStorage = getStorage(getFirebaseApp());

  if (USE_EMULATORS && !emulatorConnected) {
    connectStorageEmulator(cachedStorage, EMULATOR_CONFIG.host, EMULATOR_CONFIG.storagePort);
    emulatorConnected = true;
  }

  return cachedStorage;
}
