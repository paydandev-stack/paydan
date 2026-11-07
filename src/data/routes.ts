/**
 * UI route inventory. A listed route is not evidence of configured services or end-to-end readiness.
 * `/demo/route-directory` renders this list as navigation only. See docs/implementation-progress.md for verified feature status.
 */
export type RouteGroup =
  | "Storefront"
  | "Authentication"
  | "Customer account"
  | "Admin console"
  | "Demo utilities";

export type RouteStatus = "implemented" | "pending";

export type RouteEntry = {
  path: string;
  label: string;
  group: RouteGroup;
  status: RouteStatus;
  note?: string;
};

export const routeManifest: RouteEntry[] = [
  {
    path: "/dashboard",
    label: "Member shopping dashboard",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/verify-email",
    label: "Email verification",
    group: "Authentication",
    status: "implemented",
  },
  {
    path: "/admin/inventory",
    label: "Confirmed stock",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/returns",
    label: "Returns and refunds",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/support",
    label: "Support inbox",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/categories/new",
    label: "New department",
    group: "Admin console",
    status: "implemented",
  },
  { path: "/", label: "Homepage", group: "Storefront", status: "implemented" },
  {
    path: "/shop",
    label: "All products",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/categories",
    label: "Department directory",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/category/[slug]",
    label: "Category listing",
    group: "Storefront",
    status: "implemented",
    note: "Example: /category/supermarket",
  },
  {
    path: "/search",
    label: "Search results",
    group: "Storefront",
    status: "implemented",
    note: "Uses ?q=",
  },
  {
    path: "/product/[slug]",
    label: "Product detail",
    group: "Storefront",
    status: "implemented",
    note: "Example: /product/hp-15-inch-everyday-laptop",
  },
  {
    path: "/deals",
    label: "Deals",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/new-arrivals",
    label: "New arrivals",
    group: "Storefront",
    status: "implemented",
  },
  { path: "/cart", label: "Cart", group: "Storefront", status: "implemented" },
  {
    path: "/checkout",
    label: "Checkout",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/checkout/success",
    label: "Order confirmation",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/track-order",
    label: "Order lookup",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/track-order/[id]",
    label: "Order tracking",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/request-product",
    label: "Product sourcing request",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/request-product/success",
    label: "Sourcing acknowledgement",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/about",
    label: "About Paydan",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/contact",
    label: "Contact",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/help",
    label: "Help centre",
    group: "Storefront",
    status: "implemented",
  },
  { path: "/faq", label: "FAQ", group: "Storefront", status: "implemented" },
  {
    path: "/policies/shipping",
    label: "Shipping policy",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/policies/returns",
    label: "Returns policy",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/policies/privacy",
    label: "Privacy policy",
    group: "Storefront",
    status: "implemented",
  },
  {
    path: "/policies/terms",
    label: "Terms of use",
    group: "Storefront",
    status: "implemented",
  },

  {
    path: "/login",
    label: "Customer sign in",
    group: "Authentication",
    status: "implemented",
  },
  {
    path: "/register",
    label: "Customer registration",
    group: "Authentication",
    status: "implemented",
  },
  {
    path: "/forgot-password",
    label: "Password reset",
    group: "Authentication",
    status: "implemented",
  },

  {
    path: "/account",
    label: "Account overview",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/account/profile",
    label: "Profile and contact details",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/account/addresses",
    label: "Delivery addresses",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/account/orders",
    label: "Order history",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/account/orders/[id]",
    label: "Order detail",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/account/wishlist",
    label: "Wishlist",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/account/returns",
    label: "Returns",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/account/sourcing-requests",
    label: "Sourcing requests",
    group: "Customer account",
    status: "implemented",
  },
  {
    path: "/account/sourcing-requests/[id]",
    label: "Sourcing request and quote",
    group: "Customer account",
    status: "implemented",
  },

  {
    path: "/admin/login",
    label: "Admin sign in",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin",
    label: "Operations dashboard",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/products",
    label: "Product management",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/products/new",
    label: "New product",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/products/[id]/edit",
    label: "Product editor",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/categories",
    label: "Categories",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/vendors",
    label: "Vendor directory",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/vendors/new",
    label: "Add vendor",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/vendors/[id]",
    label: "Vendor profile",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/orders",
    label: "Orders",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/orders/[id]",
    label: "Order detail",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/procurement",
    label: "Procurement board",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/procurement/[id]",
    label: "Procurement task",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/sourcing-requests",
    label: "Sourcing queue",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/sourcing-requests/[id]",
    label: "Sourcing review and quote",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/customers",
    label: "Customers",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/customers/[id]",
    label: "Customer profile",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/promotions",
    label: "Promotions",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/promotions/banners",
    label: "Banner manager",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/analytics",
    label: "Analytics",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/settings",
    label: "Settings hub",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/settings/shipping",
    label: "Shipping settings",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/settings/payments",
    label: "Payment settings",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/settings/team",
    label: "Team and roles",
    group: "Admin console",
    status: "implemented",
  },
  {
    path: "/admin/settings/storefront",
    label: "Storefront settings",
    group: "Admin console",
    status: "implemented",
  },

  {
    path: "/design-system",
    label: "Design system",
    group: "Demo utilities",
    status: "implemented",
  },
  {
    path: "/demo/route-directory",
    label: "Route directory",
    group: "Demo utilities",
    status: "implemented",
  },
];

export const routeGroups: RouteGroup[] = [
  "Storefront",
  "Authentication",
  "Customer account",
  "Admin console",
  "Demo utilities",
];

export function routesByGroup(): { group: RouteGroup; routes: RouteEntry[] }[] {
  return routeGroups.map((group) => ({
    group,
    routes: routeManifest.filter((route) => route.group === group),
  }));
}
