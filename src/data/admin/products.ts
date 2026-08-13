/**
 * Admin catalogue constants.
 *
 * The admin reads real products from Firestore through the repository/hook
 * layer — there is no mock catalogue here. Only merchandising thresholds that
 * aren't worth a Firestore round-trip live in this file.
 */

/** Low-stock threshold used for the "Low stock" badge and dashboard stat. */
export const LOW_STOCK_THRESHOLD = 10;
