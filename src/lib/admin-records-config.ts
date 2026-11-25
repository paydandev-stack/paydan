import type { AdminCapability } from "./capabilities";

/**
 * Admin records are small JSON documents kept alongside the main commerce
 * records. Each kind has an explicit capability so generic create/update UI
 * cannot bypass role checks.
 */
export const ADMIN_RECORD_CAPABILITIES = {
  orderMeta: "orders.fulfil",
  returnMeta: "returns.review",
  refundSettings: "refunds.issue",
  supportMeta: "support.write",
  supportCannedReplies: "support.write",
  procurementMeta: "sourcing.write",
  sourcingMeta: "sourcing.write",
  productMeta: "catalog.write",
  inventoryMeta: "inventory.write",
  stockMovements: "inventory.read",
  categoryMeta: "departments.write",
  promotionMeta: "promotions.write",
  bannerMeta: "promotions.write",
  customerProfiles: "customers.support-note",
  customerSegments: "customers.manage",
  auditViews: "audit.read",
  jobAlerts: "jobs.retry",
  launchChecks: "settings.manage",
  taxSettings: "settings.manage",
  notificationTemplates: "settings.manage",
  policyApprovals: "settings.manage",
  integrationStatus: "settings.manage",
  retentionRules: "settings.manage",
  vendorScorecards: "vendors.write",
  vendorDocuments: "vendors.write",
  vendorPayouts: "vendors.write",
  vendorShipments: "orders.fulfil",
  webhookStatus: "settings.manage",
} as const satisfies Record<string, AdminCapability>;

export type AdminRecordKind = keyof typeof ADMIN_RECORD_CAPABILITIES;

export function isAdminRecordKind(value: string): value is AdminRecordKind {
  return Object.prototype.hasOwnProperty.call(ADMIN_RECORD_CAPABILITIES, value);
}
