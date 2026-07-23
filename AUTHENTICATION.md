# Admin Authentication

Secure email/password authentication for the BlueBuy **admin dashboard** (`/admin/*`),
built on **Firebase Authentication**. The public storefront is untouched and needs no
sign-in.

> **Scope:** authentication only. No product CRUD, no Firestore reads/writes are wired up
> here — just sign-in, session handling, and route protection, with role-based access
> control scaffolded for later.

---

## 1. Creating the first admin account

There is **no public sign-up** — the login screen only authenticates existing users. This
is intentional: the admin area must not be self-serve. Create accounts out-of-band in the
Firebase console (or via the Admin SDK).

### Prerequisites — configure Firebase

1. In the [Firebase console](https://console.firebase.google.com/), create a project (or
   reuse one) and add a **Web app**.
2. Copy `.env.example` → `.env.local` and fill in the `NEXT_PUBLIC_FIREBASE_*` values from
   **Project settings → General → Your apps**. These keys are safe to expose to the
   browser — access is enforced by Firebase, not by hiding them.
3. In **Build → Authentication → Sign-in method**, enable **Email/Password**. Leave all
   social providers disabled.

### Create the account

**Option A — Firebase console (simplest):**

- **Authentication → Users → Add user**, enter the admin's email and a strong password.

**Option B — Admin SDK / CLI (scriptable, and required to assign roles):**

```js
// Run from a trusted server environment with the Firebase Admin SDK.
const admin = require('firebase-admin');
admin.initializeApp();

const user = await admin.auth().createUser({
  email: 'admin@bluebuy.com',
  password: 'a-strong-password',
});

// Optional but recommended — assign a role via custom claims (see §4).
await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
```

Then go to [`/login`](http://localhost:3000/login), sign in, and you'll land on `/admin`.

### Local development without real Firebase

Set `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` and run `firebase emulators:start`. Create a
test user in the emulator's Auth UI (or via the emulator's REST API). The app auto-connects
to the Auth emulator when this flag is on.

---

## 2. How authentication works

```
┌────────────┐     signInWithEmail()      ┌──────────────────────┐
│  /login    │ ─────────────────────────▶ │  Firebase Auth       │
│  (form)    │                            │  (email/password)    │
└────────────┘                            └──────────┬───────────┘
      ▲                                              │ onAuthStateChanged
      │ redirect if signed in                        ▼
┌─────┴────────────────────────────────────────────────────────┐
│  AuthProvider  (subscribes once, holds { user, loading, … })  │
│      └── useAuth()  ← every component reads state from here    │
└───────────────────────────────────────────────────────────────┘
```

### The layers (single source of truth, no duplicated logic)

| Layer          | File                                                             | Responsibility                                                                                                                                   |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Firebase flows | [`src/firebase/auth.ts`](src/firebase/auth.ts)                   | `signInWithEmail`, `signOutUser`, `observeAuthState`. The **only** place that calls the Firebase Auth SDK. Maps SDK errors to friendly messages. |
| React state    | [`src/lib/auth/auth-context.tsx`](src/lib/auth/auth-context.tsx) | `AuthProvider` subscribes to auth-state changes; `useAuth()` exposes `{ user, loading, configured, signIn, signOut }`.                           |
| Roles          | [`src/lib/auth/roles.ts`](src/lib/auth/roles.ts)                 | `Role` type, `hasRole()` — RBAC scaffolding (see §4).                                                                                            |
| Validation     | [`src/lib/auth/schema.ts`](src/lib/auth/schema.ts)               | Zod schema for the login form.                                                                                                                   |

### Session persistence

The **"Keep me signed in"** checkbox chooses the Firebase persistence mode before sign-in:

- **checked → `browserLocalPersistence`** — the session survives closing the tab/browser.
- **unchecked → `browserSessionPersistence`** — the session is cleared when the tab closes.

