'use client';

import * as React from 'react';
import { useSiteSettings } from '@/hooks/queries';

/**
 * Applies global `site_settings` to the live document: the brand colour (as the
 * `--brand` CSS variable, which every `bg-brand`/`text-brand` token and the SVG
 * logo read from), a secondary accent (`--brand-accent`), and the favicon.
 *
 * Renders nothing. Mounted once near the root so a single settings change
 * re-themes the whole app without touching component code. Because the app is a
 * static export, this runs on the client — the baked defaults render first,
 * then these overrides apply once Firestore responds.
 */
export function SiteSettingsRuntime() {
  const { data: settings } = useSiteSettings();

  React.useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    if (settings.primaryColor) root.style.setProperty('--brand', settings.primaryColor);
    else root.style.removeProperty('--brand');

    if (settings.secondaryColor) root.style.setProperty('--brand-accent', settings.secondaryColor);
    else root.style.removeProperty('--brand-accent');
  }, [settings]);

  React.useEffect(() => {
    if (!settings?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = settings.faviconUrl;
  }, [settings?.faviconUrl]);

  return null;
}
