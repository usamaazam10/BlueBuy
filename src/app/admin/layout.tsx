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
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <ToastProvider>
          <AdminShell>{children}</AdminShell>
        </ToastProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}
