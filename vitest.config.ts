import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest configuration.
 *
 * Scope: the pure business-calculation engine in `src/lib/business` and the
 * order/purchase state machines. These are plain functions with no Firestore or
 * React dependency, so they run in a plain Node environment with no mocking
 * scaffolding — which is exactly why the financial logic was factored out of the
 * UI in the first place.
 *
 * Repository/service tests need the Firebase emulator suite and are documented
 * as a follow-up in BUSINESS_OPERATIONS.md § Testing.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Timezone-sensitive: the date-range engine works in local time by design,
    // so pin a zone to keep results reproducible across machines and CI.
    env: { TZ: 'UTC' },
  },
});
