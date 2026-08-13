'use client';

import Link from 'next/link';
import {
  Github,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Music2,
  Globe,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Container } from './container';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { useFooterContent, useSocialLinksList } from '@/hooks/queries';
import type { SocialPlatform } from '@/types/cms';

/** Maps a social platform to its lucide icon. */
const SOCIAL_ICONS: Record<SocialPlatform, LucideIcon> = {
  twitter: Twitter,
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  linkedin: Linkedin,
  github: Github,
  tiktok: Music2,
  website: Globe,
};

/**
 * A social link is only rendered when it points somewhere real. Placeholder
 * hrefs (`#`, empty) would advertise accounts the store may not have.
 */
function isRealUrl(url: string): boolean {
  return /^https?:\/\/\S+/i.test(url.trim());
}

export function Footer() {
  const { data: footer } = useFooterContent();
  const { items: socials } = useSocialLinksList();

  const realSocials = socials.filter((social) => isRealUrl(social.url));
  const copyright = (footer!.copyright || '').replace('{year}', String(new Date().getFullYear()));

  return (
    <footer className="border-border mt-24 border-t">
      <Container className="py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          {/* Brand + shopping CTA */}
          <div className="col-span-2 flex flex-col gap-4 md:col-span-3">
            <Logo surface="footer" />
            {footer!.tagline && (
              <p className="text-muted-foreground max-w-xs text-sm">{footer!.tagline}</p>
            )}
            <div>
              <Button asChild variant="outline" size="sm">
                <Link href="/products">
                  Browse products <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Link columns */}
          {footer!.columns.map((column, columnIndex) => (
            <nav
              key={`${column.title}-${columnIndex}`}
              aria-label={column.title}
              className="flex flex-col gap-3"
            >
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link, index) => (
                  <li key={`${link.label}-${index}`}>
                    <Link
                      href={link.href || '#'}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-border mt-14 flex flex-col items-center justify-between gap-6 border-t pt-8 sm:flex-row">
          <p className="text-muted-foreground text-sm">{copyright}</p>
          <div className="flex items-center gap-1">
            {realSocials.map((social) => {
              const Icon = SOCIAL_ICONS[social.platform] ?? Globe;
              const label = social.label || social.platform;
              return (
                <a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary flex size-9 items-center justify-center rounded-full transition-colors"
                >
                  <Icon className="size-[18px]" />
                </a>
              );
            })}
          </div>
        </div>
      </Container>
    </footer>
  );
}
