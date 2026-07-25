'use client';

import * as React from 'react';
import { useHomepage, useSiteSettings } from '@/hooks/queries';

/** Set or update a `<meta name>` tag, creating it if absent. */
function setMeta(name: string, content: string) {
  if (!content) return;
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/**
 * Applies the homepage SEO overrides (`homepage.seo`) to the document.
 *
 * The app is a static export, so `generateMetadata` cannot read Firestore at
 * build time — the baked `<head>` ships the site defaults, and this client
 * component refines the title/description/keywords once the CMS data loads.
 * Renders nothing.
 */
export function HomepageSeo() {
  const { data: homepage } = useHomepage();
  const { data: settings } = useSiteSettings();

  React.useEffect(() => {
    if (!homepage || !settings) return;
    const seo = homepage.seo;
    const storeName = settings.storeName || 'BlueBuy';

    if (seo.title) document.title = `${seo.title} | ${storeName}`;
    setMeta('description', seo.description || settings.tagline);
    if (seo.keywords.length > 0) setMeta('keywords', seo.keywords.join(', '));
  }, [homepage, settings]);

  return null;
}
