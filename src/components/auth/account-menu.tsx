'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** Two-letter initials derived from a display name or email, for the avatar. */
function initialsFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split('@')[0] || '';
  if (!source) return 'A';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Admin account control: an avatar button that opens a small menu with the
 * signed-in user's identity and a logout action. Closes on outside click or
 * Escape. Renders nothing until a user is present (the surface is behind
 * `ProtectedRoute`, so that's only briefly during sign-out).
 */
export function AccountMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const initials = initialsFrom(user.displayName, user.email);
  const label = user.displayName || user.email || 'Account';

  async function handleLogout() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch {
      // Even if the network call fails, drop the user to the login screen; the
      // guard will re-evaluate the (still-valid) session on arrival.
      setSigningOut(false);
      router.replace('/login');
    }
  }

  return (
    <div ref={containerRef} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="hover:bg-secondary flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition-colors"
      >
        <span className="from-brand flex size-8 items-center justify-center rounded-full bg-gradient-to-br to-violet-500 text-xs font-semibold text-white">
          {initials}
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground hidden size-4 transition-transform sm:block',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="border-border bg-card absolute right-0 z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border shadow-lg"
        >
          <div className="border-border border-b px-3 py-3">
            <p className="text-foreground truncate text-sm font-medium">{label}</p>
            {user.email && user.displayName && (
              <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            )}
            <span className="bg-secondary text-muted-foreground mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize">
              {user.role}
            </span>
          </div>
          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={signingOut}
              className="text-foreground hover:bg-secondary flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <LogOut className="size-4.5" aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Log out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
