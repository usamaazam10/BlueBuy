# Business Operations

How BlueBuy tracks stock, cost, cash and profit — the accounting decisions behind
the admin's business dashboards, and what an operator has to do to keep the
numbers true.

Read [`CLAUDE.md`](CLAUDE.md) first for the app's architecture; this document
covers only the business-operations layer added on top of it.

---

## 1. The rule that shapes everything

> **A number is either measured or it is absent. It is never invented.**

Where a figure cannot be computed from recorded data, the dashboard shows
"Not enough data" or "Insufficient cost data" — never `0`, never a placeholder,
never a trend derived from a period that has no history. This is enforced in
code, not by convention:

- Calculation functions return `null` for unknown, distinct from `0` for zero
  ([`src/lib/business/costing.ts`](src/lib/business/costing.ts)).
- `compare()` returns `status: 'unavailable'` when the previous period holds no
  data, and refuses a percentage when the previous value was zero
  ([`metrics.ts`](src/lib/business/metrics.ts)).
- `MetricCard` renders a distinct "Not enough data" state for `null`
  ([`metric-card.tsx`](src/components/admin/business/metric-card.tsx)).
- `BreakdownTable` renders `null` cells as "—" with an explanatory tooltip.

---

## 2. Cost basis — weighted average cost (WAC)

### Why WAC and not FIFO

FIFO and LIFO require tracking individual cost layers and consuming them in
order, which needs a serialised server-side writer to stay correct under
concurrent sales. BlueBuy has **no server runtime** — it is a static export, and
the checkout decrements stock from an unauthenticated browser. WAC needs one
running number per product, is order-independent, and converges to the same
total cost over a product's life. It is the method that stays correct in this
architecture rather than one that quietly goes wrong.

### The formula

Each receipt folds its cost into the running average:

```
newAverage = (stockOnHand × currentAverage + qtyReceived × unitCost)
             ─────────────────────────────────────────────────────
                          stockOnHand + qtyReceived
```

Sales do **not** change the average — they consume units at it.

Implemented once in `applyReceipt()`
([`costing.ts`](src/lib/business/costing.ts)), covered by
[`costing.test.ts`](src/lib/business/costing.test.ts), and applied inside the
receiving transaction.

### Cost basis precedence

1. `product.averageCost` — maintained by receipts. The real basis.
2. `product.lastPurchaseCost` — a product received before averages were tracked.
3. `product.costPrice` — a figure the operator typed in by hand.
4. **`null` → unknown.** Reported as insufficient cost data, never as free stock.

A product received with no prior average adopts the receipt cost for its whole
on-hand quantity (the standard treatment when opening a basis mid-life); the
receipt records this via `establishedBasis`.

---

## 3. COGS — captured, never recomputed

An order's cost of goods is **snapshotted onto the order** when an admin captures
it, and never recalculated:

```ts
order.costing = { method, lines[], totalCost, complete, capturedAt, capturedBy }
```

Buying the same product cheaper next month must not retroactively improve last
month's profit. Once captured, `applyCosting` refuses to overwrite the snapshot
unless explicitly forced.

Lines whose product has no cost basis are **omitted** and `complete: false` is
recorded. `cogsSummary()` then reports coverage, and the P&L labels itself
`partial` rather than presenting an understated cost as fact.

**Operator action required:** capture costs on orders. Until you do, profit reads
"Not enough data".

---

## 4. The inventory ledger

`inventory_movements` is an **append-only** record of every stock change. Nothing
in the app edits or deletes a movement; corrections are made by writing a
compensating `correction` movement.

| Movement                                 | Written by                       | Atomic with                           |
| ---------------------------------------- | -------------------------------- | ------------------------------------- |
| `purchase_received`                      | Receiving goods                  | Stock increase + cost basis + receipt |
| `sale`                                   | Admin (cost capture / reconcile) | The `saleMovementsRecorded` flag      |
| `return` / `correction`                  | Cancelling or returning an order | The status change + the stock restore |
| `adjustment` `damaged` `lost` `transfer` | Manual adjustment                | The stock change                      |

### Why sale movements are posted by an admin

