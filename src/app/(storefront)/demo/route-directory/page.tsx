import Link from "next/link";
import { routeManifest, routesByGroup, type RouteGroup } from "@/data/routes";

export const metadata = { title: "Route directory" };

/** One line of context per manifest group. */
const groupCopy: Record<RouteGroup, string> = {
  Storefront:
    "Browsing, search, product detail, cart, checkout, order tracking, sourcing requests and support content.",
  Authentication:
    "Sign in, registration and password recovery for customers, plus operator sign-in for the console.",
  "Customer account":
    "Orders, returns, sourcing requests, wishlist, saved addresses and profile — protected by verified account sessions.",
  "Admin console":
    "Catalogue, vendors, orders, procurement, sourcing quotes, customers, promotions, analytics and settings.",
  "Demo utilities":
    "Reference screens for the build: this directory and the design system.",
};

function statusClass(implemented: number, total: number): string {
  if (implemented === total) return "complete";
  if (implemented === 0) return "not-started";
  return "partial";
}

function statusLabel(implemented: number, total: number): string {
  if (implemented === total) return "Complete";
  if (implemented === 0) return "Not started";
  return `${implemented} of ${total} shipped`;
}

/**
 * Renders `src/data/routes.ts` directly, so the published inventory cannot
 * drift from the pages that actually exist.
 */
export default function RouteDirectoryPage() {
  const groups = routesByGroup();
  const implemented = routeManifest.filter(
    (route) => route.status === "implemented",
  ).length;
  const total = routeManifest.length;
  const percent = Math.round((implemented / total) * 100);

  return (
    <div className="wrap route-directory">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Route directory</strong>
      </nav>

      <section className="audit-hero">
        <div>
          <h1>Route directory</h1>
          <p>
            Every screen in the build plan, grouped the way the plan groups it.
            The list is read straight from the route manifest, so what you see
            here is what the app actually serves.
          </p>
        </div>
        <div className="audit-score">
          <strong>{percent}%</strong>
          <span>IMPLEMENTED</span>
          <small>
            {implemented} of {total} routes are live and prerendered.
          </small>
        </div>
      </section>

      <div className="audit-legend" aria-label="Legend">
        <span className="complete">Implemented — opens the page</span>
        <span className="missing">Pending — not built yet</span>
      </div>

      <div className="audit-list">
        {groups.map(({ group, routes }) => {
          const done = routes.filter(
            (route) => route.status === "implemented",
          ).length;
          return (
            <article key={group}>
              <div>
                <h2>{group}</h2>
                <p>{groupCopy[group]}</p>
                <span
                  className={`audit-status ${statusClass(done, routes.length)}`}
                >
                  {statusLabel(done, routes.length)}
                </span>
              </div>
              <div className="route-chips">
                {routes.map((route) =>
                  route.status === "implemented" &&
                  !route.path.includes("[") ? (
                    <Link key={route.path} href={route.path} title={route.note}>
                      <code>{route.path}</code>
                    </Link>
                  ) : (
                    <code key={route.path} title={route.note}>
                      {route.path}
                    </code>
                  ),
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="audit-next">
        <h2>Coverage lives in code, not in a checklist</h2>
        <p>
          <code>src/data/routes.ts</code> is the single source of truth: flip a
          status there and this page, the dashboard and the build plan all
          agree.
        </p>
      </section>
    </div>
  );
}
