'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useAuth, hasRole, type Role } from '@/lib/auth';
import { Logo } from '@/components/common/logo';

/** Centered full-height frame used by every gate state. */
function AuthGateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {children}
    </div>
  );
}

/** Shown while the persisted session is being resolved. */
function AuthLoading({ label = 'Checking your session…' }: { label?: string }) {
  return (
    <AuthGateFrame>
      <Loader2 className="text-brand size-6 animate-spin" aria-hidden="true" />
      <p role="status" className="text-muted-foreground text-sm">
        {label}
      </p>
    </AuthGateFrame>
  );
}

/** Shown when Firebase env config is missing, instead of a blank/broken screen. */
function ConfigNotice({ message }: { message: string }) {
  return (
    <AuthGateFrame>
      <TriangleAlert className="text-destructive size-7" aria-hidden="true" />
      <h1 className="text-lg font-semibold">Authentication unavailable</h1>
      <p className="text-muted-foreground max-w-md text-sm">{message}</p>
    </AuthGateFrame>
  );
}

/** Shown when a signed-in user lacks the role a route requires. */
function Unauthorized() {
  return (
    <AuthGateFrame>
      <ShieldAlert className="text-destructive size-7" aria-hidden="true" />
      <h1 className="text-lg font-semibold">You don’t have access</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Your account doesn’t have permission to view this area. Contact an administrator if you
        believe this is a mistake.
      </p>
    </AuthGateFrame>
  );
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Minimum role required to view the children. Omit to require only that the
   * user is authenticated. A higher-privileged role always satisfies a lower
   * requirement (see `hasRole`).
   */
  requiredRole?: Role;
}

/**
 * Client-side route guard for the admin surface.
 *
 * The app is a static export (no server/middleware), so protection is enforced
 * in the browser: while the session resolves we show a loader; unauthenticated
 * visitors are redirected to `/login`; authenticated users lacking the required
 * role see an "unauthorized" screen. Children only render once the user is
 * confirmed — no protected UI flashes before the check completes.
 *
 * This is a UX gate, not a security boundary. Real enforcement of *data* access
 * must live in Firebase Security Rules / custom claims, never in client state.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, configured, configError } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (configured && !loading && !user) {
      router.replace('/login');
    }
  }, [configured, loading, user, router]);

  if (!configured) {
    return <ConfigNotice message={configError ?? 'Firebase is not configured.'} />;
  }

  if (loading) {
    return <AuthLoading />;
  }

  if (!user) {
    // Redirect is in-flight; keep a loader up so nothing protected flashes.
    return <AuthLoading label="Redirecting to sign in…" />;
  }

  if (requiredRole && !hasRole(user.role, requiredRole)) {
    return <Unauthorized />;
  }

  return <>{children}</>;
}

/**
 * Full-screen splash for the login route while it decides whether to bounce an
 * already-authenticated admin to the dashboard. Branded so the transition feels
 * intentional rather than a flicker.
 */
export function AuthRedirectSplash() {
  return (
    <AuthGateFrame>
      <Logo href={null} />
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span role="status">Taking you to the dashboard…</span>
      </div>
    </AuthGateFrame>
  );
}
