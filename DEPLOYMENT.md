# BlueBuy — Production Deployment Guide

Deploy target: **GitHub Pages** (static export via GitHub Actions)
Repository: **`usamaazam10/BlueBuy`** (project site)
Canonical URL: **https://bluebuy.store/** (apex + `www`)
Default Pages URL: **https://usamaazam10.github.io/BlueBuy/** — 301-redirects to the
custom domain. GitHub does this automatically whenever a custom domain is set; the
project-site URL cannot serve content independently while `bluebuy.store` is configured.

This guide is the operational runbook. Everything that could be automated has been
done (build config, static-export hardening, CI workflow, verification). The steps
below are the parts that require your GitHub account, DNS registrar access, or
credentials — they cannot be performed on your behalf.

---

## 0. Current status at a glance

| Item                                                                                                   | Status                                                                                    |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `next.config.ts` static export (`output: 'export'`, `images.unoptimized`, `basePath`, `trailingSlash`) | ✅ Verified                                                                               |
| `npm run lint`                                                                                         | ✅ Pass (no warnings/errors)                                                              |
| `npm run typecheck`                                                                                    | ✅ Pass                                                                                   |
| `npm run build` (static export → `out/`)                                                               | ✅ Pass — 28 routes, `404.html`, `.nojekyll`, base-path-prefixed assets                   |
| GitHub Actions workflow (`.github/workflows/deploy.yml`)                                               | ✅ Reviewed & hardened (Node 22, npm cache, Pages deploy)                                 |
| Empty-catalog build resilience                                                                         | ✅ Fixed — build no longer hard-fails when the `products` collection is empty/unreachable |
| Git remote                                                                                             | ❌ **Not configured** — must be added (see §2)                                            |
| `gh` CLI                                                                                               | ❌ **Not installed** — optional; plain `git` works (see §2)                               |
| GitHub repository secrets                                                                              | ⚠️ **Must be set** before the first CI build (see §3)                                     |
| Pages "Source = GitHub Actions"                                                                        | ⚠️ **Must be enabled** in repo Settings (see §4)                                          |
| Custom domain DNS (GoDaddy)                                                                            | ⚠️ **Manual** — records below (see §6)                                                    |
| Production catalog data                                                                                | ⚠️ **The `products` collection is currently EMPTY** — see §7                              |

---

## 1. Blockers that require you (cannot be automated from here)

1. **No git remote is configured** and there are **no push credentials** in this
   environment. Creating/pushing to `github.com/usamaazam10/BlueBuy` needs your
   authenticated GitHub account. Commands are in §2.
2. **The `gh` CLI is not installed** here, so I cannot create the repo, set secrets,
   or watch the Actions run programmatically. Plain `git` + the GitHub web UI cover
   everything; optional `gh` commands are provided as a convenience.
3. **Repository secrets and Pages settings** live in the GitHub UI and require your
   login (§3, §4).
4. **DNS records** must be entered in your GoDaddy account (§6).

Local changes have been **committed to `main`** so that a single `git push` ships
everything once the remote exists.

---

## 2. Create the remote & push

Using plain git (works today, no extra tools):

```bash
cd /Users/usamaazam/BlueBuy

# Create the repository on github.com first (web UI: New repository →
# owner "usamaazam10", name "BlueBuy"), then:
git remote add origin https://github.com/usamaazam10/BlueBuy.git
git push -u origin main
```

Or, if you install and authenticate the GitHub CLI (`brew install gh && gh auth login`):

```bash
gh repo create usamaazam10/BlueBuy --private --source=. --remote=origin --push
```

Pushing to `main` automatically triggers the **Deploy to GitHub Pages** workflow.

---

## 3. Required GitHub repository secrets (checklist)

Set these in **GitHub → repo → Settings → Secrets and variables → Actions → New
repository secret**. Values are pulled from your local `.env.local` (do not paste
secrets into chat, commits, or issues). All are `NEXT_PUBLIC_*` — they are **inlined
into the static bundle at build time** and are not secret in the cryptographic sense
(Firebase/Cloudinary access is enforced by Security Rules and the upload preset, not
by hiding these). They are stored as Actions secrets purely to keep them out of the
repo.

**Required — the build/site is broken without these:**

- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- [ ] `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

**Recommended:**

- [ ] `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` — only if Google Analytics is enabled.
- [ ] `NEXT_PUBLIC_STORE_WHATSAPP` — post-order "Contact on WhatsApp" handoff. Digits
      only, international format, no `+` (e.g. `15551234567`). Falls back to a
      placeholder if unset.

**Optional (App Check — recommended for production checkout hardening):**

- [ ] `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — reCAPTCHA v3 site key. Leave unset to ship
      with App Check **disabled** (the code no-ops on an empty value). Set it once
      you register the site in Firebase console → App Check. See `AUTHENTICATION.md`.

