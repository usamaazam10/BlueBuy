'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Drawer } from '@/components/ui/drawer';
import { Logo } from '@/components/common/logo';
import { useNavigationItems } from '@/hooks/queries';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const { items: navItems } = useNavigationItems();

  return (
    <Drawer open={open} onClose={onClose} side="left" title="Menu">
      <nav className="flex flex-col p-3" aria-label="Mobile">
        {navItems.map((link) => {
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.id}
              href={link.href}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-xl px-4 py-3 text-base font-medium transition-colors',
                active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-border mt-auto border-t p-5">
        <Logo />
        <p className="text-muted-foreground mt-3 text-sm">
          Discover and shop carefully selected products.
        </p>
      </div>
    </Drawer>
  );
}
