import { database, record } from "@/server/db";
import { failure, json, requireCapability, viewer } from "@/server/http";
import type { StoreSettings } from "@/lib/types";
import { POLICY_CONTENT_VERSION, policyPages } from "@/data/content";
import { mediaCdnBase } from "@/lib/media-origin";

function validMediaOrigin() {
  try {
    return Boolean(
      mediaCdnBase(process.env.MEDIA_CDN_URL) || process.env.CLOUDFRONT_DOMAIN,
    );
  } catch {
    return false;
  }
}

const CHECK_META: Record<string, { owner: string; href: string }> = {
  supplier: { owner: "Procurement", href: "/admin/vendors" },
  product: { owner: "Catalogue", href: "/admin/products" },
  inventory: { owner: "Catalogue", href: "/admin/inventory" },
  shipping: { owner: "Operations", href: "/admin/settings/shipping" },
  support: { owner: "Support", href: "/admin/settings/storefront" },
  banner: { owner: "Catalogue", href: "/admin/promotions/banners" },
  policies: { owner: "Leadership", href: "/admin/settings" },
  google: { owner: "Engineering", href: "/admin/settings/payments" },
  storage: { owner: "Engineering", href: "/admin/settings/payments" },
  paystack: { owner: "Finance", href: "/admin/settings/payments" },
  email: { owner: "Engineering", href: "/admin/settings/payments" },
  "mail-worker": { owner: "Operations", href: "/admin/operations" },
  "payment-worker": { owner: "Finance", href: "/admin/operations" },
  ai: { owner: "Product", href: "/admin/settings/payments" },
  alerts: { owner: "Operations", href: "/admin/operations" },
  indexing: { owner: "Leadership", href: "/admin/settings" },
};

