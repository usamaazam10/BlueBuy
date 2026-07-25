/**
 * Centralized, typed access to public environment variables.
 *
 * Only `NEXT_PUBLIC_*` variables are available in the browser. Server-only
 * secrets should be read directly from `process.env` inside server code and
 * must never be imported into a client component.
 *
 * Firebase values are declared here for later use but are intentionally not
 * consumed yet — this is the setup phase only.
 */
export const env = {
  /** Repo subpath used for GitHub Pages deploys (e.g. `/bluebuy`). */
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',

  /** Public site URL, useful for absolute metadata/OG links. */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',

  /**
   * Store WhatsApp number in international format, digits only (no `+`), e.g.
   * `15551234567`. Used to build the post-order "Contact on WhatsApp" handoff.
   * Falls back to a placeholder so the flow works before it's configured.
   */
  storeWhatsApp: (process.env.NEXT_PUBLIC_STORE_WHATSAPP ?? '15551234567').replace(/\D/g, ''),

  /** Firebase config — prepared, not wired up. See `.env.example`. */
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  },
} as const;
