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
import { DEFAULT_CURRENCY } from '@/lib/format';

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
  /**
   * Store WhatsApp number in international format, digits only (no `+` or
   * spaces), e.g. `15551234567`. Drives the floating support button and the
   * post-order handoff. Empty hides the floating button entirely.
   */
  whatsappNumber: string;
  /**
   * Greeting pre-filled when a customer opens the floating WhatsApp chat from
   * anywhere that isn't a product page. Product pages build their own message
   * from the product's name — see `buildProductMessage` in `@/hooks/use-whatsapp`.
   */
  whatsappMessage: string;
  businessAddress: string;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  storeName: 'BlueBuy',
  tagline: 'Discover and shop carefully selected products.',
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
  // Contact details are deliberately empty by default: every surface that shows
  // them hides itself when the value is blank, so an unconfigured store shows no
  // contact method rather than a fictional one. Fill these in from
  // Admin → CMS → Site settings.
  supportEmail: '',
  supportPhone: '',
  whatsappNumber: '',
  whatsappMessage: 'As-salamu Alaikum! I have a question about BlueBuy.',
  businessAddress: '',
  // Build-time currency, not a literal: this default is what every price renders
  // with until Firestore responds (it is React Query's placeholder for
  // `site_settings`), so hard-coding 'USD' here made prerendered HTML disagree
  // with the store's real currency. See DEFAULT_CURRENCY in `@/lib/format`.
  currency: DEFAULT_CURRENCY,
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
  seo: HomepageSeo;
}

export const DEFAULT_HOMEPAGE: Homepage = {
  hero: {
    eyebrow: 'Shop the catalogue',
    title: 'Discover products you’ll love',
    subtitle:
      'Explore a growing selection of products from trusted brands and the BlueBuy Collection.',
    primaryCta: { label: 'Shop now', href: '/products' },
    secondaryCta: { label: 'Explore categories', href: '/#categories' },
    backgroundImage: '',
  },
  featuredCategoryIds: [],
  featuredProductIds: [],
  promoBanner: {
    enabled: true,
    title: 'Find your next favourite product',
    subtitle:
      'Browse the full catalogue by category or brand — and message us if you need help choosing.',
    cta: { label: 'Shop all products', href: '/products' },
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

/**
 * Every default link below points at a page that actually exists. Two omissions
 * are deliberate:
 *
 *  - Policy pages (shipping, returns, FAQ, privacy, terms) — a link labelled
 *    "Returns" that lands on `/contact` implies a policy the store has not
 *    published. Add them once the pages exist.
 *  - A "Brands" link — the homepage brand section only renders when the
 *    catalogue carries third-party brands, so the `/#brands` anchor would be
 *    dead for an entirely own-label catalogue. Add it once brands are stocked.
 *
 * Admin → CMS → Footer overrides all of this.
 */
export const DEFAULT_FOOTER: Footer = {
  tagline:
    'Discover and shop carefully selected products, from trusted brands and our own BlueBuy Collection.',
  columns: [
    {
      title: 'Shop',
      links: [
        { label: 'All products', href: '/products' },
        { label: 'Categories', href: '/#categories' },
        { label: 'BlueBuy Collection', href: '/products?brand=bluebuy-collection' },
      ],
    },
    {
      title: 'Customer',
      links: [
        { label: 'Contact us', href: '/contact' },
        { label: 'Your cart', href: '/cart' },
      ],
    },
    {
      title: 'Company',
      links: [{ label: 'About BlueBuy', href: '/about' }],
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
  /** Physical address / shop location. */
  address: string;
  /** Optional supporting line (e.g. opening hours). */
  hours: string;
  /**
   * Optional endpoint for a hosted form service (Formspree, Web3Forms, Getform,
   * …) that forwards submissions to the store's inbox. This is a **public**
   * endpoint URL, never an API secret — the static site has no server to hide
   * one behind. When empty, the contact form hands the message off to WhatsApp
   * or email instead, so it always reaches a real destination.
   */
  formEndpoint: string;
}

export const DEFAULT_CONTACT_INFORMATION: ContactInformation = {
  eyebrow: 'Contact',
  heading: 'How can we help?',
  subheading:
    'Questions about a product, an order or availability? Send us a message and we’ll get back to you.',
  // Left blank on purpose — each method renders only when it has a real value.
  // Fill these in from Admin → CMS → Contact information.
  email: '',
  phone: '',
  address: '',
  hours: '',
  formEndpoint: '',
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

/**
 * Seed items used when the `social_links` collection is empty.
 *
 * Deliberately empty: the storefront must only ever link to accounts BlueBuy
 * actually has. Add the real ones from Admin → CMS → Social links.
 */
export const DEFAULT_SOCIAL_LINKS: Omit<SocialLink, 'id'>[] = [];
