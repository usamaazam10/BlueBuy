'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

/**
 * Renders the public storefront chrome (skip link, sticky navbar, footer) around
 * page content — except under `/admin`, which ships its own full-screen shell.
 *
 * `children` are passed through untouched, so server components rendered by the
 * route segments keep rendering on the server; only this thin wrapper is a
 * client component (it needs the current pathname to decide on the chrome).
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <a
        href="#main"
        className="bg-foreground text-background sr-only z-[60] rounded-full px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </>
  );
}
