# Firebase Foundation

Production-ready Firebase wiring for BlueBuy. This layer **prepares** Firebase
(App, Firestore, Storage, Auth-init) but performs **no** reads, writes, or auth
flows yet — those come in later phases.

## Folder structure

```
src/
├── firebase/
│   ├── config.ts      # Env-driven config + environment/emulator flags
│   ├── app.ts         # FirebaseApp singleton (initialised once, lazily)
│   ├── firestore.ts   # getDb() — Firestore singleton (+ emulator)
│   ├── storage.ts     # getStorageInstance() — Storage singleton (+ emulator)
│   ├── auth.ts        # getFirebaseAuth() — Auth singleton, INIT ONLY
│   ├── errors.ts      # AppError + normalisation helpers
│   └── index.ts       # Public barrel — import from "@/firebase"
│
├── services/          # Data-access placeholders (throw "Not implemented")
│   ├── product.service.ts
│   ├── category.service.ts
│   └── storage.service.ts
│
├── types/
│   └── models.ts      # Firestore domain models (Product, Category, Brand,
│                      #   ProductImage, Review, CartItem) + COLLECTIONS
│
└── lib/validations/   # Zod schemas (create/update/document) per entity
    ├── common.ts
    ├── product.schema.ts
    ├── category.schema.ts
    ├── brand.schema.ts
    ├── review.schema.ts
    ├── cart.schema.ts
    └── index.ts
```

## Firebase setup

1. Create a project in the [Firebase console](https://console.firebase.google.com/).
2. Add a **Web app** (`</>`) and copy its config values.
3. Enable the products you need: **Firestore**, **Storage**, **Authentication**.
4. Copy env values into `.env.local` (see below), then restart the dev server.

```bash
cp .env.example .env.local   # then fill in the NEXT_PUBLIC_FIREBASE_* values
npm run dev
```

Nothing initialises until a getter is first called, so the app runs fine before
Firebase is configured. Calling a getter without config throws a clear error
listing the missing keys.

## Environment variables

All config comes from env vars — **nothing is hardcoded**. Every key is
`NEXT_PUBLIC_*` because the Firebase Web SDK runs in the browser; these values
are not secrets (security is enforced by Firebase Security Rules).

| Variable                                   | Required | Purpose                       |
| ------------------------------------------ | -------- | ----------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | ✅       | Web API key                   |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | ✅       | Auth domain                   |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | ✅       | Project id                    |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | ✅       | Storage bucket                |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | —        | Cloud Messaging sender id     |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | ✅       | App id                        |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`      | —        | Analytics (if enabled)        |
| `NEXT_PUBLIC_FIREBASE_USE_EMULATORS`       | —        | `true` to use local emulators |
| `NEXT_PUBLIC_FIREBASE_*_EMULATOR_PORT`     | —        | Emulator port overrides       |

## Switching projects / environments

Because config is 100% env-driven, switching between dev/staging/prod is just a
matter of changing which values are loaded:

- **Local:** keep separate `.env.local` (dev) values; swap in staging/prod
  values to test against another project.
- **CI / hosting:** set the `NEXT_PUBLIC_FIREBASE_*` variables in the
  environment (e.g. GitHub Actions secrets) per deployment target.
- **Emulators:** set `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` and run
  `firebase emulators:start` to develop without touching a real project.

No code changes are required to switch — only environment values.

## Architecture decisions

- **Single initialisation.** `app.ts` guards with `getApps()` and memoises the
  instance, so Firebase is initialised exactly once across hot-reloads and
  module graphs.
- **Lazy getters, not eager singletons.** Each service exposes a `get*()`
  function that initialises on first use. Importing `@/firebase` never triggers
  initialisation, which keeps static export / prerendering safe and avoids
  bundling Firebase where it isn't used.
- **Reference-by-id relationships.** Products store `categoryId` / `brandId`
  (and reviews store `productId`) rather than nesting documents. Documents stay
  small and write-friendly; related data is joined on read. Hot aggregates
  (`rating`, `reviewCount`, `productCount`) are denormalised for fast reads.
- **Types vs. validation, separated.** `types/models.ts` holds hand-written
  interfaces (the source of truth for shape); `lib/validations` holds Zod
  schemas for runtime validation with `create` / `update` / full-`document`
  variants and inferred input types.
- **UI types untouched.** These DB models live in `@/types/models` and are
  deliberately **not** re-exported through `@/types`, so the existing UI
  `Product`/`Category` types keep working unchanged.
- **Consistent errors.** `errors.ts` normalises any thrown value into an
  `AppError` with a stable `code` and a friendly message, so callers/UI handle
  failures uniformly. Service stubs throw `notImplemented(...)`.