On every page load, `AuthProvider` waits for Firebase to restore any persisted session
(`loading = true`) before deciding whether the user is authenticated. This prevents a
"logged-in user briefly seeing the login screen" flash.

### States exposed by `useAuth()`

- **`loading`** — the persisted session is still being resolved. UI shows a spinner.
- **`user`** — the signed-in `AuthUser` (`uid`, `email`, `displayName`, `photoURL`,
  `role`), or `null`.
- **`configured` / `configError`** — false when the Firebase env vars are missing, so the
  app shows an actionable message instead of a blank screen.

### Logout

The avatar menu in the admin top bar ([`account-menu.tsx`](src/components/auth/account-menu.tsx))
calls `signOut()` and redirects to `/login`. The auth listener clears `user` everywhere.

---

## 3. How route protection works

> **Important architectural note:** BlueBuy ships as a **static export**
> (`output: 'export'` — GitHub Pages). There is **no Next.js server or middleware at
> runtime**, so route protection is enforced **client-side**. This is a UX gate; the real
> security boundary is Firebase Auth + Security Rules (see §5).

### One gate for the whole admin surface

Protection is applied once, in the admin layout — so **every current and future
`/admin/*` route is protected automatically**, with no per-page wiring:

```tsx
// src/app/admin/layout.tsx
<AuthProvider>
  <ProtectedRoute>
    <AdminShell>{children}</AdminShell>
  </ProtectedRoute>
</AuthProvider>
```

[`ProtectedRoute`](src/components/auth/protected-route.tsx) decides what to render:

1. **Config missing** → an "authentication unavailable" notice.
2. **`loading`** → a full-screen spinner (nothing protected renders yet).
3. **No user** → `router.replace('/login')`; a spinner shows while the redirect is in
   flight, so no protected UI ever flashes.
4. **Signed in but wrong role** (when a `requiredRole` is set) → an "unauthorized" screen.
5. **Authorized** → renders the admin shell.

Protected routes: `/admin`, `/admin/products`, `/admin/categories`, `/admin/brands`,
`/admin/settings`, and anything else added under `/admin`.

### The login route

- [`/login`](src/app/login/page.tsx) is wrapped in its own `AuthProvider` and is **skipped
  by the storefront chrome** ([`site-chrome.tsx`](src/components/layout/site-chrome.tsx))
  so it renders as a standalone, branded, centered screen.
- If an **already-authenticated** admin visits `/login`, they're redirected to `/admin`.

---

## 4. Roles & future permissions (scaffolding)

RBAC is scaffolded but not yet enforced beyond "is authenticated":

- Roles are `'admin' | 'editor' | 'viewer'` ([`roles.ts`](src/lib/auth/roles.ts)), ranked by
  privilege. `hasRole(userRole, required)` centralizes checks.
- A user's role comes from a **Firebase custom claim** (`{ role: 'editor' }`), which is
  signed by Firebase and **cannot be forged client-side**. Absent a claim, an
  authenticated user defaults to `admin` (`DEFAULT_ROLE`).
- To gate a future route/section by role, pass a prop:

  ```tsx
  <ProtectedRoute requiredRole="editor">…</ProtectedRoute>
  ```

Assign roles server-side with the Admin SDK (`setCustomUserClaims`), as shown in §1.

---

## 5. Security notes

- **No secrets in the repo.** All Firebase config comes from `NEXT_PUBLIC_FIREBASE_*` env
  vars. The Web API key is not a secret; access control is Firebase's job.
- **Client state is never the security boundary.** `ProtectedRoute` is a UX convenience.
  Because this is a static site, a determined user can bypass the client gate — so any real
  data access (once Firestore/Storage is wired up) **must** be protected by
  [Firebase Security Rules](https://firebase.google.com/docs/rules) that verify
  `request.auth` and, for RBAC, the `role` custom claim.
- **No account enumeration.** Sign-in errors are deliberately vague
  ("Incorrect email or password") rather than revealing whether an account exists.
- **No public sign-up** and **email/password only** — no social providers.
