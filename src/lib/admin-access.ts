import type { AdminRole } from "./types";
const access: Record<AdminRole, string[]> = {
  "Super Admin": ["/admin"],
  "Catalog Manager": [
    "/admin/products",
    "/admin/categories",
    "/admin/inventory",
    "/admin/promotions",
    "/admin/vendors",
  ],
  "Order Manager": [
    "/admin/orders",
    "/admin/returns",
    "/admin/customers",
    "/admin/settings/shipping",
  ],
  "Procurement Manager": [
    "/admin/orders",
    "/admin/procurement",
    "/admin/vendors",
    "/admin/sourcing-requests",
  ],
  Support: [
    "/admin/orders",
    "/admin/customers",
    "/admin/sourcing-requests",
    "/admin/returns",
    "/admin/support",
  ],
};
export function canAccessAdmin(role: AdminRole, path: string) {
  return (
    path === "/admin" ||
    role === "Super Admin" ||
    access[role].some(
      (prefix) => path === prefix || path.startsWith(prefix + "/"),
    )
  );
}
