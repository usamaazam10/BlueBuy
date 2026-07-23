/**
 * Role-based access control (RBAC) scaffolding.
 *
 * Authentication currently gates the entire `/admin` surface behind "is this a
 * signed-in user?", but the shape here is deliberately forward-looking: roles
 * are resolved from Firebase **custom claims** (set server-side, never trusted
 * from the client) so fine-grained permissions can be layered on later without
 * reworking the auth architecture.
 *
 * To assign a role to a user, set a custom claim from a trusted environment
 * (Cloud Function / Admin SDK), e.g. `admin.auth().setCustomUserClaims(uid,
 * { role: 'editor' })`. Until then, any authenticated user is treated as an
 * `admin` (see {@link DEFAULT_ROLE}).
 */

/** Known roles, ordered from most to least privileged. */
export const ROLES = ['admin', 'editor', 'viewer'] as const;

export type Role = (typeof ROLES)[number];

/** Role granted to an authenticated user when no `role` custom claim is present. */
export const DEFAULT_ROLE: Role = 'admin';

/** Privilege ranking — higher number means more access. */
const ROLE_RANK: Record<Role, number> = {
  admin: 3,
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
