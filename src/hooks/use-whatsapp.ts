'use client';

import * as React from 'react';
import { useSiteSettings } from '@/hooks/queries';
import { env } from '@/lib/env';

/**
 * Message pre-filled when a customer starts a chat from a product page.
 * `{product}` is replaced with that product's name.
 */
const PRODUCT_MESSAGE_TEMPLATE =
  "As-salamu Alaikum! I'm interested in {product} on BlueBuy. Could you please provide more information?";

/**
 * Greeting used off product pages when the CMS has no custom message set.
 * Mirrors {@link DEFAULT_SITE_SETTINGS.whatsappMessage}.
 */
export const GENERAL_MESSAGE = 'As-salamu Alaikum! I have a question about BlueBuy.';

/** Build the product-enquiry message for a given product name. */
export function buildProductMessage(productName: string): string {
  return PRODUCT_MESSAGE_TEMPLATE.replace('{product}', productName);
}

/** What {@link useWhatsApp} returns. */
export interface UseWhatsApp {
  /** Digits-only international number, or `''` when WhatsApp isn't configured. */
  number: string;
  /** True when a usable number is configured — gate WhatsApp UI on this. */
  enabled: boolean;
  /** The store's general greeting from the CMS (used off product pages). */
  defaultMessage: string;
  /** Build a `wa.me` deep link with an optional pre-filled message. */
  buildUrl: (message?: string) => string;
}

/**
 * The store's WhatsApp contact, sourced from `site_settings` (CMS).
 *
 * The number is **never hardcoded in components** — it comes from the CMS so an
 * admin can change it without a rebuild. `NEXT_PUBLIC_STORE_WHATSAPP` is only a
 * migration fallback for stores whose settings doc predates the CMS field; once
 * the field is filled in, the CMS always wins.
 */
export function useWhatsApp(): UseWhatsApp {
  const { data: settings } = useSiteSettings();

  const number = (settings?.whatsappNumber || env.storeWhatsApp || '').replace(/\D/g, '');
  // An empty CMS greeting would open WhatsApp with a blank composer; fall back
  // to the store's standard greeting so the enquiry always starts somewhere.
  const defaultMessage = settings?.whatsappMessage?.trim() || GENERAL_MESSAGE;

  const buildUrl = React.useCallback(
    (message?: string) => {
      const text = (message ?? defaultMessage).trim();
      const query = text ? `?text=${encodeURIComponent(text)}` : '';
      return `https://wa.me/${number}${query}`;
    },
    [number, defaultMessage]
  );

  return { number, enabled: number.length >= 8, defaultMessage, buildUrl };
}
