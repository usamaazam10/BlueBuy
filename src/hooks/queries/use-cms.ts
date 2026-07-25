'use client';

/**
 * Storefront data hooks for the CMS content collections.
 *
 * Every hook resolves to renderable content **immediately**: singleton reads
 * use the model defaults as React Query `placeholderData` (so the hero, footer,
 * etc. paint real copy on first frame with no skeleton flash, then swap to the
 * stored values), and the list hooks fall back to the seed defaults while
 * loading or when a collection is empty. The result is a site that renders
 * identically before it has ever been seeded.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  SiteSettingsRepository,
  HomepageRepository,
  FooterRepository,
  ContactRepository,
  NavigationRepository,
  BannerRepository,
  SocialLinkRepository,
} from '@/repositories';
import {
  DEFAULT_SITE_SETTINGS,
  DEFAULT_HOMEPAGE,
  DEFAULT_FOOTER,
  DEFAULT_CONTACT_INFORMATION,
  DEFAULT_NAV_ITEMS,
  DEFAULT_SOCIAL_LINKS,
  type SiteSettings,
  type Homepage,
  type Footer,
  type ContactInformation,
  type NavItem,
  type Banner,
  type SocialLink,
} from '@/types/cms';
import { queryKeys } from './keys';

/** Give the seed items stable ids so they can be used as list fallbacks. */
const FALLBACK_NAV: NavItem[] = DEFAULT_NAV_ITEMS.map((item, index) => ({
  ...item,
  id: `default-${index}`,
}));
const FALLBACK_SOCIAL: SocialLink[] = DEFAULT_SOCIAL_LINKS.map((item, index) => ({
  ...item,
  id: `default-${index}`,
}));

// ─────────────────────────────── singletons ──────────────────────────────────

export function useSiteSettings() {
  const query = useQuery<SiteSettings>({
    queryKey: queryKeys.siteSettings,
    queryFn: () => SiteSettingsRepository.get(),
    placeholderData: DEFAULT_SITE_SETTINGS,
  });
  // Always resolve to a value — defaults cover loading and error alike, so the
  // storefront renders identically before it has ever been seeded.
  return { ...query, data: query.data ?? DEFAULT_SITE_SETTINGS };
}

export function useHomepage() {
  const query = useQuery<Homepage>({
    queryKey: queryKeys.homepage,
    queryFn: () => HomepageRepository.get(),
    placeholderData: DEFAULT_HOMEPAGE,
  });
  return { ...query, data: query.data ?? DEFAULT_HOMEPAGE };
}

export function useFooterContent() {
  const query = useQuery<Footer>({
    queryKey: queryKeys.footer,
    queryFn: () => FooterRepository.get(),
    placeholderData: DEFAULT_FOOTER,
  });
  return { ...query, data: query.data ?? DEFAULT_FOOTER };
}

export function useContactInformation() {
  const query = useQuery<ContactInformation>({
    queryKey: queryKeys.contactInformation,
    queryFn: () => ContactRepository.get(),
    placeholderData: DEFAULT_CONTACT_INFORMATION,
  });
  return { ...query, data: query.data ?? DEFAULT_CONTACT_INFORMATION };
}

// ─────────────────────────────── collections ─────────────────────────────────

/** Active navigation items, falling back to the seed items when empty/loading. */
export function useNavigationItems() {
  const query = useQuery<NavItem[]>({
    queryKey: queryKeys.navigation,
    queryFn: () => NavigationRepository.listActive(),
  });
  const items = useMemo(
    () => (query.data && query.data.length > 0 ? query.data : FALLBACK_NAV),
    [query.data]
  );
  return { ...query, items };
}

/** Active social links, falling back to the seed items when empty/loading. */
export function useSocialLinksList() {
  const query = useQuery<SocialLink[]>({
    queryKey: queryKeys.socialLinks,
    queryFn: () => SocialLinkRepository.listActive(),
  });
  const items = useMemo(
    () => (query.data && query.data.length > 0 ? query.data : FALLBACK_SOCIAL),
    [query.data]
  );
  return { ...query, items };
}

/** Active banners (no fallback — an empty collection renders nothing). */
export function useActiveBanners() {
  const query = useQuery<Banner[]>({
    queryKey: queryKeys.banners,
    queryFn: () => BannerRepository.listActive(),
  });
  return { ...query, items: query.data ?? [] };
}
