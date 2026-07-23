import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign in · BlueBuy Admin',
  description: 'Sign in to the BlueBuy admin dashboard.',
  robots: { index: false, follow: false },
};

/**
 * The login route shares the same `AuthProvider` contract as `/admin` (both
 * read the one Firebase session), letting the page bounce already-signed-in
 * admins straight to the dashboard.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
