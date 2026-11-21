import { z } from "zod";

/**
 * Shared mobile API contract (DTO + input schemas only).
 * No server imports, no secrets, no database code — safe to vendor into
 * the `paydan-mobile` Expo repo. The Next.js routes validate against these
 * same schemas so drift is a type error, not a runtime surprise.
 */

export const money = z.number().finite().min(0).max(100_000_000);
export const id = z.string().min(1).max(150);
export const uuid = z.string().uuid();
export const isoDate = z.string().datetime({ offset: true });

export const availabilitySchema = z.enum([
  "in_stock",
  "supplier_confirm",
  "preorder",
  "out_of_stock",
]);

export const catalogVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  label: z.string(),
  options: z.record(z.string(), z.string()),
  availability: availabilitySchema,
  price: money.optional(),
  compareAt: money.optional(),
});

export const catalogProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  categorySlug: z.string(),
  brand: z.string(),
  images: z.array(z.string()),
  description: z.string(),
  highlights: z.array(z.string()),
  specifications: z.record(z.string(), z.string()),
  availability: availabilitySchema,
  variants: z.array(catalogVariantSchema),
  status: z.enum(["published", "draft", "archived"]),
  featured: z.boolean(),
  newArrival: z.boolean(),
  restricted: z.boolean(),
  rating: z.number(),
  reviewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  price: money.optional(),
  compareAt: money.optional(),
});

export type MobileCatalogProduct = z.infer<typeof catalogProductSchema>;

export const departmentSchema = z.object({
  slug: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  image: z.string(),
  order: z.number(),
  restricted: z.boolean(),
  subcategories: z
    .array(z.object({ slug: z.string(), name: z.string() }))
    .default([]),
  facets: z.array(z.string()).default([]),
  shortDescription: z.string().optional(),
  homepageVisible: z.boolean().optional(),
  homepageOrder: z.number().optional(),
});

export type MobileDepartment = z.infer<typeof departmentSchema>;

export const cartLineSchema = z.object({
  productId: id,
  variantId: id,
  quantity: z.number().int().min(1).max(99),
});

export type MobileCartLine = z.infer<typeof cartLineSchema>;

export const addressSchema = z.object({
  id: id.optional(),
  label: z.string().trim().min(1).max(200),
  recipient: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(200),
  street: z.string().trim().min(1).max(200),
  landmark: z.string().trim().max(5000).optional(),
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
});

export type MobileAddress = z.infer<typeof addressSchema>;

export const cartMutationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    productId: id,
    variantId: id,
    quantity: z.number().int().min(1).max(99).default(1),
  }),
  z.object({
    op: z.literal("setQuantity"),
    productId: id,
    variantId: id,
    quantity: z.number().int().min(1).max(99),
  }),
  z.object({
    op: z.literal("remove"),
    productId: id,
    variantId: id,
  }),
  z.object({ op: z.literal("clear") }),
  z.object({
    op: z.literal("toggleWishlist"),
    productId: id,
  }),
  z.object({
    op: z.literal("recordView"),
    productId: id,
  }),
]);

export type MobileCartMutation = z.infer<typeof cartMutationSchema>;

export const checkoutInitSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  email: z.string().email(),
  phone: z.string().trim().min(1).max(200),
  address: addressSchema,
  notes: z.string().trim().max(5000).default(""),
  saveAddress: z.boolean().default(false),
  voucherCode: z.string().max(40).default(""),
  expectedTotal: money.optional(),
  /** Client-generated idempotency key (uuid). Replays return the original order. */
  key: uuid,
  /** Deep-link return URL for the Paystack redirect; must be allowlisted server-side. */
  returnUrl: z.string().url().max(2048).optional(),
});

export type MobileCheckoutInit = z.infer<typeof checkoutInitSchema>;

export const paymentStatusSchema = z.enum([
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const orderItemSchema = z.object({
  lineId: z.string().optional(),
  productId: z.string(),
  variantId: z.string().optional(),
  sku: z.string().optional(),
  name: z.string(),
  variantLabel: z.string(),
  image: z.string(),
  unitPrice: money,
  quantity: z.number().int().min(1),
  vendorId: z.string().optional(),
  categorySlug: z.string().optional(),
});

export const orderShipmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.string(),
  eta: z.string(),
  items: z.array(orderItemSchema),
});

