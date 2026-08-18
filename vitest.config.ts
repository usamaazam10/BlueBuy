import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Two suites, deliberately separated.
 *
 * `npm test` runs the **pure** unit tests — the calculation layer in
 * `src/lib/business`, which has no Firestore or React dependency and needs no
 * services running.
 *
 * `npm run test:integration` runs the `*.emulator.test.ts` files, which drive
 * the real repositories against the Firestore emulator to prove the *transactions*
 * behave (stock decrements once, receipts can't double-post, the movement ledger
 * reconciles to `stock`). They are excluded from the default run because they
 * need the emulator up; `test:integration` starts and stops it for them.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.next/**',
      '**/*.emulator.test.ts',
    ],
  },
});
