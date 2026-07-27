# Order Management

Checkout and order fulfilment for BlueBuy. This document explains the order
lifecycle, the Firestore data model, how inventory is kept correct, the WhatsApp
handoff, and how a real payment gateway would slot in later.

> **No online payments.** Checkout collects contact and delivery details only.
> Payment is arranged out of band (cash on delivery / manual confirmation), with
> a one-tap WhatsApp handoff to the store after the order is placed.

## Architecture at a glance

Everything follows the repo's existing layering — components never touch
Firestore directly.

```
Checkout form ─▶ useMutation (usePlaceOrder)
                     │
                     ▼
             orderService.placeOrder()          src/services/order.service.ts
             • validate customer (zod)
             • price cart (checkout config)
             • generate order number
                     │
                     ▼
             OrderRepository.create()            src/repositories/order.repository.ts
             • Firestore transaction:
               – verify + decrement stock
               – write the order
                     │
                     ▼
                 Firestore  (orders, products)
```

| Layer          | File                                                                           | Responsibility                                                       |
| -------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Types          | [`src/types/order.ts`](src/types/order.ts)                                     | `Order`, `OrderItem`, `OrderCustomer`, `OrderStatus`, lifecycle flow |
| Validation     | [`src/lib/validations/order.schema.ts`](src/lib/validations/order.schema.ts)   | Checkout form + create-order Zod schemas                             |
| Domain helpers | [`src/lib/order/`](src/lib/order/)                                             | Pricing config, status metadata/transitions, WhatsApp message        |
| Repository     | [`src/repositories/order.repository.ts`](src/repositories/order.repository.ts) | Firestore reads/writes + the atomic inventory transaction            |
| Service        | [`src/services/order.service.ts`](src/services/order.service.ts)               | Orchestration: pricing, order-number generation, WhatsApp URL        |
| Hooks          | [`src/hooks/queries/use-orders.ts`](src/hooks/queries/use-orders.ts)           | React Query queries + mutations                                      |
| Checkout UI    | [`src/components/checkout/`](src/components/checkout/)                         | Form, validation, success screen                                     |
| Admin UI       | [`src/components/admin/orders/`](src/components/admin/orders/)                 | Orders table, detail drawer, status controls                         |

## Order lifecycle

An order moves through six states. The flow is defined once in
[`ORDER_STATUS_FLOW`](src/types/order.ts) and enforced in the repository —
an order can never skip or reverse states.

```
pending ──▶ confirmed ──▶ packed ──▶ shipped ──▶ delivered
   │            │            │           │
   └────────────┴────────────┴───────────┘
                     ▼
                 cancelled            (terminal)
```

- **pending** — the state every order starts in when placed at checkout.
- **confirmed** — the store has confirmed the order (e.g. via the WhatsApp chat).
- **packed** — items packed and ready to dispatch.
- **shipped** — handed to the courier.
- **delivered** — received by the customer. **Terminal.**
- **cancelled** — reachable from any non-delivered state. **Terminal.**

`delivered` and `cancelled` are terminal (no further transitions). Every
non-terminal state can also be cancelled. Status labels, descriptions and badge
colours live in [`src/lib/order/status.ts`](src/lib/order/status.ts);
`canTransition()` / `nextStatuses()` gate what the admin can do.