export const orderSchema = z.object({
  id: z.string(),
  reference: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  customerPhone: z.string(),
  placedAt: z.string(),
  paymentStatus: paymentStatusSchema,
  fulfillmentStatus: z.string(),
  paymentMethod: z.string(),
  items: z.array(orderItemSchema),
  subtotal: money,
  deliveryFee: money,
  discount: money,
  total: money,
  address: addressSchema.extend({ id: z.string() }),
  shipments: z.array(orderShipmentSchema).default([]),
  timeline: z
    .array(
      z.object({
        label: z.string(),
        at: z.string(),
        done: z.boolean(),
      }),
    )
    .default([]),
  notes: z.string().default(""),
  trackingCode: z.string(),
});

export type MobileOrder = z.infer<typeof orderSchema>;

export const sourcingSubmitSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  email: z.string().email(),
  phone: z.string().trim().min(1).max(200),
  productName: z.string().trim().min(1).max(200),
  categorySlug: id,
  description: z.string().trim().max(5000),
  quantity: z.number().int().min(1).max(99),
  budget: money.optional(),
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().min(1).max(200),
  images: z.array(z.string().max(2048)).max(5).optional(),
  key: uuid,
});

export type MobileSourcingSubmit = z.infer<typeof sourcingSubmitSchema>;

export const sourcingStatusSchema = z.enum([
  "received",
  "under_review",
  "vendor_sourcing",
  "quote_ready",
  "awaiting_customer",
  "accepted",
  "declined",
  "converted",
  "cancelled",
]);

export const sourcingRequestSchema = z.object({
  id: z.string(),
  reference: z.string(),
  customerName: z.string(),
  email: z.string(),
  phone: z.string(),
  productName: z.string(),
  categorySlug: z.string(),
  description: z.string(),
  quantity: z.number(),
  budget: money.optional(),
  city: z.string(),
  state: z.string(),
  images: z.array(z.string()).default([]),
  status: sourcingStatusSchema,
  submittedAt: z.string(),
  quote: z
    .object({
      id: z.string(),
      lines: z.array(
        z.object({
          id: z.string(),
          description: z.string(),
          quantity: z.number(),
          unitPrice: money,
        }),
      ),
      total: money,
      validUntil: z.string(),
      deliveryEstimate: z.string(),
      status: z.enum(["draft", "sent", "accepted", "declined", "expired"]),
      note: z.string(),
      sentAt: z.string().optional(),
      respondedAt: z.string().optional(),
    })
    .optional(),
  convertedOrderId: z.string().optional(),
});

export type MobileSourcingRequest = z.infer<typeof sourcingRequestSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(200).optional(),
  city: z.string().trim().max(200).optional(),
  state: z.string().trim().max(200).optional(),
});

export type MobileProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const pushTokenSchema = z.object({
  token: z.string().min(1).max(1024),
  deviceId: z.string().min(1).max(150),
  platform: z.enum(["android", "ios"]),
  appEnvironment: z.enum(["development", "preview", "production"]),
});

export type MobilePushToken = z.infer<typeof pushTokenSchema>;

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().max(3000),
});

export const assistantInputSchema = z.object({
  messages: z.array(assistantMessageSchema).min(1).max(16),
  page: z
    .object({
      path: z.string().startsWith("/").max(300),
      title: z.string().max(160).optional(),
    })
    .optional(),
});

export type MobileAssistantInput = z.infer<typeof assistantInputSchema>;

/** NDJSON stream events — mirrors the web `StreamEvent` union. */
export const assistantEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text-delta"), text: z.string() }),
  z.object({
    type: z.literal("tool-result"),
    toolName: z.string(),
    data: z.unknown(),
  }),
  z.object({ type: z.literal("reply"), data: z.unknown() }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export type MobileAssistantEvent = z.infer<typeof assistantEventSchema>;

export const proposalConfirmSchema = z.object({
  proposalId: uuid,
});

export const paginationSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export const catalogQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  department: z.string().max(150).optional(),
  brands: z.string().max(1000).optional(),
  availability: z.string().max(300).optional(),
  priceBands: z.string().max(300).optional(),
  collection: z
    .enum(["all", "deals", "new-arrivals", "featured"])
    .default("all"),
  sort: z
    .enum(["featured", "newest", "name", "price-asc", "price-desc"])
    .default("featured"),
});

export type MobileCatalogQuery = z.infer<typeof catalogQuerySchema>;
