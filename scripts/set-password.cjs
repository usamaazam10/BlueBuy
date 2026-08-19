// scripts/set-password.cjs — set a user's password directly via the Admin SDK.
//
// The Firebase console can only *email* a reset link (Authentication → Users →
// ⋮ → Reset password). That is useless when the account's address isn't a real
// mailbox — which is common for a shared operator login like admin@bluebuy.com.
// The Admin SDK can set the password outright, which is what this does.
//
// This is a developer/ops tool. It must run from a TRUSTED environment (your
// machine) with the Admin SDK — never in the browser or the deployed app.
//
// Setup (one time):
//   Firebase console → ⚙ Project settings → Service accounts → Generate new
//   private key. Save the JSON somewhere OUTSIDE this repo, then:
//     export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
//
// Usage:
//   node scripts/set-password.cjs <email> '<new-password>'
//   node scripts/set-password.cjs admin@bluebuy.com 'a-long-passphrase'
//
// Quote the password in single quotes so the shell doesn't eat characters like
// $, ! or ^. Note it will land in your shell history — clear it afterwards, or
// prefix the command with a space if your shell is set to ignore those.
//
// Signing everyone out is deliberate: a password change that leaves existing
// sessions alive doesn't actually lock anyone out.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp({ credential: applicationDefault() }); // uses GOOGLE_APPLICATION_CREDENTIALS

const [email, password] = process.argv.slice(2);

// Firebase itself enforces a 6-character minimum. Six is not a password, so we
// ask for more here — this is the login to the whole back office.
const MIN_LENGTH = 12;

(async () => {
  if (!email || !password) {
    throw new Error("Usage: set-password.cjs <email> '<new-password>'");
  }
  if (password.length < MIN_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LENGTH} characters (got ${password.length}).`);
  }

  const auth = getAuth();
  const user = await auth.getUserByEmail(email);

  await auth.updateUser(user.uid, { password });
  // Existing ID tokens stay valid for up to an hour otherwise.
  await auth.revokeRefreshTokens(user.uid);

  const role = user.customClaims?.role ?? '(none)';
  console.log(`✓ Password updated for ${email} (${user.uid}).`);
  console.log(`  Role claim is unchanged: ${role}`);
  console.log('  All existing sessions were signed out; sign in with the new password.');
})().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
