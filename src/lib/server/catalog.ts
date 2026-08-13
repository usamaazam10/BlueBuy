/**
 * Build-time catalogue loader for statically-generated pages.
 *
 * The storefront is a static export, so `generateStaticParams`,
 * `generateMetadata` and the product page body all run at **build time**. Those
 * hooks are called once per product; this module memoises a single catalogue
 * read (products + categories + brands) for the whole build so the exporter hits
 * Firestore once rather than three times per page.
 *
 * The client renders the same data live via `useStoreProducts` — this is the
 * server-side twin used only during prerendering.
 */
import {
  ProductRepository,
  CategoryRepository,
  BrandRepository,
  SiteSettingsRepository,
  HomepageRepository,
  FooterRepository,
  ContactRepository,
  NavigationRepository,
  SocialLinkRepository,
  BannerRepository,
} from '@/repositories';
import { toStoreProducts } from '@/lib/mappers/store';
import type { StoreProduct } from '@/types/store';
import type {
  SiteSettings,
  Homepage,
  Footer,
  ContactInformation,
  NavItem,
  SocialLink,
  Banner,
} from '@/types/cms';

let catalogPromise: Promise<StoreProduct[]> | null = null;
let settingsPromise: Promise<SiteSettings | null> | null = null;
let cmsPromise: Promise<BuildTimeCms> | null = null;

/** Best-effort read: categories/brands may be locked down by security rules;
 *  when they are, we still render products (names fall back to a humanised id). */
async function safeList<T>(fn: () => Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[catalog] optional read "${label}" failed — continuing without it:`, error);
    return [];
  }
}

/** Best-effort site settings read — prerendering must not fail without them. */
async function safeSettings(): Promise<SiteSettings | null> {
  try {
    return await SiteSettingsRepository.get();
  } catch (error) {
    console.warn('[catalog] optional read "site settings" failed — using defaults:', error);
    return null;
  }
}

/**
 * Site settings read once for the whole build.
 *
 * The root layout seeds these into the React Query cache, so every prerendered
 * page renders with the store's real currency/branding instead of the built-in
 * defaults — and the client hydrates against the same values. Returns `null`
 * when Firestore is unreachable; callers fall back to defaults.
 */
export function getSiteSettings(): Promise<SiteSettings | null> {
  if (!settingsPromise) settingsPromise = safeSettings();
  return settingsPromise;
}

/** The CMS content that shapes the storefront's visible copy and chrome. */
export interface BuildTimeCms {
  homepage: Homepage | null;
  footer: Footer | null;
  contact: ContactInformation | null;
  navigation: NavItem[] | null;
  socialLinks: SocialLink[] | null;
  banners: Banner[] | null;
}

/** Best-effort singleton read — prerendering must not fail without one. */
async function safeSingleton<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[catalog] optional read "${label}" failed — using defaults:`, error);
    return null;
  }
}

/**
 * The editable CMS content (`homepage`, `footer`, `contact_information`), read
 * once for the whole build.
 *
 * Without this the exporter bakes the `DEFAULT_*` constants into every page and
 * the browser then swaps in the stored copy on hydration — a visible flash of
 * one hero headline turning into another, and search engines indexing the
 * placeholder copy rather than the store's own. The root layout seeds these into
 * React Query so the first paint is already the real content.
 *
 * Each entry is `null` when Firestore is unreachable; the hooks fall back to
 * their defaults exactly as before.
 */
export function getCmsContent(): Promise<BuildTimeCms> {
  if (!cmsPromise) {
    cmsPromise = Promise.all([
      safeSingleton(() => HomepageRepository.get(), 'homepage'),
      safeSingleton(() => FooterRepository.get(), 'footer'),
      safeSingleton(() => ContactRepository.get(), 'contact information'),
      safeSingleton(() => NavigationRepository.listActive(), 'navigation'),
      safeSingleton(() => SocialLinkRepository.listActive(), 'social links'),
      safeSingleton(() => BannerRepository.listActive(), 'banners'),
    ]).then(([homepage, footer, contact, navigation, socialLinks, banners]) => ({
      homepage,
      footer,
      contact,
      navigation,
      socialLinks,
      banners,
    }));
  }
  return cmsPromise;
}

async function loadCatalog(): Promise<StoreProduct[]> {
  // Products are required; categories/brands only enrich display names, and
  // site settings only supply the display currency for prerendered prices/JSON-LD.
  const [products, categories, brands, settings] = await Promise.all([
    ProductRepository.listActive(),
    safeList(() => CategoryRepository.listActive(), 'categories'),
    safeList(() => BrandRepository.listActive(), 'brands'),
    getSiteSettings(),
  ]);
  return toStoreProducts(products, categories, brands, settings?.currency);
}

/** All active products, mapped + memoised for the duration of the build. */
export function getStoreCatalog(): Promise<StoreProduct[]> {
  if (!catalogPromise) catalogPromise = loadCatalog();
  return catalogPromise;
}

/** A single mapped product by slug, or `null` when it doesn't exist. */
export async function getStoreProductBySlug(slug: string): Promise<StoreProduct | null> {
  const catalog = await getStoreCatalog();
  return catalog.find((product) => product.slug === slug) ?? null;
}

/** Related products: same category first, then others, excluding the product. */
export async function getRelatedStoreProducts(
  product: StoreProduct,
  limit = 4
): Promise<StoreProduct[]> {
  const catalog = await getStoreCatalog();
  const sameCategory = catalog.filter(
    (candidate) => candidate.categorySlug === product.categorySlug && candidate.id !== product.id
  );
  const others = catalog.filter(
    (candidate) => candidate.categorySlug !== product.categorySlug && candidate.id !== product.id
  );
  return [...sameCategory, ...others].slice(0, limit);
}