Only **authenticated admins** update status. The customer-facing surface can
place an order but never mutate one. See [Security](#security).

## Firestore structure

Orders live in the top-level `orders` collection
(`COLLECTIONS.orders` in [`src/types/models.ts`](src/types/models.ts)). The
Firestore **document id equals the human-facing `orderId`**, so an order is
addressable by its number with no secondary lookup.

```
orders/{orderId}
  orderId    : string        // e.g. "BB-260725-4F7A" (== document id)
  customer   : {
    fullName : string
    phone    : string
    email?   : string        // omitted when not provided
    city     : string
    address  : string
    notes?   : string        // omitted when not provided
  }
  items      : [
    {
      productId : string      // → products/{id}
      slug      : string
      title     : string
      image?    : string      // captured at purchase time
      accent    : string
      unitPrice : number      // price snapshot at purchase time
      quantity  : number
      lineTotal : number      // unitPrice × quantity
    }
  ]
  subtotal   : number
  shipping   : number
  discount   : number
  total      : number         // subtotal − discount + shipping
  currency   : string         // ISO 4217, e.g. "USD"
  status     : OrderStatus
  createdAt  : Timestamp       // serverTimestamp()
  updatedAt  : Timestamp       // serverTimestamp()
```

Key modelling decisions:

- **Snapshots, not references.** Each `items[]` entry captures the product's
  title, price and image at purchase time (mirroring the cart in
  [`src/types/cart.ts`](src/types/cart.ts)). An order always renders and totals
  correctly regardless of later catalogue edits, and the customer is charged
  exactly what they saw.
- **Money is stored, not recomputed.** `subtotal`/`shipping`/`discount`/`total`
  and each `lineTotal` are persisted, so an order is a self-verifying record.
- **Pricing parity.** Totals are produced by the same pure engine the cart uses
  ([`src/lib/cart/pricing.ts`](src/lib/cart/pricing.ts)) fed the checkout config
  ([`src/lib/order/config.ts`](src/lib/order/config.ts)) — the number stored is
  the number the customer saw on the summary.

### Order numbers

Generated in the service as `BB-YYMMDD-XXXX` (date prefix + 4-char random
suffix), e.g. `BB-260725-4F7A`. Date-prefixed for at-a-glance recency; the
random suffix keeps same-day orders distinct. The creation transaction rejects
the astronomically-unlikely collision, so numbers are effectively unique.

## Inventory updates

Stock is decremented **atomically with order creation** inside a single
Firestore transaction ([`OrderRepository.create`](src/repositories/order.repository.ts)):

1. **Read** every referenced `products/{id}` document.
2. **Validate** that each product exists and `stock >= quantity`. If any line
   fails, the transaction throws and **nothing is written** — no order, no stock
   change.
3. **Write** the decremented `stock` for each product, then create the order.

Because reads and writes share one transaction, two shoppers racing for the last
unit can't both succeed — Firestore retries the loser against fresh data and it
correctly fails the stock check.

**Preventing checkout on insufficient stock:**

- The cart clamps quantities to the stock snapshot captured at add-time
  (`maxQuantity` in [`src/types/cart.ts`](src/types/cart.ts)).
- The transaction is the **authoritative** guard: if stock dropped between
  adding to cart and checking out, `placeOrder` rejects with a friendly
  `AppError` (e.g. _"Only 2 of 'Aura Headphones' left in stock."_) and the
  checkout surfaces it inline. No order is created and no stock is touched.

> **Note:** Cancelling an order does **not** auto-restore stock. Manual
> restock (or an explicit "restock on cancel" step) is a deliberate follow-up —
> flagged in the cancel confirmation dialog.

## WhatsApp integration

After a successful order, the success screen offers a **Contact on WhatsApp**
button. It builds a `https://wa.me/<number>?text=<message>` deep link
([`src/lib/order/whatsapp.ts`](src/lib/order/whatsapp.ts)) with a pre-filled,
URL-encoded message containing everything the store needs:

```
Hi! I'd like to confirm my BlueBuy order.

Order: BB-260725-4F7A
Name: Jane Cooper
Phone: +1 555 123 4567

Items:
• Aura Wireless Headphones × 1 — $199
• Nomad Backpack × 2 — $118

Total: $323.95
```

The store number comes from `NEXT_PUBLIC_STORE_WHATSAPP` (digits only, in
international format — e.g. `15551234567`), read via
[`src/lib/env.ts`](src/lib/env.ts). A placeholder is used until it's configured.

## Security

- **Admin routes are gated.** `/admin/*` is wrapped by `AuthProvider` +
  `ProtectedRoute` ([`src/app/admin/layout.tsx`](src/app/admin/layout.tsx)),
  so unauthenticated users are redirected to `/login` before any orders UI
  renders. Customers never reach admin routes.
- **Status updates are admin-only.** The UI only exposes status controls inside
  the gated admin. The **true** enforcement point is Firestore Security Rules —
  the client SDK is not trusted.

### Deploying the rules

The complete ruleset lives in [`firestore.rules`](firestore.rules) with
[`firebase.json`](firebase.json) / [`.firebaserc`](.firebaserc) already wired to
the `bluebuy-production` project. Deploy it (rules aren't applied until you do):

```bash
firebase login          # once, if needed
firebase deploy --only firestore:rules
```

> Deploying **replaces** the rules currently in the Firebase Console. The file
> covers everything this app does; review it against your console rules first if
> you've added anything there.

The key clauses (admin access is a server-set `role: 'admin'` custom claim, via
`isAdmin()` — see [`AUTHENTICATION.md`](AUTHENTICATION.md)):

```
// Orders — order docs hold customer PII, so they are never publicly readable.
match /orders/{orderId} {
  allow get, list, update, delete: if isAdmin();              // admins only
  allow create: if request.resource.data.status == 'pending' // customers
    // locked to the exact fields + bounded customer/money values the
    // checkout writes (full clause in firestore.rules).
}

// Products — public read; admins write; a checkout write may ONLY decrement
// stock (never raise it or touch other fields).
match /products/{productId} {
  allow read: if true;
  allow create, delete: if isAdmin();
  allow update: if isAdmin()
    || (
      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['stock', 'updatedAt'])
      && request.resource.data.stock is number
      && request.resource.data.stock >= 0
      && request.resource.data.stock < resource.data.stock
    );
}
```

**Why customers never read orders:** `OrderRepository.create` deliberately does
**not** read the order back after writing it — it returns the value it just
wrote. That keeps the whole `orders` collection admin-only for reads, so no
buyer's name/phone/address is ever exposed by knowing an order number. Admin
access comes only from the `role: 'admin'` custom claim (`DEFAULT_ROLE` is
`viewer` in [`src/lib/auth/roles.ts`](src/lib/auth/roles.ts)); signing in alone
grants no write access.

**Request protection (App Check).** Because the app is a static export with no
server, checkout writes run in the browser as an anonymous user (two scoped
allowances: create a `pending` order; decrement stock). Enabling **Firebase App
Check** attaches a bot-mitigation token to these requests so only your app can
perform them — see the App Check section in
[`AUTHENTICATION.md`](AUTHENTICATION.md). The client wiring lives in
[`src/firebase/app-check.ts`](src/firebase/app-check.ts) and is a no-op until a
reCAPTCHA site key is configured.

## Future: server-side order processing (backend plan)

When the project moves to a plan with a server runtime (Firebase **Blaze** /
Cloud Functions), order creation can be centralized server-side for stronger
validation and business logic — kept here so the path is ready:

1. **Add a `placeOrder` Cloud Function** (Admin SDK). It receives
   `{ customer, items: [{ productId, quantity }] }` — **not** prices or totals —
   reads each product from Firestore, computes the totals server-side with the
   same pricing config, then creates the order and decrements stock inside one
   Admin-SDK transaction (which runs with full privileges).
2. **Point the client at it.** Have `orderService.placeOrder` call the callable
   (`httpsCallable(getFunctions(app), 'placeOrder')`) instead of writing via
   `OrderRepository.create`; map the returned order to the `Order` type.
3. **Simplify the rules.** With writes going through the trusted function, set
   the two anonymous allowances (order `create`, product stock `update`) to
   `if false` — the Admin SDK runs with full privileges (above rules), so
   checkout keeps working while the collections become write-closed to clients.

The repository/service/hook boundaries mean only `order.service.ts` and
`firestore.rules` change; the UI is untouched.

## Future payment-gateway integration

The flow is intentionally payment-agnostic. To add online payments (Stripe,
etc.) with **minimal churn**:

1. **Add a payment step at checkout.** After validating the form, create a
   `PaymentIntent`/session (server-side — a Cloud Function or a real backend,
   since this app is a static export with no server runtime). Collecting card
   details must happen in the provider's hosted/Elements UI, never in our own
   inputs.
2. **Extend the order model.** Add `paymentStatus` (`unpaid | paid | refunded`),
   `paymentMethod`, and a `paymentRef` (provider id) to
   [`src/types/order.ts`](src/types/order.ts) and the create schema. Keep
   `status` (fulfilment) separate from `paymentStatus` (money) — they're
   orthogonal concerns.
3. **Create the order after payment authorises.** Move `orderService.placeOrder`
   behind the payment callback/webhook so stock is only decremented once payment
   is confirmed. The existing transaction is reused unchanged.
4. **Handle webhooks server-side** for `payment_succeeded` / `refunded` to flip
   `paymentStatus` and, on failure, release any reserved stock.
5. **Keep WhatsApp as an optional channel** for support/COD alongside online
   payment — it doesn't need to be removed.

The repository/service/hooks boundaries mean the UI and data-access layers
barely change: the new work is a payment adapter plus a couple of fields.
