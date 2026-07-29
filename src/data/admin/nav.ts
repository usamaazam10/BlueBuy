import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  ShoppingCart,
  Users,
  Settings,
  Home,
  Menu,
  PanelBottom,
  Megaphone,
  Share2,
  Mail,
  ImageOff,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Grouping label rendered above the item's section. */
  section: 'Catalog' | 'Content' | 'Store' | 'System';
  /** Placeholder pages are visually marked as "Soon". */
  placeholder?: boolean;
}

/** Sidebar navigation for the admin dashboard. */
export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, section: 'Catalog' },
  { label: 'Products', href: '/admin/products', icon: Package, section: 'Catalog' },
  { label: 'Categories', href: '/admin/categories', icon: FolderTree, section: 'Catalog' },
  { label: 'Brands', href: '/admin/brands', icon: Tag, section: 'Catalog' },

  // ── CMS content ──
  { label: 'Homepage', href: '/admin/cms/homepage', icon: Home, section: 'Content' },
  { label: 'Navigation', href: '/admin/cms/navigation', icon: Menu, section: 'Content' },
  { label: 'Footer', href: '/admin/cms/footer', icon: PanelBottom, section: 'Content' },
  { label: 'Banners', href: '/admin/cms/banners', icon: Megaphone, section: 'Content' },
  { label: 'Social links', href: '/admin/cms/social', icon: Share2, section: 'Content' },
  { label: 'Contact', href: '/admin/cms/contact', icon: Mail, section: 'Content' },

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
    label: 'Media cleanup',
    href: '/admin/orphaned-assets',
    icon: ImageOff,
    section: 'System',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    section: 'System',
  },
];

/** Sections in display order. */
export const ADMIN_NAV_SECTIONS: AdminNavItem['section'][] = [
  'Catalog',
  'Content',
  'Store',
  'System',
];
