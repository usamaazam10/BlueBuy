export interface NavLink {
  label: string;
  href: string;
}

export const MAIN_NAV: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const FOOTER_NAV: { title: string; links: NavLink[] }[] = [
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Products', href: '/products' },
      { label: 'Careers', href: '/about' },
      { label: 'Press', href: '/about' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Shipping', href: '/contact' },
      { label: 'Returns', href: '/contact' },
      { label: 'Warranty', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/contact' },
      { label: 'Terms', href: '/contact' },
      { label: 'Cookies', href: '/contact' },
      { label: 'Licenses', href: '/contact' },
    ],
  },
];