export async function GET(request: Request) {
  try {
    requireCapability(await viewer(request.headers), "settings.manage");
    const db = database();
    const [
      vendors,
      products,
      inventory,
      zones,
      banners,
      workers,
      settings,
      alerts,
    ] = await Promise.all([
      db.query(
        "SELECT count(*)::int AS count FROM commerce_record WHERE kind='vendors' AND data->>'status'='active'",
      ),
      db.query(
        "SELECT count(*)::int AS count FROM commerce_record WHERE kind='products' AND data->>'status'='published' AND jsonb_array_length(COALESCE(data->'images','[]'::jsonb)) > 0",
      ),
      db.query(
        "SELECT count(*)::int AS count FROM inventory WHERE available > 0",
      ),
      db.query(
        "SELECT count(*)::int AS count FROM commerce_record WHERE kind='shippingZones' AND COALESCE((data->>'active')::boolean,false)",
      ),
      db.query(
        "SELECT count(*)::int AS count FROM commerce_record WHERE kind='banners' AND COALESCE((data->>'active')::boolean,false)",
      ),
      db.query(
        "SELECT worker,max(completed_at) AS completed_at FROM worker_run WHERE status='succeeded' GROUP BY worker",
      ),
      record<StoreSettings>(db, "settings", "store"),
      db.query(
        `SELECT
            (SELECT count(*) FROM mail_outbox WHERE dead_at IS NOT NULL)::int AS dead_mail,
            (SELECT count(*) FROM payment WHERE status='pending' AND created_at < now() - interval '15 minutes')::int AS stale_payments,
            (SELECT count(*) FROM refund WHERE status NOT IN ('processed','failed') AND (provider_id IS NULL OR created_at < now() - interval '1 hour'))::int AS unresolved_refunds`,
      ),
    ]);
    const workerMap = new Map(
      workers.rows.map((row) => [
        row.worker,
        row.completed_at ? Date.parse(row.completed_at) : 0,
      ]),
    );
    const recentWorker = (name: string) =>
      Date.now() - (workerMap.get(name) ?? 0) < 24 * 60 * 60 * 1000;
    const items = [
      {
        key: "supplier",
        label: "Active supplier",
        ok: vendors.rows[0].count > 0,
        detail: `${vendors.rows[0].count} active`,
      },
      {
        key: "product",
        label: "Published product with image",
        ok: products.rows[0].count > 0,
        detail: `${products.rows[0].count} published`,
      },
      {
        key: "inventory",
        label: "Confirmed inventory",
        ok: inventory.rows[0].count > 0,
        detail: `${inventory.rows[0].count} stocked variants`,
      },
      {
        key: "shipping",
        label: "Active delivery zone",
        ok: zones.rows[0].count > 0,
        detail: `${zones.rows[0].count} active`,
      },
      {
        key: "support",
        label: "Support contact and hours",
        ok: Boolean(
          settings?.supportEmail &&
          settings?.supportPhone &&
          settings?.businessHours,
        ),
        detail: settings?.supportEmail || "Missing",
      },
      {
        key: "banner",
        label: "Active storefront banner",
        ok: banners.rows[0].count > 0,
        detail: `${banners.rows[0].count} active`,
      },
      {
        key: "policies",
        label: "Business-approved policy version",
        ok:
          policyPages.every((policy) => policy.status === "Published") &&
          process.env.POLICIES_APPROVED_VERSION === POLICY_CONTENT_VERSION,
        detail: policyPages.some((policy) => policy.status !== "Published")
          ? `Version ${POLICY_CONTENT_VERSION} is still draft in code`
          : process.env.POLICIES_APPROVED_VERSION || "Not approved",
      },
      {
        key: "google",
        label: "Google OAuth configured",
        ok: Boolean(
          process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_OAUTH_ACCEPTED_AT,
        ),
        detail:
          process.env.GOOGLE_OAUTH_ACCEPTED_AT ||
          "Complete a staging sign-in and record acceptance",
      },
      {
        key: "storage",
        label: "S3 and CloudFront configured",
        ok: Boolean(
          process.env.S3_BUCKET &&
          process.env.AWS_REGION &&
          validMediaOrigin() &&
          process.env.STORAGE_ACCEPTED_AT,
        ),
        detail:
          process.env.STORAGE_ACCEPTED_AT ||
          "Run upload/delivery/private-access acceptance",
      },
      {
        key: "paystack",
        label: "Paystack configured",
        ok: Boolean(
          process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_") &&
          process.env.PAYSTACK_ACCEPTED_AT,
        ),
        detail: process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")
          ? "Live mode"
          : "Test mode",
      },
      {
        key: "email",
        label: "Transactional email configured",
        ok: Boolean(
          process.env.SMTP_HOST &&
          (process.env.MAIL_FROM_AUTH || process.env.MAIL_FROM) &&
          (process.env.MAIL_FROM_ORDERS || process.env.MAIL_FROM) &&
          (process.env.MAIL_FROM_SUPPORT || process.env.MAIL_FROM) &&
          process.env.EMAIL_ACCEPTED_AT,
        ),
        detail: process.env.EMAIL_ACCEPTED_AT || "Verify delivery and webhooks",
      },
      {
        key: "mail-worker",
        label: "Mail worker recently successful",
        ok: recentWorker("mail"),
        detail: workerMap.get("mail")
          ? new Date(workerMap.get("mail")!).toISOString()
          : "No successful run",
      },
      {
        key: "payment-worker",
        label: "Payment worker recently successful",
        ok: recentWorker("payments"),
        detail: workerMap.get("payments")
          ? new Date(workerMap.get("payments")!).toISOString()
          : "No successful run",
      },
      {
        key: "ai",
        label: "AI provider route configured",
        ok: Boolean(
          (process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY) &&
          process.env.AI_ACCEPTED_AT,
        ),
        detail:
          process.env.AI_ACCEPTED_AT || "Run assistant acceptance separately",
      },
      {
        key: "alerts",
        label: "No critical operational alerts",
        ok:
          Number(alerts.rows[0].dead_mail) === 0 &&
          Number(alerts.rows[0].stale_payments) === 0 &&
          Number(alerts.rows[0].unresolved_refunds) === 0,
        detail: `${alerts.rows[0].dead_mail} dead mail · ${alerts.rows[0].stale_payments} stale payments · ${alerts.rows[0].unresolved_refunds} unresolved refunds`,
      },
      {
        key: "indexing",
        label: "Public indexing enabled",
        ok: process.env.SITE_INDEXING_ENABLED === "true",
        detail:
          process.env.SITE_INDEXING_ENABLED === "true"
            ? "Enabled"
            : "Disabled until approval",
        blocking: false,
      },
    ];
    return json({
      checkedAt: new Date().toISOString(),
      items: items.map((item) => ({ ...item, ...CHECK_META[item.key] })),
      ready: items
        .filter((item) => item.blocking !== false)
        .every((item) => item.ok),
    });
  } catch (error) {
    return failure(error);
  }
}

export const POST = GET;
