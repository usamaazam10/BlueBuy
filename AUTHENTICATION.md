# Admin Authentication

Secure email/password authentication for the BlueBuy **admin dashboard** (`/admin/*`),
built on **Firebase Authentication**. The public storefront is untouched and needs no
sign-in.

> **Scope:** sign-in, session handling, route protection, and **enforced role-based access
> control**. Admin access is granted **only** by a Firebase custom claim (`role: 'admin'`) —
> being signed in is never enough. Everyone else defaults to `viewer` with no admin access.
> See [§4](#4-roles--admin-access-runbook) for the full runbook.

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

// REQUIRED to reach /admin — without this claim the user is a `viewer` and is
// denied by both the route guard and the Firestore rules. See §4.
await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
```

> **Creating a user is not the same as making them an admin.** A brand-new account has **no
> role claim**, so it defaults to `viewer` and cannot access `/admin` or write any data.
> Admin access exists **only** after the `role: 'admin'` custom claim is set (§4).

Then go to [`/login`](http://localhost:3000/login), sign in, and — once the admin claim is
set — you'll land on `/admin`.

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
| Roles          | [`src/lib/auth/roles.ts`](src/lib/auth/roles.ts)                 | `Role` type, `hasRole()`, `DEFAULT_ROLE = 'viewer'` — RBAC, resolved from custom claims (see §4).                                                |
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
  <ProtectedRoute requiredRole="admin">
    <AdminShell>{children}</AdminShell>
  </ProtectedRoute>
</AuthProvider>
```

[`ProtectedRoute`](src/components/auth/protected-route.tsx) decides what to render:

1. **Config missing** → an "authentication unavailable" notice.
2. **`loading`** → a full-screen spinner (nothing protected renders yet).
3. **No user** → `router.replace('/login')`; a spinner shows while the redirect is in
   flight, so no protected UI ever flashes.
4. **Signed in but not an admin** → an "unauthorized" screen. Because the layout sets
   `requiredRole="admin"`, a signed-in `viewer` (the default) is blocked here — signing in
   alone does **not** grant admin access.
5. **Authorized (`role: 'admin'`)** → renders the admin shell.

Protected routes: `/admin`, `/admin/products`, `/admin/categories`, `/admin/brands`,
`/admin/settings`, and anything else added under `/admin`.

### The login route

- [`/login`](src/app/login/page.tsx) is wrapped in its own `AuthProvider` and is **skipped
  by the storefront chrome** ([`site-chrome.tsx`](src/components/layout/site-chrome.tsx))
  so it renders as a standalone, branded, centered screen.
- If an **already-authenticated** admin visits `/login`, they're redirected to `/admin`.

---

## 4. Roles & admin access runbook

### How roles work

- Roles are `'admin' | 'editor' | 'viewer'` ([`roles.ts`](src/lib/auth/roles.ts)), ranked by
  privilege (`admin` > `editor` > `viewer`). `hasRole(userRole, required)` centralizes checks.
- A user's role comes from a **Firebase custom claim** (`{ role: 'admin' }`) on their ID
  token, which is **signed by Firebase** and **cannot be forged client-side**.
- **Absent a claim, an authenticated user is a `viewer`** (`DEFAULT_ROLE`). A `viewer` has
  **no admin access**: they are redirected/blocked at `/admin` and denied every write by the
  Firestore rules. **Signing in is never enough — only the `role: 'admin'` claim grants
  access.**
- Two layers enforce this, and they agree:
  - **UI gate** — `<ProtectedRoute requiredRole="admin">` in
    [`admin/layout.tsx`](src/app/admin/layout.tsx). A UX convenience only.
  - **Data boundary (authoritative)** — the `isAdmin()` function in
    [`firestore.rules`](firestore.rules) checks `request.auth.token.role == 'admin'` on every
    catalogue/CMS/order write. This is the real security boundary — the client gate is a UX
    convenience, while the rules are enforced by Firebase server-side.

### Prerequisites for managing roles

Custom claims can **only** be set from a trusted server environment (never the browser). You
need the **Firebase Admin SDK** with a service-account key:

1. In the Firebase console: **Project settings → Service accounts → Generate new private
   key**. Save the JSON somewhere safe and **never commit it**.
2. Point the SDK at it:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
   npm install firebase-admin   # in a throwaway/admin workspace, not the app bundle
   ```

Save the helper script below as `scripts/set-role.js` (run with `node scripts/set-role.js …`).
It is a **developer/ops tool** — keep it out of the deployed static bundle.

```js
// scripts/set-role.js — assign or clear a user's role via custom claims.
// Usage:
//   node scripts/set-role.js <email> admin     # grant admin
//   node scripts/set-role.js <email> viewer    # demote to viewer (removes admin)
//   node scripts/set-role.js <email> --clear   # remove all role claims
const admin = require('firebase-admin');
admin.initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS

const [email, role] = process.argv.slice(2);
const VALID = ['admin', 'editor', 'viewer'];

(async () => {
  if (!email || !role) throw new Error('Usage: set-role.js <email> <admin|editor|viewer|--clear>');
  const user = await admin.auth().getUserByEmail(email);

  const claims = role === '--clear' ? null : { ...user.customClaims, role };
  if (role !== '--clear' && !VALID.includes(role)) throw new Error(`Unknown role: ${role}`);

  await admin.auth().setCustomUserClaims(user.uid, claims);
  // Force the user's existing tokens to refresh so the new claim takes effect.
  await admin.auth().revokeRefreshTokens(user.uid);
  console.log(`Set role=${role} for ${email} (${user.uid}). They must sign in again.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

> **Claims are not instant on already-signed-in sessions.** A user's role only changes when
> a **fresh ID token** is minted. The script calls `revokeRefreshTokens()` to force this, but
> the user must **sign out and back in** (or wait up to ~1 hour for the token to refresh) for
> the change to take effect in the browser. On the client you can force it with
> `getIdToken(true)`.

### 4a. Create the **first** admin

There is no bootstrap admin — the very first one is created by hand:

1. Create the account (Firebase console → **Authentication → Users → Add user**, or Admin SDK
   `createUser`, per §1).
2. Grant the claim from your trusted environment:
   ```bash
   node scripts/set-role.js admin@bluebuy.com admin
   ```
3. Have them sign in at [`/login`](src/app/login/page.tsx). They now reach `/admin`.

That first admin does **not** get any special power to mint other admins from the UI — role
management stays server-side (§4b). This is deliberate: there is no in-app "make admin"
control at all.

### 4b. Assign the admin role to an existing user

```bash
node scripts/set-role.js person@bluebuy.com admin
```

Then tell them to sign out and back in. Verify with:

```bash
node -e "require('firebase-admin').initializeApp(); \
  require('firebase-admin').auth().getUserByEmail('person@bluebuy.com') \
  .then(u => console.log(u.customClaims))"
# → { role: 'admin' }
```

### 4c. Remove the admin role

Demote to `viewer` (keeps the login, drops all admin access), or clear the claim entirely:

```bash
node scripts/set-role.js person@bluebuy.com viewer   # demote — recommended
node scripts/set-role.js person@bluebuy.com --clear  # remove all role claims
```

`revokeRefreshTokens()` (called by the script) **immediately invalidates their existing
sessions**, so the next request forces a re-login and the reduced role. To also disable the
account entirely, use **Authentication → Users → Disable account** in the console.

### 4d. Add future staff

Decide the least-privileged role that fits, then assign it:

| They should…                                 | Give them | Command                                  |
| -------------------------------------------- | --------- | ---------------------------------------- |
| Run the whole store (catalogue, CMS, orders) | `admin`   | `node scripts/set-role.js name@… admin`  |
| Browse only, no admin access (default)       | `viewer`  | _(nothing — this is the default)_        |
| Future content-only role (see note)          | `editor`  | `node scripts/set-role.js name@… editor` |

- The current Firestore rules recognize **only `admin`** for writes; `editor`/`viewer` have
  no write access today. `editor` exists in the type system so a content-only tier can be
  added later **without reworking auth** — you'd add an `isEditor()` helper to the rules and
  gate a subsection with `<ProtectedRoute requiredRole="editor">`.
- **Onboarding checklist:** create the account (§1) → assign the role (`set-role.js`) → share
  `/login` → confirm they can (or can't) reach `/admin` as intended.
- **Offboarding:** run §4c **and** disable/delete the Firebase Auth user.

---

## 5. Security notes

- **No secrets in the repo.** All Firebase config comes from `NEXT_PUBLIC_FIREBASE_*` env
  vars. The Web API key is not a secret; access control is Firebase's job.
- **Security Rules are the boundary, not client state.** `ProtectedRoute` is a UX
  convenience; data access is enforced by [Firebase Security Rules](firestore.rules) whose
  `isAdmin()` helper verifies `request.auth.token.role == 'admin'` on every write. A signed-in
  `viewer` gets **permission denied** from Firestore regardless of the UI.
- **Roles live only in custom claims.** They are set server-side with the Admin SDK (§4),
  signed by Firebase, and are not settable from the browser — there is no in-app path to
  change your own role.
- **No account enumeration.** Sign-in errors are deliberately vague
  ("Incorrect email or password") rather than revealing whether an account exists.
- **No public sign-up** and **email/password only** — no social providers.

## 6. Request protection (App Check)

BlueBuy is a **static export with no backend and no customer accounts**, so checkout writes
happen in the browser as an anonymous user (two scoped Firestore writes: create a `pending`
order, and decrement product stock — see [`firestore.rules`](firestore.rules)). These writes
are validated by Security Rules for shape, and **Firebase App Check** adds request
attestation on top so that only requests coming from your app are accepted.

**Firebase App Check** attaches a reCAPTCHA-backed token to every Firestore request. Once
enforcement is enabled, requests without a valid token are rejected before the rules run. The
client wiring lives in [`src/firebase/app-check.ts`](src/firebase/app-check.ts) and is a
**no-op until you set a site key**, so nothing changes until you deliberately enable it.

### Enabling App Check (recommended before launch)

1. Create a **reCAPTCHA v3** site key at <https://www.google.com/recaptcha/admin>, allowlisting
   your production domain **and `localhost`**. Put the _site_ key in
   `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (`.env.local`).
2. Firebase console → **App Check** → register the web app with that reCAPTCHA provider.
3. **Dev:** run the app, then console → App Check → _Manage debug tokens_; register the token
   the SDK prints and set `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` so localhost gets a valid token.
4. Roll out in **"monitor"** mode, confirm tokens are flowing for Firestore, **then switch to
   "enforce."** Enforcing before the client sends tokens would lock out your own app.

> App Check is free-plan compatible and is the recommended request-protection layer for this
> serverless setup. If the project later moves to a backend plan, order processing can be
> centralized in a Cloud Function for fully server-side validation — see
> _Future: server-side order processing_ in [`ORDER_MANAGEMENT.md`](ORDER_MANAGEMENT.md).
