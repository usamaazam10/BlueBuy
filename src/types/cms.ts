/**
 * CMS content models — the marketing surface managed from the admin and
 * rendered by the storefront.
 *
 * These describe how CMS documents are shaped **in Firestore**. They are kept
 * separate from the catalogue models in `@/types/models` (products, categories,
 * …) and from the storefront view-models in `@/types/store`, so the editable
 * content layer can evolve on its own. Import these from `@/types/cms`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Storage shape (see COLLECTIONS in `@/types/models`):
 *
 *   Singleton documents — exactly one doc per collection, id = "main":
 *     site_settings/main        → SiteSettings
 *     homepage/main             → Homepage
 *     footer/main               → Footer
 *     contact_information/main  → ContactInformation
 *
 *   Item collections — many ordered documents:
 *     navigation/{id}           → NavItem
 *     banners/{id}              → Banner
 *     social_links/{id}         → SocialLink
 *
 * Every model ships with a `DEFAULT_*` constant below. These are the graceful
 * fallback the storefront renders **before Firestore data arrives or when a
 * collection is empty**, and the seed value the admin forms open with. They are
 * derived from the content that used to be hard-coded, so an un-seeded database
 * renders an identical site.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** A call-to-action / navigation link (label + destination). */
export interface CmsLink {
  label: string;
  href: string;
}

// ─────────────────────────────── site_settings ───────────────────────────────

/** Store identity + global configuration — collection: `site_settings` (singleton). */
export interface SiteSettings {
  storeName: string;
  tagline: string;
  /** Primary logo image URL; empty renders the built-in wordmark. Used everywhere unless a surface-specific logo below overrides it. */
  logoUrl: string;
  /** Favicon URL; empty falls back to the built-in brand mark. */
  faviconUrl: string;
  /** Apple touch icon URL (iOS home-screen); empty falls back to the brand mark. */
  appleTouchIconUrl: string;
  /** Social share (Open Graph) image URL; empty falls back to the brand mark. */
  ogImageUrl: string;
  /** PWA manifest icon URL; empty falls back to the brand mark. */
  manifestIconUrl: string;
  /** Header-specific logo override; empty uses `logoUrl` then the wordmark. */
  headerLogoUrl: string;
  /** Footer-specific logo override; empty uses `logoUrl` then the wordmark. */
  footerLogoUrl: string;
  /** Email logo (future-ready — used by transactional emails); empty uses `logoUrl`. */
  emailLogoUrl: string;
  /** Brand/primary colour (hex). Injected as the `--brand` CSS variable. */
  primaryColor: string;
  /** Secondary/accent colour (hex). Injected as `--brand-accent`. */
  secondaryColor: string;
  supportEmail: string;
  supportPhone: string;
  businessAddress: string;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  storeName: 'BlueBuy',
  tagline: 'A modern, production-ready ecommerce experience.',
  logoUrl: '',
  faviconUrl: '',
  appleTouchIconUrl: '',
  ogImageUrl: '',
  manifestIconUrl: '',
  headerLogoUrl: '',
  footerLogoUrl: '',
  emailLogoUrl: '',
  primaryColor: '',
  secondaryColor: '',
  supportEmail: 'support@bluebuy.com',
  supportPhone: '+1 (555) 010-2040',
  businessAddress: '500 Market St, San Francisco',
  currency: 'USD',
  timezone: 'America/Los_Angeles',
};

// ──────────────────────────────────── homepage ───────────────────────────────

/** Hero band content. */
export interface HeroContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: CmsLink;
  secondaryCta: CmsLink;
  /** Background image URL; empty renders the built-in geometric background. */
  backgroundImage: string;
}

/** Promotional banner section (the storefront's CTA band). */
export interface PromoBanner {
  enabled: boolean;
  title: string;
  subtitle: string;
  cta: CmsLink;
}

/** Newsletter sign-up section (rendered in the footer). */
export interface NewsletterSection {
  enabled: boolean;
  title: string;
  subtitle: string;
  placeholder: string;
  buttonLabel: string;
}

/** Homepage-specific SEO overrides. */
export interface HomepageSeo {
  title: string;
  description: string;
  keywords: string[];
}

/** Homepage content — collection: `homepage` (singleton). */
export interface Homepage {
  hero: HeroContent;
  /**
   * Ordered category ids to feature. Empty = auto (show all active
   * categories, sorted by their own `sortOrder`).
   */
  featuredCategoryIds: string[];
  /**
   * Ordered product ids to feature. Empty = auto (products flagged
   * `featured`, backfilled with the rest).
   */
  featuredProductIds: string[];
  promoBanner: PromoBanner;
  newsletter: NewsletterSection;
  seo: HomepageSeo;
}

