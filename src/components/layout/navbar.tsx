'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Menu, Search, ShoppingBag } from 'lucide-react';
import { MAIN_NAV } from '@/data/navigation';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/cart-context';
import { Container } from './container';
import { Logo } from '@/components/common/logo';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { SearchBar } from '@/components/common/search-bar';
import { CartDrawer } from '@/components/common/cart-drawer';
import { MobileMenu } from './mobile-menu';

/** Sticky, blur-backed navigation with search, cart and theme controls. */
export function Navbar() {
  const pathname = usePathname();
  const { itemCount, hydrated, openDrawer } = useCart();
  const [scrolled, setScrolled] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cmd/Ctrl+K opens search — a premium touch users expect.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full transition-all duration-300',
          scrolled
            ? 'border-border bg-background/80 border-b backdrop-blur-lg'
            : 'bg-background/0 border-b border-transparent'
        )}
      >
        <Container className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:gap-8">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="text-foreground hover:bg-secondary flex size-10 items-center justify-center rounded-full transition-colors md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <Logo />
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {MAIN_NAV.map((link) => {
                const active =
                  link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                      active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="text-foreground hover:bg-secondary focus-visible:ring-ring flex size-10 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
            >
              <Search className="size-[18px]" />
            </button>
            <ThemeToggle />
            <button
              type="button"
              onClick={openDrawer}
              aria-label={itemCount > 0 ? `Open cart, ${itemCount} items` : 'Open cart'}
              className="text-foreground hover:bg-secondary focus-visible:ring-ring relative flex size-10 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
            >
              <ShoppingBag className="size-[18px]" />
              {/* Badge unmounts (not AnimatePresence-exits) when the cart empties
                  so it can never be left showing a stale count. The `key` makes
                  it remount — and re-pop — on every count change. */}
              {hydrated && itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="bg-brand text-brand-foreground absolute top-1 right-1 flex size-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </motion.span>
              )}
            </button>
          </div>
        </Container>
      </header>

      <SearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
