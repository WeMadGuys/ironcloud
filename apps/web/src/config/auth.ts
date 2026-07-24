export const ADMIN_ROLES = ['ops_admin', 'super_admin'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const isAdminRole = (role: string): role is AdminRole =>
  ADMIN_ROLES.includes(role as AdminRole);
