/**
 * Role-based access control (RBAC).
 *
 * Roles are resolved from Firebase **custom claims** (set server-side, never
 * trusted from the client) so admin access can never be gained simply by
 * signing in. A user's privileges come entirely from the `role` claim on their
 * ID token; absent that claim they are a `viewer` (see {@link DEFAULT_ROLE})
 * with no admin access.
 *
 * To grant admin (or any other) role, set a custom claim from a trusted
 * environment (Cloud Function / Admin SDK), e.g.
 * `admin.auth().setCustomUserClaims(uid, { role: 'admin' })`. See
 * AUTHENTICATION.md for the full runbook (first admin, assign/remove, staff).
 */

/**
 * Known roles.
 *
 * `admin`, `editor` and `viewer` are the original three and keep their exact
 * meaning — an existing user carrying `role: 'admin'` is unaffected by the
 * operational roles added alongside them.
 *
 * The operational roles (`inventory_manager`, `sales_manager`, `operations`) are
 * **peers**, not rungs on a ladder: they grant different access, and neither
 * outranks the other. Because of that, what a role may do is defined by the
 * capability matrix in `./permissions`, not by the rank below.
 */
export const ROLES = [
  'owner',
  'admin',
  'inventory_manager',
  'sales_manager',
  'operations',
  'editor',
  'viewer',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Role granted to an authenticated user when no `role` custom claim is present.
 *
 * This is intentionally the **least-privileged** role: signing in alone must
 * never confer admin access. Elevation to `editor`/`admin` happens only via a
 * custom claim set from a trusted environment.
 */
export const DEFAULT_ROLE: Role = 'viewer';

/**
 * Privilege ranking, retained for the original hierarchy.
 *
 * The operational roles are peers and cannot be honestly ordered against
 * `editor`, so they all sit at the same rung above `viewer`. Do not use this to
 * gate operational features — use `can()` from `./permissions`, which is what
 * the specialised roles were introduced for. This exists so existing
 * `hasRole(role, 'admin')` checks keep behaving exactly as they always have.
 */
const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  inventory_manager: 2,
  sales_manager: 2,
  operations: 2,
  editor: 2,
  viewer: 1,
};

/** Type guard for a value coming from an untrusted source (e.g. token claims). */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Whether `role` satisfies `required` — an exact match or any higher-privileged
 * role. `hasRole('admin', 'editor')` is `true`; `hasRole('viewer', 'editor')`
 * is `false`. Use this for route/action gating so the check lives in one place.
 */
export function hasRole(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
