import type { AdminRole } from "./types";

export type AdminCapability =
  | "analytics.read"
  | "audit.read"
  | "catalog.read"
  | "catalog.write"
  | "customers.read"
  | "customers.manage"
  | "customers.delete"
  | "customers.merge"
  | "customers.support-note"
  | "departments.write"
  | "inventory.read"
  | "inventory.write"
  | "jobs.read"
  | "jobs.retry"
  | "orders.read"
  | "orders.fulfil"
  | "promotions.write"
  | "refunds.issue"
  | "returns.read"
  | "returns.review"
  | "services.read"
  | "settings.manage"
  | "shipping.write"
  | "sourcing.read"
  | "sourcing.write"
  | "support.read"
  | "support.write"
  | "team.manage"
  | "vendors.read"
  | "vendors.write";

const ALL_CAPABILITIES: AdminCapability[] = [
  "analytics.read",
  "audit.read",
  "catalog.read",
  "catalog.write",
  "customers.read",
  "customers.manage",
  "customers.delete",
  "customers.merge",
  "customers.support-note",
  "departments.write",
  "inventory.read",
  "inventory.write",
  "jobs.read",
  "jobs.retry",
  "orders.read",
  "orders.fulfil",
  "promotions.write",
  "refunds.issue",
  "returns.read",
  "returns.review",
  "services.read",
  "settings.manage",
  "shipping.write",
  "sourcing.read",
  "sourcing.write",
  "support.read",
  "support.write",
  "team.manage",
  "vendors.read",
  "vendors.write",
];

export const ROLE_CAPABILITIES: Record<AdminRole, readonly AdminCapability[]> =
  {
    "Super Admin": ALL_CAPABILITIES,
    Vendor: [],
    "Catalog Manager": [
      "catalog.read",
      "catalog.write",
      "departments.write",
      "inventory.read",
      "inventory.write",
      "promotions.write",
      "vendors.read",
    ],
    "Order Manager": [
      "customers.read",
      "orders.read",
      "orders.fulfil",
      "refunds.issue",
      "returns.read",
      "returns.review",
      "shipping.write",
    ],
    "Procurement Manager": [
      "orders.read",
      "sourcing.read",
      "sourcing.write",
      "vendors.read",
      "vendors.write",
    ],
    Support: [
      "customers.read",
      "customers.support-note",
      "orders.read",
      "returns.read",
      "returns.review",
      "sourcing.read",
      "support.read",
      "support.write",
    ],
  };

export function hasCapability(
  role: AdminRole | undefined,
  capability: AdminCapability,
) {
  return Boolean(role && ROLE_CAPABILITIES[role].includes(capability));
}

const ADMIN_ROUTE_CAPABILITIES: Array<
  readonly [prefix: string, capability: AdminCapability]
> = [
  ["/admin/vendors/new", "vendors.write"],
  ["/admin/settings/team", "team.manage"],
  ["/admin/settings/shipping", "shipping.write"],
  ["/admin/settings/payments", "settings.manage"],
  ["/admin/settings/advanced", "settings.manage"],
  ["/admin/settings/storefront", "settings.manage"],
  ["/admin/settings", "settings.manage"],
  ["/admin/promotions", "promotions.write"],
  ["/admin/sourcing-requests", "sourcing.read"],
  ["/admin/procurement", "sourcing.read"],
  ["/admin/categories", "catalog.read"],
  ["/admin/inventory", "inventory.read"],
  ["/admin/products", "catalog.read"],
  ["/admin/vendors", "vendors.read"],
  ["/admin/customers", "customers.read"],
  ["/admin/returns", "returns.read"],
  ["/admin/support", "support.read"],
  ["/admin/analytics", "analytics.read"],
  ["/admin/audit", "audit.read"],
  ["/admin/operations", "jobs.read"],
  ["/admin/launch", "settings.manage"],
  ["/admin/orders", "orders.read"],
];

export function capabilityForAdminPath(path: string) {
  return ADMIN_ROUTE_CAPABILITIES.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  )?.[1];
}
