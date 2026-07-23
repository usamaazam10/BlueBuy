'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { ADMIN_NAV, ADMIN_NAV_SECTIONS } from '@/data/admin/nav';
import { cn } from '@/lib/utils';

/** Determines whether a nav item is the active route. */
function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin sidebar navigation. Rendered inside the fixed desktop rail and inside
 * the mobile drawer; `onNavigate` lets the drawer close on selection.
 */
export function Sidebar({
  onNavigate,
  showBrand = true,
}: {
  onNavigate?: () => void;
  /** Hidden inside the mobile drawer, which supplies its own header. */
  showBrand?: boolean;
}) {
  const pathname = usePathname() ?? '';

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      {showBrand && (
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="bg-brand text-brand-foreground flex size-8 items-center justify-center rounded-lg">
            <ShoppingBag className="size-4.5" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-foreground text-sm font-semibold">BlueBuy</span>
            <span className="text-muted-foreground text-xs">Admin</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Admin">
        {ADMIN_NAV_SECTIONS.map((section) => {
          const items = ADMIN_NAV.filter((item) => item.section === section);
          return (
            <div key={section} className="mb-4">
              <p className="text-muted-foreground px-3 pb-1.5 text-[11px] font-medium tracking-wider uppercase">
                {section}
              </p>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                        )}
                      >
                        <Icon
                          className={cn(
                            'size-4.5 shrink-0',
                            active
                              ? 'text-brand'
                              : 'text-muted-foreground group-hover:text-foreground'
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.placeholder && (
                          <span className="border-border text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] font-medium">
                            Soon
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-border border-t p-3">
        <Link
          href="/"
          className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="size-4.5" />
          Back to store
        </Link>
      </div>
    </div>
  );
}
