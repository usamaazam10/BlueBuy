/**
 * Capability-based permissions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why capabilities rather than a rank
 *
 * The original three roles (`admin` > `editor` > `viewer`) formed a straight
 * line, so a numeric rank was enough. Operational roles don't: an inventory
 * manager and a sales manager are peers with *different* access, and neither
 * outranks the other. Ordering them would force one to inherit the other's
 * access — exactly the over-granting least privilege is meant to prevent.
 *
 * So access is expressed as a set of capabilities per role. `hasRole` is kept
 * for the legacy hierarchy (nothing that used it changes meaning), but new
 * checks should use {@link can}.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the UX half only
 *
 * Hiding a page prevents mistakes, not attacks. The real boundary is
 * `firestore.rules`, which grants collection access from the same custom claim.
 * Every capability below has a matching rule; see BUSINESS_OPERATIONS.md
 * § Security for the mapping.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Role } from './roles';

/** A single thing a user may do. */
export type Permission =
  /** Reach the /admin surface at all. */
  | 'admin.access'
  // Catalogue
  | 'catalog.view'
  | 'catalog.manage'
  // Orders & fulfilment
  | 'orders.view'
  | 'orders.manage'
  // Customers
  | 'customers.view'
  // Inventory
  | 'inventory.view'
  | 'inventory.adjust'
  // Procurement
  | 'purchases.view'
  | 'purchases.manage'
  | 'purchases.receive'
  /** Revenue/order analytics — sales figures, not costs or margin. */
  | 'sales.view'
  /**
   * Money: cash, expenses, purchase costs, COGS, margin and profit.
   * Deliberately separate from `sales.view` so a sales role can see turnover
   * without seeing what the business pays or earns.
   */
  | 'finance.view'
  | 'finance.manage'
  // Reporting & audit
  | 'reports.export'
  | 'analytics.view'
  | 'audit.view'
  // Content & configuration
  | 'cms.manage'
  | 'settings.manage';

/** Every capability, used to build the "full access" roles. */
const ALL_PERMISSIONS: readonly Permission[] = [
  'admin.access',
  'catalog.view',
  'catalog.manage',
  'orders.view',
  'orders.manage',
  'customers.view',
  'inventory.view',
  'inventory.adjust',
  'purchases.view',
  'purchases.manage',
  'purchases.receive',
  'sales.view',
  'finance.view',
  'finance.manage',
  'reports.export',
  'analytics.view',
  'audit.view',
  'cms.manage',
  'settings.manage',
];

/**
 * Capabilities granted to each role.
 *
 * `owner` and `admin` both hold everything. They are kept distinct so the
 * business can reserve `owner` for the proprietor and hand `admin` to a trusted
 * manager — a difference that matters for the audit trail even where access is
 * identical today.
 *
 * **Backwards compatibility:** `admin` retains full access exactly as before, so
 * every existing user carrying `role: 'admin'` is unaffected by this change.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,

  /** Buys and counts stock. No access to sales revenue or the cash ledger. */
  inventory_manager: [
    'admin.access',
    'catalog.view',
    'catalog.manage',
    'orders.view',
    'inventory.view',
    'inventory.adjust',
    'purchases.view',
    'purchases.manage',
    'purchases.receive',
    // Needs purchase costs to do the job, hence finance.view.
    'finance.view',
    'reports.export',
  ],

  /** Owns the top line. Sees revenue and customers, not costs or cash. */
  sales_manager: [
    'admin.access',
    'catalog.view',
    'orders.view',
    'orders.manage',
    'customers.view',
    'inventory.view',
    'sales.view',
    'analytics.view',
    'reports.export',
  ],

  /** Runs day-to-day fulfilment. Sees no money at all. */
  operations: [
    'admin.access',
    'catalog.view',
    'orders.view',
    'orders.manage',
    'customers.view',
    'inventory.view',
    'purchases.view',
  ],

  /**
   * Legacy role, intentionally granted **nothing**.
   *
   * `editor` predates this upgrade but was never actually usable: the admin gate
   * was `hasRole(role, 'admin')`, which an editor fails, so anyone holding the
   * claim today is already locked out of `/admin`. Granting it access here would
   * silently *expand* privileges for existing accounts on a live store — a
   * change the owner should make deliberately, not one that arrives with a
   * dashboard upgrade.
   *
   * To delegate content work, assign `operations` or a purpose-built role
   * instead. See BUSINESS_OPERATIONS.md § Roles.
   */
  editor: [],

  /** Signed in, but not staff. Holds no admin capability whatsoever. */
  viewer: [],
};

/** Whether a role holds a capability. */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Whether a role holds every capability in a list. */
export function canAll(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

/** Whether a role holds at least one capability in a list. */
export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

/** Whether a role may reach the admin surface at all. */
export function isStaff(role: Role): boolean {
  return can(role, 'admin.access');
}

/** Human labels for the role picker and audit trail. */
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  inventory_manager: 'Inventory manager',
  sales_manager: 'Sales manager',
  operations: 'Operations',
  editor: 'Editor',
  viewer: 'Viewer',
};

/** One-line description of what each role can do, for the settings screen. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Full access, including finances, settings and the audit log.',
  admin: 'Full access to every part of the dashboard.',
  inventory_manager: 'Stock, suppliers, purchase orders and purchase costs. No sales revenue.',
  sales_manager: 'Orders, customers, sales performance and analytics. No costs or cash.',
  operations: 'Order fulfilment and delivery. No financial data.',
  editor: 'Legacy role with no dashboard access — assign an operational role instead.',
  viewer: 'No dashboard access.',
};
