'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Headset, Menu, Search, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/cart-context';
import { useNavigationItems, useSiteSettings, useStoreCategories } from '@/hooks/queries';
import { Container } from './container';
import { Logo } from '@/components/common/logo';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { SearchBar } from '@/components/common/search-bar';
import { CartDrawer } from '@/components/common/cart-drawer';
import { MobileMenu } from './mobile-menu';

/**
 * Sticky storefront header, marketplace style: a tall top row with the logo, a
 * wide search field and the cart, plus (desktop) a second row with the primary
 * links and a shortcut to every live category.
 */
export function Navbar() {
  const pathname = usePathname();
  const { items: navItems } = useNavigationItems();
  const { data: categories } = useStoreCategories();
  const { data: settings } = useSiteSettings();
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
          'bg-background/95 sticky top-0 z-40 w-full border-b backdrop-blur-lg transition-shadow duration-300',
          scrolled ? 'border-border shadow-foreground/5 shadow-sm' : 'border-border/60'
        )}
      >
        <Container className="flex h-[4.5rem] items-center gap-3 sm:h-20 md:gap-6 lg:gap-10">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="text-foreground hover:bg-secondary -ml-2 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <Logo size="lg" className="shrink-0" />

          {/* Wide search field (desktop) — opens the live catalogue search. */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="border-border bg-secondary/60 text-muted-foreground hover:border-foreground/20 hover:bg-secondary focus-visible:ring-ring hidden h-12 min-w-0 flex-1 items-center gap-3 rounded-full border pr-1.5 pl-5 text-left text-sm transition-colors outline-none focus-visible:ring-2 md:flex lg:max-w-2xl"
          >
            <Search className="size-[18px] shrink-0" aria-hidden />
            <span className="flex-1 truncate">Search for products, categories…</span>
            <span className="bg-brand text-brand-foreground flex h-9 items-center rounded-full px-5 text-sm font-semibold">
              Search
            </span>
          </button>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {settings.supportPhone && (
              <a
                href={`tel:${settings.supportPhone.replace(/[^\d+]/g, '')}`}
                className="hover:bg-secondary mr-2 hidden items-center gap-2.5 rounded-full py-1.5 pr-3 pl-1.5 transition-colors xl:flex"
              >
                <span className="bg-brand/10 text-brand flex size-9 items-center justify-center rounded-full">
                  <Headset className="size-[18px]" aria-hidden />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-muted-foreground text-xs">Customer support</span>
                  <span className="text-sm font-semibold">{settings.supportPhone}</span>
                </span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="text-foreground hover:bg-secondary focus-visible:ring-ring flex size-10 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 md:hidden"
            >
              <Search className="size-5" />
            </button>
            <ThemeToggle />
            <button
              type="button"
              onClick={openDrawer}
              aria-label={itemCount > 0 ? `Open cart, ${itemCount} items` : 'Open cart'}
              className="text-foreground hover:bg-secondary focus-visible:ring-ring relative flex size-11 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
            >
              <ShoppingBag className="size-5" />
              {/* Badge unmounts (not AnimatePresence-exits) when the cart empties
                  so it can never be left showing a stale count. The `key` makes
                  it remount — and re-pop — on every count change. */}
              {hydrated && itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="bg-brand text-brand-foreground absolute top-0.5 right-0.5 flex size-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </motion.span>
              )}
            </button>
          </div>
        </Container>

        {/* Second row (desktop): primary links, then every live category. */}
        <div className="border-border/60 hidden border-t md:block">
          <Container className="flex h-12 [scrollbar-width:none] items-center gap-1 overflow-x-auto">
            <nav className="flex shrink-0 items-center gap-1" aria-label="Primary">
              {navItems.map((link) => {
                const active =
                  link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative rounded-full px-3.5 py-2 text-[0.94rem] font-semibold whitespace-nowrap transition-colors',
                      active
                        ? 'text-brand bg-brand/10'
                        : 'text-foreground/80 hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            {categories.length > 0 && (
              <>
                <span className="bg-border mx-3 h-5 w-px shrink-0" aria-hidden />
                <nav className="flex shrink-0 items-center gap-1" aria-label="Categories">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/products?category=${category.slug}`}
                      className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
                    >
                      {category.name}
                    </Link>
                  ))}
                </nav>
              </>
            )}
          </Container>
        </div>
      </header>

      <SearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
