/**
 * Public entry point for the client-side auth layer. Import from `@/lib/auth`.
 */
export { AuthProvider, useAuth, type AuthUser, type AuthContextValue } from './auth-context';
export { ROLES, DEFAULT_ROLE, isRole, hasRole, type Role } from './roles';
export { loginSchema, type LoginValues, type LoginErrors } from './schema';
