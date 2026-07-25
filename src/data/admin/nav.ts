import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  ShoppingCart,
  Users,
  Settings,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Grouping label rendered above the item's section. */
  section: 'Catalog' | 'Store' | 'System';
  /** Placeholder pages are visually marked as "Soon". */
  placeholder?: boolean;
}

/** Sidebar navigation for the admin dashboard. */
export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, section: 'Catalog' },
  { label: 'Products', href: '/admin/products', icon: Package, section: 'Catalog' },
  { label: 'Categories', href: '/admin/categories', icon: FolderTree, section: 'Catalog' },
  { label: 'Brands', href: '/admin/brands', icon: Tag, section: 'Catalog' },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
    section: 'Store',
  },
  {
    label: 'Customers',
    href: '/admin/customers',
    icon: Users,
    section: 'Store',
    placeholder: true,
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    section: 'System',
    placeholder: true,
  },
];

/** Sections in display order. */
export const ADMIN_NAV_SECTIONS: AdminNavItem['section'][] = ['Catalog', 'Store', 'System'];
