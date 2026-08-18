import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Emulator-backed integration suite — see `vitest.config.ts` for the split. */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Dummy Firebase config + emulator routing. Deliberately NOT the values in
    // .env.local: the suite writes freely, so it must be impossible for it to
    // reach the real project even if emulator routing were misconfigured.
    env: {
      NEXT_PUBLIC_FIREBASE_USE_EMULATORS: 'true',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'bluebuy-test.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'bluebuy-test',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'bluebuy-test.appspot.com',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:1:web:1',
    },
    include: ['**/*.emulator.test.ts'],
    // Transactions contend on the same documents by design (the concurrency
    // tests depend on it), so the files must not race each other.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
