export const ADMIN_ROUTES = {
  dashboard: '/admin/dashboard',
  orders: '/admin/orders',
  customers: '/admin/customers',
  communities: '/admin/communities',
  partners: '/admin/partners',
  riders: '/admin/riders',
  wallet: '/admin/wallet',
  finance: '/admin/finance',
  promotions: '/admin/promotions',
  analytics: '/admin/analytics',
  settings: '/admin/settings',
  login: '/admin/login',
} as const;

export const NAV_ITEMS = [
  { label: 'Dashboard', href: ADMIN_ROUTES.dashboard, icon: 'viewDashboard' },
  { label: 'Orders', href: ADMIN_ROUTES.orders, icon: 'clipboardList' },
  { label: 'Customers', href: ADMIN_ROUTES.customers, icon: 'accountGroup' },
  { label: 'Communities', href: ADMIN_ROUTES.communities, icon: 'homeGroup' },
  { label: 'Partners', href: ADMIN_ROUTES.partners, icon: 'handshake' },
  { label: 'Riders', href: ADMIN_ROUTES.riders, icon: 'bike' },
  { label: 'Wallet', href: ADMIN_ROUTES.wallet, icon: 'wallet' },
  { label: 'Finance', href: ADMIN_ROUTES.finance, icon: 'chartLine' },
  { label: 'Promotions', href: ADMIN_ROUTES.promotions, icon: 'tag' },
  { label: 'Analytics', href: ADMIN_ROUTES.analytics, icon: 'chartBar' },
  { label: 'Settings', href: ADMIN_ROUTES.settings, icon: 'cog' },
] as const;