Checkout decrements stock from an unauthenticated browser. Rather than grant the
public storefront write access to a business ledger, the ledger entry is posted
by an authenticated admin action — capturing costs, or **Inventory → Post sale
entries**. Both are idempotent via the order's `saleMovementsRecorded` flag, set
inside the same transaction that writes the movements, so it can never
double-post.

Trade-off: a sale movement's `stockAfter` is the level at posting time, not the
instant of sale. Accepted deliberately — the alternative was opening an anonymous
write path into financial records.

### Closing an order is one transaction

Cancelling or returning an order moves **three** things that must agree, so
`OrderRepository.closeWithRestock` does all of them in a single transaction: the
status, the stock, and the ledger entries.

Crucially it posts the order's `sale` movements first if they were never
captured. Without that the restore's `+n` had no matching `−n` — and because
`reconcileSaleMovements` deliberately skips cancelled orders, the ledger drifted
away from `stock` permanently with no way to reconcile it. Doing all three
together also means a user who lacks permission to write stock changes _nothing_,
rather than flipping the status and silently failing to restock.

### Returns: restock or write off

A return has two possible inventory outcomes and the system does not guess. The
operator chooses:

- **Back to sellable stock** — a `return` movement adds the units back.
- **Write off** — the sale stays in the ledger and the units never come back.

Both record the sale, so the ledger reconciles either way. Only the first raises
the stock level.

### Stock semantics

Because checkout decrements at order placement, `product.stock` **is** the
available-to-sell figure.

```
available = product.stock                    (what you can still sell)
reserved  = units on open, unshipped orders  (sold, still on the shelf)
on hand   = available + reserved
```

`reserved` and `available` are **derived, never stored** — storing them would
create a second source of truth that drifts from the orders themselves.

---

## 5. Purchases: receiving ≠ paying

Two separate events, deliberately decoupled because they routinely happen days
apart, and conflating them makes the cash balance wrong.

- **Receiving goods** raises stock, updates WAC, writes movements and an
  immutable `purchase_receipts` document. Writes **no cash**.
- **Recording a payment** writes a cash outflow. Changes **no stock**.

Creating or "placing" a purchase order changes nothing at all. **Stock rises only
when goods are recorded as received.**

Receiving runs in one Firestore transaction
([`purchase.repository.ts`](src/repositories/purchase.repository.ts)): all reads,
then product stock + cost, movements, the receipt, and the PO's per-line
`quantityReceived`. Either everything commits or nothing does — which is what
guarantees a receipt can never raise stock twice, and that a partial receipt is
exact.

---

## 6. Cash flow ≠ revenue

Revenue is recognised when an **order is placed**. Cash is recorded when **money
moves**. On a cash-on-delivery business these are routinely weeks apart.

`cash_transactions` is append-only. Balances:

```
opening  = net of every transaction strictly before the period
net      = inflows − outflows within the period
closing  = opening + net
```

Cash entries are written automatically by: customer payments, supplier payments,
refunds, and paid expenses. Manual entries cover owner drawings, capital
injections and other income.

**Correcting a cash entry** means writing a reversing entry — there is no update
or delete, in the repository or in the security rules.

---

## 7. Profit

```
  Net sales              (gross sales − discounts − refunds)
− Cost of goods sold     (captured per order, WAC basis)
─────────────────────
= Gross profit
− Operating expenses     (excludes inventory purchases)
− Delivery costs         (courier charges recorded on orders)
─────────────────────
= Operating profit
```

Three rules this enforces:

1. **Inventory purchases are not an operating expense.** Money spent on stock
   becomes COGS when that stock _sells_. Expenses flagged
   `isInventoryProcurement` are excluded from operating expenses — including them
   would double-count against COGS and understate profit, sometimes wildly.
2. **Profit is withheld when its inputs are unknown.** `dataQuality` is
   `complete` / `partial` / `unavailable`, and the UI renders the reason.
   A captured snapshot that resolved **no** cost lines counts as _unknown_, not
   as a cost of zero — otherwise the P&L reports gross profit equal to net sales
   and prints a 100% margin, which is exactly the fabrication rule 1 of §1
   forbids.