**Provided automatically by the workflow — do NOT create these as secrets:**

- `NEXT_PUBLIC_BASE_PATH` — **empty**, because the site is served from the root of
  `bluebuy.store`. Pinned in the workflow, not auto-detected.
- `NEXT_PUBLIC_SITE_URL` — `https://bluebuy.store`. Pinned in the workflow.

Both can be overridden with repository **variables** (Settings → Secrets and variables
→ Actions → **Variables**, not Secrets) if the site ever moves: set `SITE_BASE_PATH`
and `SITE_URL`.

> Never add server/admin secrets here. The Firebase **Admin SDK service-account JSON**
> (`*-firebase-adminsdk-*.json`) is git-ignored and must never be committed or added
> as an `NEXT_PUBLIC_*` value — this app has no server and does not use it at runtime.

---

## 4. Enable GitHub Pages (Actions source)

1. GitHub → repo → **Settings → Pages**.
2. **Build and deployment → Source → "GitHub Actions"**.
3. That's it — the included workflow (build → `upload-pages-artifact` → `deploy-pages`)
   publishes `out/`. No branch (`gh-pages`) is used.

Each successful run publishes to **https://bluebuy.store/**.

---

## 5. The deployment workflow (what runs)

`.github/workflows/deploy.yml` — triggered on push to `main`, on an **hourly
schedule**, and via manual `workflow_dispatch`:

- **Node 22** (Active LTS) with **npm dependency caching** (`cache: npm`).
- `npm ci` (reproducible install from the lockfile).
- `NEXT_PUBLIC_BASE_PATH` (empty) and `NEXT_PUBLIC_SITE_URL` (`https://bluebuy.store`)
  are **pinned in the workflow**. They were previously derived from
  `actions/configure-pages@v5`, which kept reporting the project-site values
  (`/BlueBuy` + `github.io`) after the custom domain went live — every asset then
  resolved to `/BlueBuy/_next/…`, 404'd on the apex domain, and the site rendered as
  unstyled HTML. Pinning them removes that failure mode.
- Production build: `npm run build` (fails on type/lint errors — no `ignoreBuildErrors`).
- `public/CNAME` (`bluebuy.store`) ships in the artifact so the custom domain survives
  redeploys.
- `actions/upload-pages-artifact@v3` uploads `./out`.
- `actions/deploy-pages@v4` deploys, with `concurrency: pages` so runs don't overlap.

### 5.1 Why it also runs hourly

Product pages are **prerendered at build time** from Firestore
([`generateStaticParams`](src/app/product/[slug]/page.tsx) with
`dynamicParams = false`), so the static export only contains the products that
existed during the last build. A product created in the admin afterwards has no
page, and **its public URL 404s until the site is rebuilt** — the admin and
in-app navigation read Firestore live, so only the direct static URL lags.

The `schedule: '0 * * * *'` trigger closes that gap: new products go live within
the hour with no manual deploy. Need one sooner? **Actions → Deploy to GitHub
Pages → Run workflow**.

> GitHub disables scheduled workflows on a repository with no activity for 60
> days. They re-enable on the next push, or via the Actions tab.

---

## 6. Custom domain — `bluebuy.store` (GoDaddy DNS)

Because `usamaazam10/BlueBuy` is a **project** repo, once the custom domain is set,
GitHub serves the site at the **apex root** (`https://bluebuy.store/`) — the
`/BlueBuy` subpath is dropped, and requests to the github.io URL are 301-redirected to
`https://bluebuy.store/`. The workflow builds with an **empty base path** to match.

### 6.1 GoDaddy DNS records — enter these exactly

In GoDaddy: **My Products → DNS → Manage DNS** for `bluebuy.store`. First **delete**
GoDaddy's default parked `A @` record and the default `CNAME www → @`/forwarding, then
add:

| Type  | Name (Host) | Value                   | TTL |
| ----- | ----------- | ----------------------- | --- |
| A     | `@`         | `185.199.108.153`       | 600 |
| A     | `@`         | `185.199.109.153`       | 600 |
| A     | `@`         | `185.199.110.153`       | 600 |
| A     | `@`         | `185.199.111.153`       | 600 |
| AAAA  | `@`         | `2606:50c0:8000::153`   | 600 |
| AAAA  | `@`         | `2606:50c0:8001::153`   | 600 |
| AAAA  | `@`         | `2606:50c0:8002::153`   | 600 |
| AAAA  | `@`         | `2606:50c0:8003::153`   | 600 |
| CNAME | `www`       | `usamaazam10.github.io` | 600 |

