import type { Category } from '@/types';

/**
 * Product categories. `count` is maintained to match `products.ts`.
 * Kept as a static local data file — no backend during the UI phase.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'cat-audio',
    slug: 'audio',
    name: 'Audio',
    description: 'Headphones and earbuds tuned for lifelike sound.',
    accent: '#6366f1',
    count: 2,
  },
  {
    id: 'cat-wearables',
    slug: 'wearables',
    name: 'Wearables',
    description: 'Watches and bands that keep pace with you.',
    accent: '#0ea5e9',
    count: 2,
  },
  {
    id: 'cat-displays',
    slug: 'displays',
    name: 'Displays',
    description: 'Crisp panels built for work and play.',
    accent: '#8b5cf6',
    count: 2,
  },
  {
    id: 'cat-accessories',
    slug: 'accessories',
    name: 'Accessories',
    description: 'Keyboards, mice and the details that matter.',
    accent: '#14b8a6',
    count: 2,
  },
  {
    id: 'cat-smart-home',
    slug: 'smart-home',
    name: 'Smart Home',
    description: 'Ambient tech that quietly runs the room.',
    accent: '#f59e0b',
    count: 2,
  },
  {
    id: 'cat-cameras',
    slug: 'cameras',
    name: 'Cameras',
    description: 'Capture every frame in stunning clarity.',
    accent: '#ef4444',
    count: 2,
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}