3. **Delivery is a real cost, counted once.** Courier charges recorded on orders
   are subtracted. Because a shop may _also_ file the courier's invoice as an
   expense, `deliveryCostNote` warns when both appear in one period instead of
   silently double-counting.

Shipping charged to customers is **not** in net sales — it offsets a delivery
cost rather than being product revenue. It is reported separately.

---

## 8. Data model

New collections (all private — see § 10):

| Collection            | Purpose                             | Mutability             |
| --------------------- | ----------------------------------- | ---------------------- |
| `suppliers`           | Vendor directory                    | Editable               |
| `purchase_orders`     | What was ordered                    | Editable while `draft` |
| `purchase_receipts`   | What actually arrived, at what cost | **Append-only**        |
| `inventory_movements` | Every stock change                  | **Append-only**        |
| `expenses`            | Costs incurred                      | Editable / deletable   |
| `expense_categories`  | Configurable categories             | Editable               |
| `cash_transactions`   | Money that moved                    | **Append-only**        |
| `audit_logs`          | Sensitive operations                | **Append-only**        |
| `analytics_events`    | Storefront funnel events            | Reserved (§ 12)        |
| `analytics_daily`     | Precomputed rollups                 | Reserved (§ 12)        |

Existing collections (`products`, `categories`, `brands`, `orders`, CMS) are
**unchanged in shape**; new fields are additive and optional.

### Extended fields

`Product` gains `costPrice`, `averageCost`, `lastPurchaseCost`, `reorderLevel`,
`lowStockThreshold` — all optional and `null`-defaulted.

`Order` gains `costing`, `delivery`, `inventoryRestored`,
`saleMovementsRecorded`, `refundedAmount` — all optional, all admin-written. The
anonymous checkout create rule pins the exact field set a customer may write, so
none of these can be supplied at checkout.

`OrderStatus` gains `processing`, `ready_for_dispatch`, `out_for_delivery`,
`delivery_failed`, `returned`. The old transitions (`confirmed → packed`,
`packed → shipped`) are **retained**, so existing orders and operators who don't
need every stage are unaffected.

---

## 9. Migration

**No mandatory migration.** Every new field is optional and readers treat absence
as "unknown", so existing documents keep working untouched.

Two optional, idempotent backfills, both in the UI:

1. **Expense categories** — Admin → Expenses → _Create categories_. Matches on a
   stable `key`, so re-running never duplicates and never overwrites a renamed
   category.
2. **Sale movements** — Admin → Inventory → _Post sale entries_. Backfills ledger
   entries for historical orders. Guarded by `saleMovementsRecorded`.

To open a cost basis for stock bought before BlueBuy tracked purchases, set a
unit cost per product (Inventory → the coins icon). Once that product is received
on a purchase order, WAC takes over.

### Deployment steps

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Both files changed and **must be deployed** — without the rules the new
collections are inaccessible; without the indexes a few queries will fail with a
console link to create them.

---

## 10. Security

Nothing in the business layer is publicly readable. Customers cannot read
supplier terms, purchase costs, expenses, cash, margin or the audit log — the
storefront never requests them, and the rules refuse them.

The four financial ledgers allow `create` to the appropriate role and
`update`/`delete` **to nobody at all**, including owners. History that can be
quietly rewritten is not history.

### Roles

Capabilities live in [`permissions.ts`](src/lib/auth/permissions.ts) (what the UI
shows) and are enforced in [`firestore.rules`](firestore.rules) (what Firestore
serves). **Change both together.**

| Role                | Access                                                      |
| ------------------- | ----------------------------------------------------------- |
| `owner`             | Everything, including finance, settings and the audit log   |
| `admin`             | Everything (**unchanged** from before this upgrade)         |
| `inventory_manager` | Stock, suppliers, purchases, purchase costs                 |
| `sales_manager`     | Orders, customers, sales performance — **no costs or cash** |
| `operations`        | Fulfilment only — no financial data                         |
| `editor`            | **Nothing** (legacy; see below)                             |
| `viewer`            | No dashboard access                                         |

