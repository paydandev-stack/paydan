/** Domain records used by server services and the existing UI. Server snapshots remove private fields before serialization. */

export type Money = number; // NGN display amount; checkout/payment arithmetic uses integer kobo.

export type Availability =
  "in_stock" | "supplier_confirm" | "preorder" | "out_of_stock";

export type ProductStatus = "published" | "draft" | "archived";

export type ProductVariant = {
  id: string;
  sku: string;
  label: string;
  options: Record<string, string>;
  price: Money;
  compareAt?: Money;
  availability: Availability;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  categorySlug: string;
  brand: string;
  images: string[];
  description: string;
  highlights: string[];
  specifications: Record<string, string>;
  price: Money;
  compareAt?: Money;
  availability: Availability;
  vendorId: string;
  /** Internal only — never rendered on customer pages. */
  costPrice: Money;
  variants: ProductVariant[];
  status: ProductStatus;
  featured: boolean;
  newArrival: boolean;
  restricted: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Subcategory = {
  slug: string;
  name: string;
};

export type Category = {
  slug: string;
  name: string;
  title: string;
  description: string;
  image: string;
  order: number;
  /** Archived departments remain editable in operations but disappear from customer surfaces. */
  active?: boolean;
  restricted: boolean;
  subcategories: Subcategory[];
  /** Extra filters shown for this department, e.g. storage, size, skin type. */
  facets: string[];
};

export type VendorStatus = "active" | "on_hold";

export type Vendor = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  categorySlugs: string[];
  status: VendorStatus;
  leadTimeDays: number;
  paymentTerms: string;
  notes: string;
  reliability: number; // 0-100 internal scorecard
  createdAt: string;
};

export type Address = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  isDefault: boolean;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  joinedAt: string;
  segments: string[];
  notes: string;
};

export type CartLine = {
  productId: string;
  variantId: string;
  quantity: number;
};

export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";
export type FulfillmentStatus =
  | "awaiting_payment"
  | "processing"
  | "sourcing"
  | "partially_packed"
  | "dispatched"
  | "delivered"
  | "cancelled";

export type ProcurementStage =
  | "awaiting_assignment"
  | "contact_vendor"
  | "awaiting_confirmation"
  | "ordered_from_supplier"
  | "supplier_fulfilled"
  | "ready_for_dispatch"
  | "closed"
  | "blocked";

export type OrderItem = {
  productId: string;
  name: string;
  variantLabel: string;
  image: string;
  unitPrice: Money;
  costPrice: Money;
  quantity: number;
  vendorId: string;
  categorySlug: string;
};

export type VendorSubOrder = {
  id: string;
  vendorId: string;
  items: OrderItem[];
  stage: ProcurementStage;
  assignee: string;
  eta: string;
  urgent: boolean;
  notes: string;
  updatedAt: string;
};

export type TimelineEvent = {
  label: string;
  at: string;
  done: boolean;
  note?: string;
};

export type CustomerShipment = {
  id: string;
  label: string;
  status: string;
  eta: string;
  items: Omit<OrderItem, "costPrice" | "vendorId">[];
};

export type Order = {
  shipments?: CustomerShipment[];
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  placedAt: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethod: "paystack" | "transfer";
  items: OrderItem[];
  subtotal: Money;
  deliveryFee: Money;
  discount: Money;
  total: Money;
  address: Address;
  vendorGroups: VendorSubOrder[];
  timeline: TimelineEvent[];
  notes: string;
  trackingCode: string;
};

export type SourcingStatus =
  | "received"
  | "under_review"
  | "vendor_sourcing"
  | "quote_ready"
  | "awaiting_customer"
  | "accepted"
  | "declined"
  | "converted"
  | "cancelled";

export type QuoteLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: Money;
};

export type Quote = {
  id: string;
  lines: QuoteLine[];
  total: Money;
  validUntil: string;
  deliveryEstimate: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  sentAt?: string;
  respondedAt?: string;
  note: string;
};

export type SourcingRequest = {
  id: string;
  reference: string;
  customerId?: string;
  customerName: string;
  email: string;
  phone: string;
  productName: string;
  categorySlug: string;
  description: string;
  quantity: number;
  budget?: Money;
  city: string;
  state: string;
  images: string[];
  status: SourcingStatus;
  submittedAt: string;
  assignee: string;
  adminNotes: string;
  quote?: Quote;
  convertedOrderId?: string;
};

export type Banner = {
  id: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  image: string;
  placement: "hero" | "side";
  active: boolean;
  startAt: string;
  endAt: string;
};

/** Discount code managed from the admin promotions screen. */
export type Voucher = {
  code: string;
  type: "fixed" | "percent";
  value: number;
  minimum: number;
  description: string;
  active: boolean;
};

export type ReturnStatus =
  "requested" | "under_review" | "approved" | "rejected" | "refunded";

export type ReturnRequest = {
  images?: string[];
  id: string;
  reference: string;
  orderId: string;
  customerId: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  detail: string;
  status: ReturnStatus;
  createdAt: string;
  adminNote: string;
};

export type AdminRole =
  | "Super Admin"
  | "Catalog Manager"
  | "Order Manager"
  | "Procurement Manager"
  | "Support";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "active" | "invited" | "suspended";
  lastActive: string;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  record: string;
  at: string;
};

export type CustomerSession = {
  id: string;
  name: string;
  email: string;
} | null;

export type AdminSession = {
  id: string;
  name: string;
  role: AdminRole;
} | null;

export type ShippingZone = {
  id: string;
  state: string;
  fee: Money;
  eta: string;
  active: boolean;
};

export type StoreSettings = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  businessHours: string;
  currency: "NGN";
  announcement: string;
  paystackStatus: "not_connected" | "test_placeholder";
  transferEnabled: boolean;
};

export type Toast = {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
  actionLabel?: string;
  actionHref?: string;
  action?: "undo-remove";
};

export type DemoState = {
  products: Product[];
  categories: Category[];
  vendors: Vendor[];
  customers: Customer[];
  orders: Order[];
  sourcing: SourcingRequest[];
  banners: Banner[];
  vouchers: Voucher[];
  returns: ReturnRequest[];
  team: TeamMember[];
  shippingZones: ShippingZone[];
  settings: StoreSettings;
  cart: CartLine[];
  wishlist: string[];
  savedForLater: CartLine[];
  addresses: Address[];
  audit: AuditEntry[];
  customerSession: CustomerSession;
  adminSession: AdminSession;
  location: { state: string; city: string };
  lastOrderId?: string;
  lastSourcingReference?: string;
  toasts: Toast[];
};
