import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { CartProvider } from '@/context/cart-context';
import { SiteChrome } from '@/components/layout/site-chrome';
import { SITE_CONFIG, BRAND_ASSETS } from '@/constants/site';
import { getSiteSettings, getCmsContent } from '@/lib/server/catalog';
import { env } from '@/lib/env';
import '@/styles/globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: SITE_CONFIG.name,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  applicationName: SITE_CONFIG.name,
  authors: [{ name: SITE_CONFIG.name }],
  keywords: ['ecommerce', 'shop', 'BlueBuy', 'Next.js'],
  // Default BlueBuy brand icons (committed under public/brand). The client
  // SiteSettingsRuntime swaps these for any CMS overrides at runtime.
  icons: {
    icon: BRAND_ASSETS.favicon,
    apple: BRAND_ASSETS.appleTouchIcon,
  },
  // Site-wide social-share defaults. Pages override title/description via their
  // own metadata; product pages set richer, per-product OG/Twitter + canonical
  // (see @/lib/seo). Without these, non-product pages produce no link preview.
  openGraph: {
    type: 'website',
    siteName: SITE_CONFIG.name,
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    url: env.siteUrl,
    images: [{ url: BRAND_ASSETS.ogImage, width: 1200, height: 630, alt: SITE_CONFIG.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: [BRAND_ASSETS.ogImage],
  },
  // Meta (Facebook) Business Manager domain verification. Must be a real
  // <meta> tag in the static <head> — Meta's crawler ignores anything injected
  // by client JS — so it lives here rather than in a client component.
  verification: {
    other: {
      'facebook-domain-verification': 'xqgw2alcyngybfcay4bahe08mh7k2g',
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read once at build time (memoised across the whole export) and seeded into
  // React Query below, so prerendered pages carry the store's real settings and
  // CMS copy rather than the defaults — no hydration swap, and crawlers see the
  // real hero/footer.
  const [siteSettings, cms] = await Promise.all([getSiteSettings(), getCmsContent()]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider
            initialSiteSettings={siteSettings}
            initialHomepage={cms.homepage}
            initialFooter={cms.footer}
            initialContact={cms.contact}
            initialNavigation={cms.navigation}
            initialSocialLinks={cms.socialLinks}
            initialBanners={cms.banners}
          >
            <CartProvider>
              <SiteChrome>{children}</SiteChrome>
            </CartProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
