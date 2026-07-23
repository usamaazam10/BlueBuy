import type { ActivityItem } from './types';

/** Mock recent-activity feed for the dashboard. UI-only, static. */
export const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: 'act-1',
    kind: 'product',
    title: 'Product published',
    detail: 'Nova Portable Display',
    time: '12m ago',
  },
  {
    id: 'act-2',
    kind: 'order',
    title: 'New order received',
    detail: 'Order #10428 · $329.00',
    time: '48m ago',
  },
  {
    id: 'act-3',
    kind: 'product',
    title: 'Stock updated',
    detail: 'Ember Smart Bulb Set · 5 left',
    time: '2h ago',
  },
  {
    id: 'act-4',
    kind: 'customer',
    title: 'New customer',
    detail: 'a.rivera@example.com',
    time: '3h ago',
  },
  {
    id: 'act-5',
    kind: 'category',
    title: 'Category edited',
    detail: 'Smart Home',
    time: '5h ago',
  },
  {
    id: 'act-6',
    kind: 'brand',
    title: 'Brand archived',
    detail: 'Frame',
    time: 'Yesterday',
  },
];
