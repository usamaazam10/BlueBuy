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
//   node scripts/set-role.cjs <email> admin     # grant admin
//   node scripts/set-role.cjs <email> viewer    # demote to viewer (removes admin)
//   node scripts/set-role.cjs <email> --clear   # remove all role claims

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp({ credential: applicationDefault() }); // uses GOOGLE_APPLICATION_CREDENTIALS

const [email, role] = process.argv.slice(2);
const VALID = ['admin', 'editor', 'viewer'];

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
