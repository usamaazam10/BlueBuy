import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/layout/admin-shell';
import { AuthProvider } from '@/lib/auth';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: {
    default: 'Admin',
    template: '%s · BlueBuy Admin',
  },
  description: 'BlueBuy admin dashboard.',
  robots: { index: false, follow: false },
};

/**
 * Every `/admin/*` route is gated here: `AuthProvider` resolves the session and
 * `ProtectedRoute` redirects guests to `/login` before the shell renders, so
 * new admin pages are protected automatically with no per-page wiring.
 *
 * `requiredPermission="admin.access"` means a signed-in user is **not** enough —
 * only users whose role custom claim carries admin-surface access reach the
 * dashboard; everyone else (default `viewer`) sees the "unauthorized" screen.
 *
 * This replaced a `requiredRole="admin"` check when operational roles were
 * introduced: an inventory or sales manager must reach `/admin` without being a
 * full admin, which a rank-based check cannot express. Individual pages then
 * gate their own capability (`finance.view`, `inventory.adjust`, …). This is the
 * UX half of the gate; the real boundary is the Firestore rules.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute requiredPermission="admin.access">
        <ToastProvider>
          <AdminShell>{children}</AdminShell>
        </ToastProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}