These four A IPs and four AAAA IPs are GitHub Pages' **published, fixed** anycast
addresses — they are the same for every Pages site, not guessed. The `www` CNAME
points at the **user** subdomain (`usamaazam10.github.io`), never at the repo.

> **Optional — domain verification (prevents takeovers).** GitHub → your **profile**
> Settings → **Pages → "Add a domain"** shows a one-time `TXT` record named
> `_github-pages-challenge-usamaazam10` with a unique value. That value is generated
> by GitHub and can't be pre-filled here — copy it from that screen and add it as a
> `TXT` record in GoDaddy (`Name: _github-pages-challenge-usamaazam10`).

### 6.2 Set the domain in the repo

Repo → **Settings → Pages → Custom domain** → enter `bluebuy.store` → **Save**.
GitHub writes a `CNAME` file into the published site and starts a DNS check.

### 6.3 Re-run the build for root base-path

After the domain check passes, trigger the workflow again (push any commit, or
**Actions → Deploy to GitHub Pages → Run workflow**) so the site rebuilds with the
empty base path and assets resolve at `https://bluebuy.store/…` instead of `/BlueBuy/…`.

### 6.4 HTTPS

Once DNS resolves and the domain is verified, repo → **Settings → Pages** → tick
**"Enforce HTTPS"**. GitHub auto-provisions a Let's Encrypt certificate (usually
minutes; can take up to ~24h). Until the cert is issued the checkbox may be greyed
out — that's expected; revisit after propagation.

---

## 7. ⚠️ Production data — the catalog is currently empty

At deploy-prep time the Firestore **`products` collection had 0 documents**
(`categories`: 1, `brands`: 2). Consequences:

- The site **builds and deploys successfully** (build hardened to tolerate an empty
  catalog — see the note below), but the **live storefront will show no products**
  until the catalog is populated.
- Product detail pages are **pre-rendered at build time**. After you add products via
  the **admin dashboard** (`/admin/products` — writes live Firestore), the interactive
  storefront reflects them immediately (client reads are live), but the **statically
  pre-rendered `/product/<slug>` pages appear only after the next build + deploy**
  (push a commit or re-run the workflow).

**Action:** Before (or right after) go-live, sign in to `/admin`, add your products,
then re-run the deploy workflow so each product ships as static HTML with per-product
SEO/JSON-LD.

> **Build hardening note:** `src/app/product/[slug]/page.tsx` previously promised (in
> its comments) to "degrade to no product pages instead of failing the whole build,"
> but `output: 'export'` rejects a dynamic route that produces **zero** static params,
> so an empty/unreachable catalog actually **hard-failed the build**. It now falls back
> to a single unreachable sentinel slug (`__no-products__`, renders the 404 and is
> emitted only in the degraded case), so the deploy pipeline stays green regardless of
> catalog state.

---

## 8. Post-deployment verification checklist

After a successful deploy, verify at `https://bluebuy.store/`:

- [ ] **Homepage** (`/`) renders with hero/banners/navigation from CMS.
- [ ] **Products listing** (`/products`) — grid loads (populated once catalog has data).
- [ ] **Product details** (`/product/<slug>`) — live product resolves; SEO/JSON-LD present.
- [ ] **Categories** — category filters populate from live Firestore.
- [ ] **Brands** — brand filters populate from live Firestore.
- [ ] **CMS content** — homepage/hero/footer/contact reflect admin CMS.
- [ ] **Admin** (`/admin`) — redirects to `/login`; sign-in works; dashboard loads.
- [ ] **Checkout** (`/checkout`) — cart prices, order creation, stock decrement.
- [ ] **Orders** — new orders appear in `/admin/orders`.
- [ ] **Images** — Cloudinary images load; `ProductMedia` SVG fallback renders when absent.
- [ ] **404 page** — an unknown URL serves the styled 404.
- [ ] **Search** — product search returns matches.
- [ ] **Filters** — category/brand/price filters narrow results.
- [ ] **Assets** — no console 404s for `_next/*` (correct base path).
- [ ] Verify **light + dark** and **mobile + desktop**.

Because the exported artifact only becomes reachable once you've pushed and the
workflow has published, this checklist is run against the live URL after §2–§4.

```

```
