'use client';

import { Bell, Menu, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { AccountMenu } from '@/components/auth/account-menu';

/** Sticky admin top bar: mobile menu trigger, quick search, theme, account. */
export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="text-foreground hover:bg-secondary flex size-9 items-center justify-center rounded-lg transition-colors lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* Quick search (decorative in the UI-only phase). */}
      <div className="relative hidden max-w-sm flex-1 sm:block">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Search…"
          aria-label="Search admin"
          className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-ring/30 h-9 w-full rounded-lg border pr-3 pl-9 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        />
        <kbd className="border-border text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] font-medium md:block">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Notifications"
          className="text-foreground hover:bg-secondary relative flex size-9 items-center justify-center rounded-lg transition-colors"
        >
          <Bell className="size-[18px]" />
          <span className="bg-brand absolute top-2 right-2 size-1.5 rounded-full" />
        </button>
        <ThemeToggle className="size-9 rounded-lg" />
        <AccountMenu />
      </div>
    </header>
  );
}
