/**
 * UI-facing types for the admin dashboard.
 *
 * These deliberately sit apart from the Firestore models in `@/types/models`:
 * they describe what an admin *screen* renders, not what is persisted.
 */

export type ProductStatus = 'active' | 'draft' | 'archived';
