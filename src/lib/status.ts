import type {
  Availability,
  FulfillmentStatus,
  PaymentStatus,
  ProcurementStage,
  ProductStatus,
  ReturnStatus,
  SourcingStatus,
  VendorStatus,
} from "./types";

export type Tone = "green" | "orange" | "red" | "blue" | "neutral";

export type StatusMeta = { label: string; tone: Tone; hint?: string };

export const paymentStatusMeta: Record<PaymentStatus, StatusMeta> = {
  pending: {
    label: "Awaiting payment",
    tone: "orange",
    hint: "Customer has not completed payment.",
  },
  paid: {
    label: "Paid",
    tone: "green",
    hint: "Payment verified with Paystack.",
  },
  refunded: {
    label: "Refunded",
    tone: "blue",
    hint: "Refund verified with Paystack.",
  },
  failed: {
    label: "Payment failed",
    tone: "red",
    hint: "Customer can retry payment.",
  },
};

export const fulfillmentStatusMeta: Record<FulfillmentStatus, StatusMeta> = {
  awaiting_payment: { label: "Awaiting payment", tone: "orange" },
  processing: { label: "Processing", tone: "blue" },
  sourcing: { label: "Supplier sourcing", tone: "blue" },
  partially_packed: { label: "Partially packed", tone: "orange" },
  dispatched: { label: "Dispatched", tone: "green" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export const procurementStageMeta: Record<ProcurementStage, StatusMeta> = {
  awaiting_assignment: { label: "Awaiting assignment", tone: "orange" },
  contact_vendor: { label: "Contact vendor", tone: "orange" },
  awaiting_confirmation: { label: "Awaiting confirmation", tone: "blue" },
  ordered_from_supplier: { label: "Ordered from supplier", tone: "blue" },
  supplier_fulfilled: { label: "Supplier fulfilled", tone: "green" },
  ready_for_dispatch: { label: "Ready for dispatch", tone: "green" },
  closed: { label: "Closed", tone: "neutral" },
  blocked: { label: "Blocked", tone: "red" },
};

export const procurementStageOrder: ProcurementStage[] = [
  "awaiting_assignment",
  "contact_vendor",
  "awaiting_confirmation",
  "ordered_from_supplier",
  "supplier_fulfilled",
  "ready_for_dispatch",
  "closed",
  "blocked",
];

export const sourcingStatusMeta: Record<SourcingStatus, StatusMeta> = {
  received: { label: "Received", tone: "neutral" },
  under_review: { label: "Under review", tone: "blue" },
  vendor_sourcing: { label: "Vendor sourcing", tone: "blue" },
  quote_ready: { label: "Quote prepared", tone: "orange" },
  awaiting_customer: { label: "Awaiting customer", tone: "orange" },
  accepted: { label: "Quote accepted", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  converted: { label: "Converted to order", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export const returnStatusMeta: Record<ReturnStatus, StatusMeta> = {
  requested: { label: "Requested", tone: "orange" },
  under_review: { label: "Under review", tone: "blue" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Not approved", tone: "red" },
  refunded: { label: "Refunded", tone: "green" },
};

export const vendorStatusMeta: Record<VendorStatus, StatusMeta> = {
  active: { label: "Active", tone: "green" },
  on_hold: { label: "On hold", tone: "orange" },
};

export const productStatusMeta: Record<ProductStatus, StatusMeta> = {
  published: { label: "Published", tone: "green" },
  draft: { label: "Draft", tone: "orange" },
  archived: { label: "Archived", tone: "neutral" },
};

export const availabilityMeta: Record<Availability, StatusMeta> = {
  in_stock: {
    label: "Available now",
    tone: "green",
    hint: "Confirmed stock is checked again before payment.",
  },
  supplier_confirm: {
    label: "Availability to confirm",
    tone: "orange",
    hint: "PAYDAN must confirm supplier stock before payment.",
  },
  preorder: {
    label: "Pre-order",
    tone: "blue",
    hint: "Sourced to order. Lead times are confirmed before payment.",
  },
  out_of_stock: {
    label: "Out of stock",
    tone: "red",
    hint: "Currently unavailable. Request a product and we will source it.",
  },
};

export const returnReasons = [
  "Item arrived damaged",
  "Wrong item delivered",
  "Item does not match description",
  "Changed my mind",
  "Other",
];

export const sourcingStatusFlow: SourcingStatus[] = [
  "received",
  "under_review",
  "vendor_sourcing",
  "quote_ready",
  "awaiting_customer",
  "converted",
];

export const customerOrderTimeline = [
  "Order received",
  "Payment confirmed",
  "Sourcing / processing",
  "Dispatched",
  "Delivered",
] as const;