export const DEFAULT_HOMEPAGE: Homepage = {
  hero: {
    eyebrow: 'New season, new arrivals',
    title: 'Premium tech, beautifully simple.',
    subtitle:
      'BlueBuy brings together thoughtfully designed audio, wearables and displays — the essentials, refined. Free shipping, 30-day returns.',
    primaryCta: { label: 'Shop the collection', href: '/products' },
    secondaryCta: { label: 'Our story', href: '/about' },
    backgroundImage: '',
  },
  featuredCategoryIds: [],
  featuredProductIds: [],
  promoBanner: {
    enabled: true,
    title: 'Ready to upgrade your everyday?',
    subtitle:
      'Join thousands who’ve made the switch to BlueBuy. Discover products that fit seamlessly into your life.',
    cta: { label: 'Start shopping', href: '/products' },
  },
  newsletter: {
    enabled: true,
    title: 'Join our newsletter',
    subtitle: 'Get product drops, offers and stories — straight to your inbox.',
    placeholder: 'you@example.com',
    buttonLabel: 'Subscribe',
  },
  seo: {
    title: '',
    description: '',
    keywords: [],
  },
};

// ───────────────────────────────────── footer ────────────────────────────────

/** A titled column of footer links (Company / Support / Legal / …). */
export interface FooterColumn {
  title: string;
  links: CmsLink[];
}

/** Footer content — collection: `footer` (singleton). Social links live in `social_links`. */
export interface Footer {
  tagline: string;
  columns: FooterColumn[];
  /** Copyright line. `{year}` is replaced with the current year at render. */
  copyright: string;
}

export const DEFAULT_FOOTER: Footer = {
  tagline: 'Premium tech, thoughtfully designed. Free shipping and 30-day returns on every order.',
  columns: [
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Products', href: '/products' },
        { label: 'Careers', href: '/about' },
        { label: 'Press', href: '/about' },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Contact', href: '/contact' },
        { label: 'Shipping', href: '/contact' },
        { label: 'Returns', href: '/contact' },
        { label: 'Warranty', href: '/contact' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/contact' },
        { label: 'Terms', href: '/contact' },
        { label: 'Cookies', href: '/contact' },
        { label: 'Licenses', href: '/contact' },
      ],
    },
  ],
  copyright: '© {year} BlueBuy. All rights reserved.',
};

// ─────────────────────────────── contact_information ─────────────────────────

/** Contact page + footer contact details — collection: `contact_information` (singleton). */
export interface ContactInformation {
  eyebrow: string;
  heading: string;
  subheading: string;
  email: string;
  phone: string;
  /** Physical address / studio label. */
  address: string;
  /** Optional supporting line (e.g. opening hours). */
  hours: string;
}

export const DEFAULT_CONTACT_INFORMATION: ContactInformation = {
  eyebrow: 'Contact',
  heading: 'We’d love to hear from you',
  subheading:
    'Questions about a product, an order, or just want to say hello? Our team replies within one business day.',
  email: 'support@bluebuy.com',
  phone: '+1 (555) 010-2040',
  address: '500 Market St, San Francisco',
  hours: '',
};

// ─────────────────────────────────── navigation ──────────────────────────────

/** A primary-navigation menu item — collection: `navigation`. */
export interface NavItem {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  active: boolean;
}

/** Seed items used when the `navigation` collection is empty. */
export const DEFAULT_NAV_ITEMS: Omit<NavItem, 'id'>[] = [
  { label: 'Home', href: '/', sortOrder: 0, active: true },
  { label: 'Products', href: '/products', sortOrder: 1, active: true },
  { label: 'About', href: '/about', sortOrder: 2, active: true },
  { label: 'Contact', href: '/contact', sortOrder: 3, active: true },
];

// ──────────────────────────────────── banners ────────────────────────────────

/** Where a banner renders. `announcement` = the dismissible top bar. */
export type BannerPlacement = 'announcement';

/** A site banner — collection: `banners`. */
export interface Banner {
  id: string;
  message: string;
  /** Optional inline call-to-action. */
  linkLabel: string;
  linkHref: string;
  placement: BannerPlacement;
  /** Background colour (hex); empty renders the brand colour. */
  background: string;
  sortOrder: number;
  active: boolean;
}

// ────────────────────────────────── social_links ─────────────────────────────

/** Supported social platforms (each maps to a lucide icon in the UI). */
export const SOCIAL_PLATFORMS = [
  'twitter',
  'instagram',
  'facebook',
  'youtube',
  'linkedin',
  'github',
  'tiktok',
  'website',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** A social link — collection: `social_links`. */
export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  /** Accessible label; empty falls back to the platform name. */
  label: string;
  url: string;
  sortOrder: number;
  active: boolean;
}

/** Seed items used when the `social_links` collection is empty. */
export const DEFAULT_SOCIAL_LINKS: Omit<SocialLink, 'id'>[] = [
  { platform: 'twitter', label: 'Twitter', url: '#', sortOrder: 0, active: true },
  { platform: 'instagram', label: 'Instagram', url: '#', sortOrder: 1, active: true },
  { platform: 'github', label: 'GitHub', url: '#', sortOrder: 2, active: true },
  { platform: 'linkedin', label: 'LinkedIn', url: '#', sortOrder: 3, active: true },
];
