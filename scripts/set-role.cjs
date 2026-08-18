// scripts/set-role.cjs — assign or clear a user's role via Firebase custom claims.
//
// This is a developer/ops tool. It must run from a TRUSTED environment (your
// machine) with the Admin SDK — never in the browser or the deployed app.
//
// Setup (one time):
//   export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
//   npm install firebase-admin
//
// Usage:
//   node scripts/set-role.cjs <email> owner              # full access, incl. finance
//   node scripts/set-role.cjs <email> admin              # full access
//   node scripts/set-role.cjs <email> inventory_manager  # stock, suppliers, purchase costs
//   node scripts/set-role.cjs <email> sales_manager      # orders, customers, sales analytics
//   node scripts/set-role.cjs <email> operations         # fulfilment only, no financial data
//   node scripts/set-role.cjs <email> viewer             # no dashboard access
//   node scripts/set-role.cjs <email> --clear            # remove all role claims
//
// What each role may do is defined in src/lib/auth/permissions.ts (the UI) and
// enforced in firestore.rules (the real boundary). Keep the two in step.
//
// NOTE: a role change takes effect when the user's ID token refreshes — they
// should sign out and back in, or wait up to an hour.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp({ credential: applicationDefault() }); // uses GOOGLE_APPLICATION_CREDENTIALS

const [email, role] = process.argv.slice(2);
// Mirrors ROLES in src/lib/auth/roles.ts. `editor` is retained so an existing
// claim can still be cleared, but it grants no access — see permissions.ts.
const VALID = [
  'owner',
  'admin',
  'inventory_manager',
  'sales_manager',
  'operations',
  'editor',
  'viewer',
];

(async () => {
  if (!email || !role) {
    throw new Error('Usage: set-role.cjs <email> <admin|editor|viewer|--clear>');
  }
  if (role !== '--clear' && !VALID.includes(role)) {
    throw new Error(`Unknown role "${role}". Use one of: ${VALID.join(', ')}, or --clear.`);
  }

  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const claims = role === '--clear' ? null : { ...user.customClaims, role };

  await auth.setCustomUserClaims(user.uid, claims);
  // Force existing tokens to refresh so the new claim takes effect on next request.
  await auth.revokeRefreshTokens(user.uid);

  console.log(`✓ Set role=${role} for ${email} (${user.uid}).`);
  console.log('  They must sign out and sign back in for the change to take effect.');
})().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
