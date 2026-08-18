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
  Boxes,
  ClipboardList,
  Building2,
  Receipt,
  Wallet,
  ScrollText,
  Activity,
  TrendingUp,
  PieChart,
  BarChart3,
  Truck,
} from 'lucide-react';
import type { Permission } from '@/lib/auth';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Grouping label rendered above the item's section. */
  section: 'Catalog' | 'Operations' | 'Money' | 'Content' | 'Store' | 'System';
  /**
   * Capability required to see the item. Omit for items every staff member may
   * open. The sidebar filters on this, so a sales manager never sees a link to
   * a page they'd be refused at — and, more importantly, whose data Firestore
   * would refuse to serve them.
   */
  permission?: Permission;
  /** Placeholder pages are visually marked as "Soon". */
  placeholder?: boolean;
}

/** Sidebar navigation for the admin dashboard. */
export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, section: 'Catalog' },
  {
    label: 'Products',
    href: '/admin/products',
    icon: Package,
    section: 'Catalog',
    permission: 'catalog.view',
  },
  {
    label: 'Categories',
    href: '/admin/categories',
    icon: FolderTree,
    section: 'Catalog',
    permission: 'catalog.manage',
  },
  {
    label: 'Brands',
    href: '/admin/brands',
    icon: Tag,
    section: 'Catalog',
    permission: 'catalog.manage',
  },

  // ── Operations ──
  {
    label: 'Inventory',
    href: '/admin/inventory',
    icon: Boxes,
    section: 'Operations',
    permission: 'inventory.view',
  },
  {
    label: 'Purchases',
    href: '/admin/purchases',
    icon: ClipboardList,
    section: 'Operations',
    permission: 'purchases.view',
  },
  {
    label: 'Suppliers',
    href: '/admin/suppliers',
    icon: Building2,
    section: 'Operations',
    permission: 'purchases.view',
  },

  // ── Money ──
  {
    label: 'Sales',
    href: '/admin/sales',
    icon: TrendingUp,
    section: 'Money',
    permission: 'sales.view',
  },
  {
    label: 'Profitability',
    href: '/admin/profit',
    icon: PieChart,
    section: 'Money',
    permission: 'finance.view',
  },
  {
    label: 'Expenses',
    href: '/admin/expenses',
    icon: Receipt,
    section: 'Money',
    permission: 'finance.view',
  },
  {
    label: 'Cash flow',
    href: '/admin/cash',
    icon: Wallet,
    section: 'Money',
    permission: 'finance.view',
  },

  // ── CMS content ──
  {
    label: 'Homepage',
    href: '/admin/cms/homepage',
    icon: Home,
    section: 'Content',
    permission: 'cms.manage',
  },
  {
    label: 'Navigation',
    href: '/admin/cms/navigation',
    icon: Menu,
    section: 'Content',
    permission: 'cms.manage',
  },
  {
    label: 'Footer',
    href: '/admin/cms/footer',
    icon: PanelBottom,
    section: 'Content',
    permission: 'cms.manage',
  },
  {
    label: 'Banners',
    href: '/admin/cms/banners',
    icon: Megaphone,
    section: 'Content',
    permission: 'cms.manage',
  },
  {
    label: 'Social links',
    href: '/admin/cms/social',
    icon: Share2,
    section: 'Content',
    permission: 'cms.manage',
  },
  {
    label: 'Contact',
    href: '/admin/cms/contact',
    icon: Mail,
    section: 'Content',
    permission: 'cms.manage',
  },

  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
    section: 'Store',
    permission: 'orders.view',
  },
  {
    label: 'Deliveries',
    href: '/admin/deliveries',
    icon: Truck,
    section: 'Store',
    permission: 'orders.view',
  },
  {
    label: 'Performance',
    href: '/admin/performance',
    icon: BarChart3,
    section: 'Store',
    permission: 'catalog.view',
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: Activity,
    section: 'Store',
    permission: 'analytics.view',
  },
  {
    label: 'Customers',
    href: '/admin/customers',
    icon: Users,
    section: 'Store',
    permission: 'customers.view',
  },
  {
    label: 'Audit log',
    href: '/admin/audit',
    icon: ScrollText,
    section: 'System',
    permission: 'audit.view',
  },
  {
    label: 'Media cleanup',
    href: '/admin/orphaned-assets',
    icon: ImageOff,
    section: 'System',
    permission: 'catalog.manage',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    section: 'System',
    permission: 'settings.manage',
  },
];

/** Sections in display order. */
export const ADMIN_NAV_SECTIONS: AdminNavItem['section'][] = [
  'Catalog',
  'Operations',
  'Money',
  'Content',
  'Store',
  'System',
];