Assign with `node scripts/set-role.cjs <email> <role>`. A role change takes
effect when the ID token refreshes — sign out and back in.

Operational roles are **opt-in**: no account holds one until you assign it, so
deploying grants nobody new access.

`editor` is deliberately granted nothing. It predates this upgrade but was never
usable (the admin gate was `hasRole(role, 'admin')`, which an editor fails).
Granting it access here would silently expand privileges for existing accounts.

### Known limitation — field-level reads

An order carries its `costing` snapshot, and **Firestore has no field-level read
rules**. A role that can read orders (any staff role) can therefore read cost data
via the SDK, even though the UI hides it from roles without `finance.view`.

If strict separation is required, move `costing` to an `orders/{id}/costing`
subcollection with its own rule and read it with a collection-group query.

---

## 11. Performance

- Every business list query is **range-scoped server-side** (`where` on the
  collection's own event-time field), so history length doesn't affect load.
- The dashboard issues **four reads** regardless of store size: one orders query
  spanning both the selected and comparison periods (split client-side), plus
  products, expenses and the cash ledger.
- All queries are cached by React Query, keyed by a stable `rangeToken`.
- Reference data (expense categories) is cached for 5 minutes; the cash ledger
  for 1 minute.

**The one unbounded read** is `CashRepository.listAll()`, needed because an
opening balance is by definition the net of all prior history. Capped at 10,000
documents. If the ledger approaches that, add monthly balance snapshots and read
`opening = snapshot + transactions since` instead.

---

## 12. Analytics

BlueBuy measures its own commerce funnel with first-party events written from the
storefront to `analytics_events`.

### What is tracked

`page_view`, `product_view`, `category_view`, `brand_view`, `search`,
`add_to_cart`, `remove_from_cart`, `checkout_started`, `checkout_completed`,
`whatsapp_click`, `contact_click`.

Instrumentation lives at the single point each action flows through — cart events
in `CartProvider`, not on each button — so the funnel cannot drift out of step
with what the app actually did.

### Privacy

No IP, no user agent, no name, no email, no customer identity. `sessionId` is a
random per-tab token in `sessionStorage` that lets the funnel count _sessions_
without knowing who anyone is, and it dies with the tab. Only the pathname is
stored, never the query string, which can carry search terms.

`/admin` and `/login` are excluded twice over (by `SiteChrome` and by the tracker
itself), so the owner's own browsing never inflates store traffic.

Do Not Track is not consulted: DNT objects to _cross-site_ tracking, and these are
first-party, non-identifying counters with no profile and no third-party
recipient. If a cross-site pixel is ever added, revisit that.

### It can never break the storefront

Every write is fire-and-forget with the rejection swallowed
([`tracker.ts`](src/lib/analytics/tracker.ts)). A blocked rule, an offline
visitor or missing config produces a silently untracked event — never a broken
add-to-cart. A per-tab cap of 250 events stops a runaway loop costing real money
in Firestore writes.

Search is debounced by 800ms: without it, live-filtering would write one document
per keystroke and fill the search report with the prefixes of every word.

### Rates are withheld until they mean something

The funnel counts **distinct sessions per stage**, not events — a visitor who
views six products is one session that reached the product-view stage, not six.
Counting events would inflate the top of the funnel and make every rate below it
look far worse than reality.

Below `MIN_SESSIONS_FOR_RATE` (30) visits, every conversion rate is suppressed and
the UI explains why. Counts are still shown; it is only the _rates_ that are
withheld. Per-product conversion needs the same threshold, and
"viewed but not bought" needs 20 views before a product is flagged.

The biggest drop-off is the steepest **proportional** fall, not the largest
absolute one — losing 90% of 100 sessions matters more than 50% of 150.

### Three states, never conflated

| State         | Meaning                                     | Shown as                              |
| ------------- | ------------------------------------------- | ------------------------------------- |
| Never tracked | The tracker has never recorded anything     | "No analytics data yet" + explanation |
| Empty period  | Tracking works; this window had no activity | A real zero                           |
| Thin data     | Some traffic, too little for rates          | Counts shown, rates withheld          |

### GA4

GA4 remains the authoritative _traffic_ analytics system if you use it. Its
reporting API **cannot** be called from a static client — that needs a service
credential which must never ship to the browser. What lives here is BlueBuy's own
commerce funnel, which GA4 cannot compute because it has no access to your cost
basis or inventory. Audience, acquisition-channel and geographic reporting remain
GA4-only.

### Rollups

`analytics_daily` holds precomputed per-day summaries, rebuilt idempotently from
raw events (Analytics → Rebuild summaries). Raw events remain the source of truth
and the dashboards read them directly; the rollups exist so long-range reporting
can move off raw reads once event volume makes that worthwhile. Reads are capped
at 5,000 events and the dashboard **says so** when a range was truncated rather
than charting a partial subset as if it were whole.

---

## 13. Customers

There are no customer accounts — checkout is guest-only. A "customer" is
therefore **inferred** by matching orders on phone digits (email as fallback),
and the UI states that inference on the page rather than burying it here. Two
people sharing a number read as one customer; one person using two numbers reads
as two.

The grouping key is a **hash** of the contact detail, not the detail itself,
because that key is rendered into DOM attributes and written into CSV exports.
Customer rows show a name, a city and the last four phone digits — enough to
recognise a regular, without turning the dashboard into an exportable contact
list.

"Revenue per customer" is deliberately not called lifetime value: LTV projects
future spend, and there is nowhere near enough history to project anything.

---

## 14. Delivery

Fulfilment statuses, courier, tracking number, delivery cost and the shipped /
expected / delivered dates are recorded per order. Average delivery time and
delivery success rate are withheld below 10 completed attempts, for the same
reason conversion rates are.

**No courier integration exists.** Tracking numbers are recorded, not looked up.
The data model is shaped so an integration can populate the same fields later;
nothing in the UI implies live tracking that isn't there.

Delivery cost recorded on an order **is** an operating cost and is subtracted in
the P&L (see §7). It is counted across every order, including returned ones — an
attempted delivery still cost money. If you also file courier invoices as a
shipping expense, the profit page warns you that the same money may be counted
twice; pick one place to record it.

---

## 15. Testing

```bash
npm test              # 127 unit tests over the calculation engine
npm run test:integration  # 15 emulator tests over the real transactions
npm run typecheck
npm run lint
npm run build
```

Unit tests cover the pure business logic: weighted-average costing and the
unknown-vs-zero distinction; sales, refunds and the cancelled/returned exclusion;
COGS coverage; the P&L including the inventory-procurement exclusion; inventory
states, valuation gaps, turnover and ledger reconstruction; cash balances;
period-comparison suppression; date-range boundaries; funnel session-counting and
rate suppression; product performance and its insight lists; delivery averages;
customer identity matching; and CSV escaping including spreadsheet formula
injection.

Two tests exist specifically to stop PII leaking: customer grouping keys must not
contain the phone number, and customer rows must not serialise it.

### Integration tests (Firestore emulator)

`npm run test:integration` starts the emulator, runs `*.emulator.test.ts` against
the **real** repositories, and shuts it down. It uses `firebase.integration.json`
and the open `firestore.test.rules`, and a dummy Firebase config so it can never
reach the live project.

They prove the transactional guarantees that unit tests cannot:

- a draft or `ordered` purchase raises no stock; only receiving does
- a partial receipt raises exactly the received quantity, and completes the order
- over-receiving is rejected and writes nothing at all
- weighted average across two receipts (10×100 then 10×200 → 150)
- placing an order decrements stock once; later status changes never re-decrement
- overselling is refused and leaves no order behind
- two buyers racing for the last unit → exactly one succeeds
- receiving the same PO twice concurrently → stock rises once
- cancelling is idempotent, and **the movement ledger nets to `stock`** — the
  regression that motivated `closeWithRestock`
- closing an order into a status its lifecycle forbids changes nothing
- a written-off return records the sale without restocking

**Still not covered:** Firestore _rules_ themselves (the suite runs with open
rules to exercise the transactions), the CMS and Cloudinary paths, and the React
components.
