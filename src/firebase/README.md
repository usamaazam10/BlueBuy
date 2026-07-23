# Firebase (prepared, not configured)

This folder is reserved for Firebase initialization and SDK wrappers. It is
**intentionally empty of logic** during project setup.

When you are ready to wire up Firebase:

1. Add the values in `.env.example` to `.env.local`.
2. Create `config.ts` here that reads from `@/lib/env` (`env.firebase`) and calls
   `initializeApp` once, exporting the app instance.
3. Add per-service modules as needed (e.g. `auth.ts`, `firestore.ts`, `storage.ts`).

> Note: Firebase Auth and Firestore require client-side JS and work with static
> export, but any feature relying on the Firebase Admin SDK or server-only
> secrets will **not** run on GitHub Pages (there is no server runtime).
