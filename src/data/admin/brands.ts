import type { Brand } from './types';

/**
 * Mock brands for the admin UI. `productCount` is kept in sync with the brand
 * assignments in `./products.ts`. No backend — this is the source of truth for
 * the UI-only phase.
 */
export const BRANDS: Brand[] = [
  {
    id: 'brand-aura',
    slug: 'aura',
    name: 'Aura Audio',
    description: 'Premium headphones and earbuds tuned for lifelike sound.',
    website: 'https://aura.example.com',
    accent: '#6366f1',
    productCount: 2,
    active: true,
  },
  {
    id: 'brand-vertex',
    slug: 'vertex',
    name: 'Vertex',
    description: 'Titanium wearables that keep pace with an active life.',
    website: 'https://vertex.example.com',
    accent: '#0ea5e9',
    productCount: 2,
    active: true,
  },
  {
    id: 'brand-lumen',
    slug: 'lumen',
    name: 'Lumen Displays',
    description: 'Colour-accurate panels built for work and play.',
    website: 'https://lumen.example.com',
    accent: '#8b5cf6',
    productCount: 2,
    active: true,
  },
  {
    id: 'brand-cobalt',
    slug: 'cobalt',
    name: 'Cobalt',
    description: 'Mechanical keyboards, mice and the details that matter.',
    website: 'https://cobalt.example.com',
    accent: '#14b8a6',
    productCount: 2,
    active: true,
  },
  {
    id: 'brand-beacon',
    slug: 'beacon',
    name: 'Beacon',
    description: 'Ambient smart-home tech that quietly runs the room.',
    website: 'https://beacon.example.com',
    accent: '#f59e0b',
    productCount: 2,
    active: true,
  },
  {
    id: 'brand-frame',
    slug: 'frame',
    name: 'Frame',
    description: 'Mirrorless cameras that capture every frame in clarity.',
    website: 'https://frame.example.com',
    accent: '#ef4444',
    productCount: 2,
    active: false,
  },
];

export function getBrandById(id: string): Brand | undefined {
  return BRANDS.find((brand) => brand.id === id);
}
