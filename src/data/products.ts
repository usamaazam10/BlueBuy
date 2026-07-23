import type { Product } from '@/types';

/**
 * Local mock catalogue for the UI phase. No backend, no APIs — this file is the
 * single source of truth for products across the site.
 *
 * `images` are seed strings used by <ProductMedia> to generate geometric
 * placeholder artwork; no stock photography is used anywhere.
 */
export const PRODUCTS: Product[] = [
  {
    id: 'p-01',
    slug: 'aura-wireless-headphones',
    title: 'Aura Wireless Headphones',
    price: 329,
    compareAtPrice: 379,
    category: 'audio',
    rating: 4.8,
    reviewCount: 1284,
    description:
      'Over-ear headphones with adaptive noise cancellation and a 40-hour battery. Memory-foam cushions and a machined aluminium frame make Aura disappear on your head while the sound stays front and centre.',
    images: ['aura-1', 'aura-2', 'aura-3'],
    badge: 'Sale',
    stock: 24,
    accent: '#6366f1',
    highlights: [
      'Adaptive hybrid noise cancellation',
      '40-hour battery, 5-min quick charge',
      'Spatial audio with head tracking',
    ],
    specs: [
      { label: 'Driver', value: '40mm dynamic' },
      { label: 'Battery', value: '40 hours (ANC on)' },
      { label: 'Connectivity', value: 'Bluetooth 5.3, USB-C' },
      { label: 'Weight', value: '248 g' },
      { label: 'Warranty', value: '2 years' },
    ],
  },
  {
    id: 'p-02',
    slug: 'pulse-pro-earbuds',
    title: 'Pulse Pro Earbuds',
    price: 189,
    category: 'audio',
    rating: 4.6,
    reviewCount: 842,
    description:
      'Featherweight earbuds with a custom-tuned six-driver system. Pulse Pro reads your ear canal and adapts, delivering rich, balanced sound with pinpoint call clarity.',
    images: ['pulse-1', 'pulse-2', 'pulse-3'],
    badge: 'New',
    stock: 58,
    accent: '#4f46e5',
    highlights: ['Adaptive transparency mode', 'Wireless charging case', 'IPX5 sweat resistance'],
    specs: [
      { label: 'Drivers', value: '6 per bud' },
      { label: 'Battery', value: '8h + 24h case' },
      { label: 'Connectivity', value: 'Bluetooth 5.3' },
      { label: 'Water resistance', value: 'IPX5' },
      { label: 'Warranty', value: '1 year' },
    ],
  },
  {
    id: 'p-03',
    slug: 'vertex-smartwatch',
    title: 'Vertex Smartwatch',
    price: 449,
    category: 'wearables',
    rating: 4.9,
    reviewCount: 2103,
    description:
      'A titanium smartwatch with an always-on LTPO display and dual-band GPS. Vertex tracks recovery, sleep and 40+ workouts while lasting the whole weekend on a charge.',
    images: ['vertex-1', 'vertex-2', 'vertex-3'],
    badge: 'Bestseller',
    stock: 12,
    accent: '#0ea5e9',
    highlights: [
      'Aerospace-grade titanium case',
      'Dual-band precision GPS',
      'Up to 72-hour battery life',
    ],
    specs: [
      { label: 'Case', value: '45mm titanium' },
      { label: 'Display', value: 'LTPO AMOLED, always-on' },
      { label: 'Battery', value: 'Up to 72 hours' },
      { label: 'Sensors', value: 'HR, SpO2, ECG, GPS' },
      { label: 'Warranty', value: '2 years' },
    ],
  },
  {
    id: 'p-04',
    slug: 'halo-fitness-band',
    title: 'Halo Fitness Band',
    price: 99,
    compareAtPrice: 129,
    category: 'wearables',
    rating: 4.4,
    reviewCount: 617,
    description:
      'A slim, comfortable band that reads your body around the clock. Halo turns heart rate, stress and sleep into simple, actionable guidance.',
    images: ['halo-1', 'halo-2', 'halo-3'],
    badge: 'Sale',
    stock: 73,
    accent: '#06b6d4',
    highlights: ['14-day battery life', 'Skin-safe soft band', 'Stress & recovery scoring'],
    specs: [
      { label: 'Display', value: '1.1" AMOLED' },
      { label: 'Battery', value: 'Up to 14 days' },
      { label: 'Water resistance', value: '5 ATM' },
      { label: 'Sensors', value: 'HR, SpO2, skin temp' },
      { label: 'Warranty', value: '1 year' },
    ],
  },
  {
    id: 'p-05',
    slug: 'lumen-4k-monitor',
    title: 'Lumen 4K Monitor',
    price: 699,
    category: 'displays',
    rating: 4.7,
    reviewCount: 489,
    description:
      'A 27-inch 4K display with a factory-calibrated panel and 98% DCI-P3 coverage. Lumen brings colour-accurate detail to design, editing and everyday work.',
    images: ['lumen-1', 'lumen-2', 'lumen-3'],
    badge: 'Bestseller',
    stock: 31,
    accent: '#8b5cf6',
    highlights: ['Factory-calibrated colour', '98% DCI-P3 gamut', 'Single-cable USB-C, 96W PD'],
    specs: [
      { label: 'Size', value: '27" 4K UHD' },
      { label: 'Panel', value: 'IPS, 400 nits' },
      { label: 'Refresh', value: '60 Hz' },
      { label: 'Ports', value: 'USB-C 96W, 2x HDMI' },
      { label: 'Warranty', value: '3 years' },
    ],
  },
  {
    id: 'p-06',
    slug: 'nova-portable-display',
    title: 'Nova Portable Display',
    price: 279,
    category: 'displays',
    rating: 4.5,
    reviewCount: 356,
    description:
      'A 15-inch OLED travel monitor that weighs less than a tablet. Nova unfolds into a second screen anywhere, powered over a single USB-C cable.',
    images: ['nova-1', 'nova-2', 'nova-3'],
    badge: 'New',
    stock: 44,
    accent: '#a855f7',
    highlights: ['15.6" OLED panel', 'Under 600 g', 'Built-in kickstand cover'],
    specs: [
      { label: 'Size', value: '15.6" OLED' },
      { label: 'Resolution', value: '1920 x 1080' },
      { label: 'Weight', value: '590 g' },
      { label: 'Ports', value: '2x USB-C, mini-HDMI' },
      { label: 'Warranty', value: '2 years' },
    ],
  },
  {
    id: 'p-07',
    slug: 'cobalt-mechanical-keyboard',
    title: 'Cobalt Mechanical Keyboard',
    price: 159,
    category: 'accessories',
    rating: 4.8,
    reviewCount: 934,
    description:
      'A low-profile mechanical keyboard with hot-swappable switches and a CNC aluminium deck. Cobalt sounds as good as it feels, wired or wireless.',
    images: ['cobalt-1', 'cobalt-2', 'cobalt-3'],
    badge: 'Bestseller',
    stock: 66,
    accent: '#14b8a6',
    highlights: ['Hot-swappable switches', 'Gasket-mounted deck', 'Tri-mode connectivity'],
    specs: [
      { label: 'Layout', value: '75% (84 keys)' },
      { label: 'Switches', value: 'Low-profile, hot-swap' },
      { label: 'Connectivity', value: 'USB-C, BT, 2.4GHz' },
      { label: 'Battery', value: '4,000 mAh' },
      { label: 'Warranty', value: '2 years' },
    ],
  },
  {
    id: 'p-08',
    slug: 'glide-wireless-mouse',
    title: 'Glide Wireless Mouse',
    price: 89,
    category: 'accessories',
    rating: 4.6,
    reviewCount: 721,
    description:
      'An ergonomic wireless mouse with a 26K sensor and silent switches. Glide tracks flawlessly on any surface and recharges in minutes over USB-C.',
    images: ['glide-1', 'glide-2', 'glide-3'],
    stock: 88,
    accent: '#10b981',
    highlights: ['26,000 DPI sensor', 'Silent tactile clicks', '70-day battery life'],
    specs: [
      { label: 'Sensor', value: '26K DPI optical' },
      { label: 'Buttons', value: '6 programmable' },
      { label: 'Battery', value: 'Up to 70 days' },
      { label: 'Weight', value: '76 g' },
      { label: 'Warranty', value: '2 years' },
    ],
  },
  {
    id: 'p-09',
    slug: 'beacon-smart-speaker',
    title: 'Beacon Smart Speaker',
    price: 149,
    category: 'smart-home',
    rating: 4.5,
    reviewCount: 512,
    description:
      'A compact speaker with room-filling 360° sound and on-device voice control. Beacon adapts its acoustics to wherever you place it.',
    images: ['beacon-1', 'beacon-2', 'beacon-3'],
    badge: 'New',
    stock: 39,
    accent: '#f59e0b',
    highlights: ['360° adaptive audio', 'On-device voice control', 'Multi-room sync'],
    specs: [
      { label: 'Drivers', value: 'Woofer + 2 tweeters' },
      { label: 'Voice', value: 'On-device assistant' },
      { label: 'Connectivity', value: 'Wi-Fi 6, Bluetooth' },
      { label: 'Power', value: 'AC powered' },
      { label: 'Warranty', value: '1 year' },
    ],
  },
  {
    id: 'p-10',
    slug: 'ember-smart-bulb-set',
    title: 'Ember Smart Bulb Set',
    price: 79,
    compareAtPrice: 99,
    category: 'smart-home',
    rating: 4.3,
    reviewCount: 288,
    description:
      'A four-pack of colour-accurate smart bulbs with 16 million shades and scenes. Ember warms up your mornings and winds down your nights automatically.',
    images: ['ember-1', 'ember-2', 'ember-3'],
    badge: 'Limited',
    stock: 5,
    accent: '#fb923c',
    highlights: ['16M colours + warm-to-cool', 'Scenes & schedules', 'No hub required'],
    specs: [
      { label: 'Pack', value: '4 bulbs (E26)' },
      { label: 'Brightness', value: '1100 lumens each' },
      { label: 'Connectivity', value: 'Wi-Fi, Matter' },
      { label: 'Lifespan', value: '25,000 hours' },
      { label: 'Warranty', value: '2 years' },
    ],
  },
  {
    id: 'p-11',
    slug: 'frame-mirrorless-camera',
    title: 'Frame Mirrorless Camera',
    price: 1299,
    category: 'cameras',
    rating: 4.9,
    reviewCount: 401,
    description:
      'A 33MP full-frame mirrorless camera with in-body stabilisation and 4K/60 video. Frame pairs a compact body with pro-grade autofocus that never misses.',
    images: ['frame-1', 'frame-2', 'frame-3'],
    badge: 'Bestseller',
    stock: 9,
    accent: '#ef4444',
    highlights: ['33MP full-frame sensor', '5-axis in-body stabilisation', 'AI subject autofocus'],
    specs: [
      { label: 'Sensor', value: '33MP full-frame' },
      { label: 'Stabilisation', value: '5-axis IBIS' },
      { label: 'Video', value: '4K / 60fps' },
      { label: 'Mount', value: 'Frame E-mount' },
      { label: 'Warranty', value: '2 years' },
    ],
  },
  {
    id: 'p-12',
    slug: 'pocket-action-cam',
    title: 'Pocket Action Cam',
    price: 349,
    category: 'cameras',
    rating: 4.4,
    reviewCount: 265,
    description:
      'A thumb-sized action camera with 5.3K capture and gimbal-grade stabilisation. Pocket is waterproof to 10m straight out of the box.',
    images: ['pocket-1', 'pocket-2', 'pocket-3'],
    badge: 'New',
    stock: 27,
    accent: '#f43f5e',
    highlights: ['5.3K / 60fps capture', 'Built-in stabilisation', 'Waterproof to 10m'],
    specs: [
      { label: 'Resolution', value: '5.3K / 60fps' },
      { label: 'Stabilisation', value: 'HyperSteady 3.0' },
      { label: 'Waterproof', value: '10 m (no case)' },
      { label: 'Battery', value: '150 min recording' },
      { label: 'Warranty', value: '1 year' },
    ],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getProductsByCategory(categorySlug: string): Product[] {
  return PRODUCTS.filter((product) => product.category === categorySlug);
}

/** Products flagged as featured for the homepage (first 8 for a full grid). */
export function getFeaturedProducts(limit = 8): Product[] {
  return PRODUCTS.slice(0, limit);
}

/** Related products = same category, excluding the current product. */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = PRODUCTS.filter(
    (candidate) => candidate.category === product.category && candidate.id !== product.id
  );
  const others = PRODUCTS.filter(
    (candidate) => candidate.category !== product.category && candidate.id !== product.id
  );
  return [...sameCategory, ...others].slice(0, limit);
}
