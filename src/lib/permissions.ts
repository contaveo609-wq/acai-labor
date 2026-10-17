/**
 * RBAC — Role-Based Access Control
 *
 * Defines roles, permissions and a hook for checking access.
 */

export type AdminRole = "ADMIN_MASTER" | "GERENTE" | "OPERADOR" | "ENTREGADOR";

export const PERMISSIONS = {
  view_dashboard: "view_dashboard",
  view_financial: "view_financial",
  manage_products: "manage_products",
  manage_orders: "manage_orders",
  manage_delivery: "manage_delivery",
  manage_promotions: "manage_promotions",
  manage_coupons: "manage_coupons",
  manage_categories: "manage_categories",
  manage_hours: "manage_hours",
  manage_campaigns: "manage_campaigns",
  manage_ai: "manage_ai",
  manage_users: "manage_users",
  manage_settings: "manage_settings",
  manage_loyalty: "manage_loyalty",
  manage_satisfaction: "manage_satisfaction",
  manage_store: "manage_store",
  view_reports: "view_reports",
  view_logs: "view_logs",
  view_clients: "view_clients",
  view_notifications: "view_notifications",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  ADMIN_MASTER: [...ALL],

  GERENTE: [
    PERMISSIONS.view_dashboard,
    PERMISSIONS.manage_orders,
    PERMISSIONS.manage_products,
    PERMISSIONS.manage_categories,
    PERMISSIONS.manage_promotions,
    PERMISSIONS.manage_coupons,
    PERMISSIONS.manage_delivery,
    PERMISSIONS.manage_hours,
    PERMISSIONS.manage_loyalty,
    PERMISSIONS.manage_satisfaction,
    PERMISSIONS.view_clients,
    PERMISSIONS.view_notifications,
    PERMISSIONS.manage_store,
  ],

  OPERADOR: [
    PERMISSIONS.view_dashboard,
    PERMISSIONS.manage_orders,
    PERMISSIONS.manage_products,
    PERMISSIONS.manage_categories,
    PERMISSIONS.view_notifications,
  ],

  ENTREGADOR: [
    PERMISSIONS.manage_delivery,
    PERMISSIONS.view_notifications,
  ],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN_MASTER: "Admin Master",
  GERENTE: "Gerente",
  OPERADOR: "Operador",
  ENTREGADOR: "Entregador",
};

/**
 * Check whether a given role has a specific permission.
 */
export function hasPermission(role: AdminRole | undefined, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
