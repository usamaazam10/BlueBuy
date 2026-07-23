'use client';

import * as React from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * The admin application shell: a fixed sidebar rail on large screens, a slide-in
 * drawer on mobile, a sticky top bar, and the scrollable content region. Holds
 * the mobile drawer open/close state.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Desktop sidebar */}
      <aside className="border-border bg-card fixed inset-y-0 left-0 z-40 hidden w-64 border-r lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        side="left"
        title="BlueBuy Admin"
        className="max-w-[17rem]"
      >
        <Sidebar showBrand={false} onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>

      {/* Main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
