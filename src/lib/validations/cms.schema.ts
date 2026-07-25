/**
 * Zod schemas for the CMS content collections.
 * Mirrors the interfaces in `@/types/cms`.
 *
 * Singleton documents (`site_settings`, `homepage`, `footer`,
 * `contact_information`) validate their whole shape on save. Item collections
 * (`navigation`, `banners`, `social_links`) expose create/update schemas like
 * the catalogue entities.
 */
import { z } from 'zod';
import { SOCIAL_PLATFORMS } from '@/types/cms';

/**
 * A link destination: an internal path (`/products`), an anchor (`#`), an
 * absolute URL, or a `mailto:`/`tel:`. Kept permissive on purpose — editors
 * enter friendly hrefs, not just URLs.
 */
const hrefSchema = z.string().trim().max(2048).default('');

/** A hex colour, or empty string to fall back to the theme default. */
const hexColorSchema = z
  .string()
  .trim()
  .regex(/^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/, 'Must be a hex colour like #4f46e5')
  .default('');

/** An image URL, or empty string for "use the built-in default". */
const imageUrlSchema = z.union([z.url(), z.literal('')]).default('');

const cmsLinkSchema = z.object({
  label: z.string().trim().max(120).default(''),
  href: hrefSchema,
});

// ─────────────────────────────── site_settings ───────────────────────────────

export const siteSettingsSchema = z.object({
  storeName: z.string().trim().min(1, 'Store name is required').max(120),
  tagline: z.string().trim().max(300).default(''),
  logoUrl: imageUrlSchema,
  faviconUrl: imageUrlSchema,
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  supportEmail: z.union([z.email(), z.literal('')]).default(''),
  supportPhone: z.string().trim().max(60).default(''),
  businessAddress: z.string().trim().max(300).default(''),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/, 'Must be a 3-letter ISO code')
    .transform((v) => v.toUpperCase())
    .default('USD'),
  timezone: z.string().trim().max(80).default('UTC'),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

// ──────────────────────────────────── homepage ───────────────────────────────

export const homepageSchema = z.object({
  hero: z.object({
    eyebrow: z.string().trim().max(120).default(''),
    title: z.string().trim().min(1, 'Hero title is required').max(200),
    subtitle: z.string().trim().max(600).default(''),
    primaryCta: cmsLinkSchema,
    secondaryCta: cmsLinkSchema,
    backgroundImage: imageUrlSchema,
  }),
  featuredCategoryIds: z.array(z.string()).default([]),
  featuredProductIds: z.array(z.string()).default([]),
  promoBanner: z.object({
    enabled: z.boolean().default(true),
    title: z.string().trim().max(200).default(''),
    subtitle: z.string().trim().max(600).default(''),
    cta: cmsLinkSchema,
  }),
  newsletter: z.object({
    enabled: z.boolean().default(true),
    title: z.string().trim().max(200).default(''),
    subtitle: z.string().trim().max(600).default(''),
    placeholder: z.string().trim().max(120).default(''),
    buttonLabel: z.string().trim().max(60).default(''),
  }),
  seo: z.object({
    title: z.string().trim().max(200).default(''),
    description: z.string().trim().max(400).default(''),
    keywords: z.array(z.string().trim()).default([]),
  }),
});

export type HomepageInput = z.infer<typeof homepageSchema>;

// ───────────────────────────────────── footer ────────────────────────────────

export const footerSchema = z.object({
  tagline: z.string().trim().max(400).default(''),
  columns: z
    .array(
      z.object({
        title: z.string().trim().max(80).default(''),
        links: z.array(cmsLinkSchema).default([]),
      })
    )
    .default([]),
  copyright: z.string().trim().max(300).default(''),
});

export type FooterInput = z.infer<typeof footerSchema>;

// ─────────────────────────────── contact_information ─────────────────────────

export const contactInformationSchema = z.object({
  eyebrow: z.string().trim().max(120).default(''),
  heading: z.string().trim().max(200).default(''),
  subheading: z.string().trim().max(600).default(''),
  email: z.union([z.email(), z.literal('')]).default(''),
  phone: z.string().trim().max(60).default(''),
  address: z.string().trim().max(300).default(''),
  hours: z.string().trim().max(200).default(''),
});

export type ContactInformationInput = z.infer<typeof contactInformationSchema>;

// ─────────────────────────────────── navigation ──────────────────────────────

const navItemBaseSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(80),
  href: hrefSchema,
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const navItemCreateSchema = navItemBaseSchema;
export const navItemUpdateSchema = navItemBaseSchema.partial();

export type NavItemCreateInput = z.infer<typeof navItemCreateSchema>;
export type NavItemUpdateInput = z.infer<typeof navItemUpdateSchema>;

// ──────────────────────────────────── banners ────────────────────────────────

const bannerBaseSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(300),
  linkLabel: z.string().trim().max(80).default(''),
  linkHref: hrefSchema,
  placement: z.enum(['announcement']).default('announcement'),
  background: hexColorSchema,
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const bannerCreateSchema = bannerBaseSchema;
export const bannerUpdateSchema = bannerBaseSchema.partial();

export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;

// ────────────────────────────────── social_links ─────────────────────────────

const socialLinkBaseSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  label: z.string().trim().max(60).default(''),
  url: z.string().trim().min(1, 'URL is required').max(2048),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const socialLinkCreateSchema = socialLinkBaseSchema;
export const socialLinkUpdateSchema = socialLinkBaseSchema.partial();

export type SocialLinkCreateInput = z.infer<typeof socialLinkCreateSchema>;
export type SocialLinkUpdateInput = z.infer<typeof socialLinkUpdateSchema>;
