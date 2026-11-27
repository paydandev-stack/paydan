import { z } from "zod";
import { isCatalogCdnUrl } from "./media-delivery";
export const id = z.string().min(1).max(150);
export const text = z.string().trim().max(5000);
export const short = z.string().trim().min(1).max(200);
export const amount = z
  .number()
  .finite()
  .min(0)
  .max(100000000)
  .refine(
    (n) =>
      Number.isSafeInteger(Math.round(n * 100)) &&
      Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places.",
  );
export const quantity = z.number().int().min(1).max(99);
export const image = z
  .string()
  .max(2048)
  .refine(
    (s) =>
      s.startsWith("/api/media/") ||
      s.startsWith("https://images.unsplash.com/") ||
      isCatalogCdnUrl(s),
    "Use an uploaded image.",
  );
export const address = z.object({
  id: id.optional(),
  label: short,
  recipient: short,
  phone: short,
  street: short,
  landmark: text.optional(),
  city: short,
  state: short,
  isDefault: z.boolean().optional(),
});
export const availability = z.enum([
  "in_stock",
  "supplier_confirm",
  "preorder",
  "out_of_stock",
]);
export const product = z.object({
  id,
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(200),
  sku: short,
  name: short,
  categorySlug: id,
  subcategorySlug: id.optional(),
  brand: text,
  images: z.array(image).min(1).max(12),
  imageAlts: z.record(z.string(), text).optional(),
  seoTitle: text.optional(),
  seoDescription: text.optional(),
  description: text,
  highlights: z.array(text).max(30),
  specifications: z.record(z.string(), text),
  price: amount,
  compareAt: amount.optional(),
  availability,
  vendorId: id,
  fulfillmentLocationId: id.optional(),
  costPrice: amount,
  variants: z
    .array(
      z.object({
        id,
        sku: short,
        label: short,
        options: z.record(z.string(), text),
        price: amount,
        compareAt: amount.optional(),
        availability,
      }),
    )
    .min(1)
    .max(100),
  status: z.enum(["published", "draft", "archived"]),
  featured: z.boolean(),
  newArrival: z.boolean(),
  restricted: z.boolean(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  createdAt: text,
  updatedAt: text,
});
export const category = z.object({
  slug: id,
  name: short,
  title: short,
  description: text,
  image,
  order: z.number().int().min(0),
  active: z.boolean().optional(),
  restricted: z.boolean(),
  subcategories: z.array(z.object({ slug: id, name: short })).max(100),
  facets: z.array(short).max(30),
  shortDescription: text.optional(),
  homepageVisible: z.boolean().optional(),
  homepageOrder: z.number().int().min(0).optional(),
});
export const vendor = z.object({
  id,
  name: short,
  contactName: short,
  email: z.email(),
  phone: short,
  address: short,
  city: short,
  state: short,
  categorySlugs: z.array(id),
  status: z.enum(["active", "on_hold"]),
  leadTimeDays: z.number().int().min(0).max(365),
  paymentTerms: text,
  notes: text,
  reliability: z.number().min(0).max(100),
  createdAt: text,
  fulfillmentLocations: z
    .array(
      z.object({
        id,
        vendorId: id,
        label: short,
        address: text,
        city: short,
        state: short,
        latitude: z.number().finite().min(-90).max(90).optional(),
        longitude: z.number().finite().min(-180).max(180).optional(),
        isPrimary: z.boolean(),
        active: z.boolean(),
        pickupAvailable: z.boolean(),
        dispatchLeadTimeDays: z.number().int().min(0).max(365),
      }),
    )
    .max(50)
    .optional(),
});
export const voucher = z
  .object({
    code: z.string().regex(/^[A-Z0-9_-]{2,40}$/),
    type: z.enum(["fixed", "percent"]),
    value: amount,
    minimum: amount,
    description: text,
    active: z.boolean(),
    startAt: text.optional(),
    endAt: text.optional(),
    usageLimit: z.number().int().min(0).max(1000000).optional(),
    usageCount: z.number().int().min(0).optional(),
    perCustomerLimit: z.number().int().min(0).max(1000000).optional(),
    budgetCap: amount.optional(),
    discountUsed: amount.optional(),
    categorySlugs: z.array(id).max(100).optional(),
    productIds: z.array(id).max(500).optional(),
    stackingAllowed: z.boolean().optional(),
  })
  .refine(
    (v) => v.type !== "percent" || v.value <= 100,
    "Percentage cannot exceed 100.",
  );
export const role = z.enum([
  "Super Admin",
  "Catalog Manager",
  "Order Manager",
  "Procurement Manager",
  "Support",
  "Vendor",
]);
export const team = z.object({
  id: id.optional(),
  name: short,
  email: z.email().transform((s) => s.toLowerCase()),
  role,
  vendorId: id.optional(),
  status: z.enum(["active", "invited", "suspended"]),
  lastActive: text,
});
export const banner = z
  .object({
    id,
    title: short,
    eyebrow: text,
    subtitle: text,
    ctaLabel: short,
    href: z.string().regex(/^\/(?![\/\\])/),
    image,
    altText: short,
    placement: z.enum(["hero", "side"]),
    priority: z.number().int().min(0).max(1000).optional(),
    clickCount: z.number().int().min(0).optional(),
    active: z.boolean(),
    startAt: text,
    endAt: text,
  })
  .superRefine((value, context) => {
    const start = Date.parse(value.startAt);
    const end = Date.parse(value.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end))
      context.addIssue({
        code: "custom",
        path: ["startAt"],
        message: "Use a valid banner schedule.",
      });
    else if (end < start)
      context.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "The banner end must be after its start.",
      });
  });
export const sourcing = z.object({
  customerName: short,
  email: z.email(),
  phone: short,
  productName: short,
  categorySlug: id,
  description: text,
  quantity,
  budget: amount.optional(),
  city: short,
  state: short,
  images: z.array(image).max(5).optional(),
});
export const quote = z.object({
  id,
  lines: z
    .array(z.object({ id, description: short, quantity, unitPrice: amount }))
    .min(1)
    .max(50),
  total: amount,
  validUntil: short,
  deliveryEstimate: short,
  status: z.enum(["draft", "sent", "accepted", "declined", "expired"]),
  note: text,
  sentAt: text.optional(),
  respondedAt: text.optional(),
});
export const checkout = z.object({
  orderId: id.optional(),
  customerName: short,
  email: z.email(),
  phone: short,
  address,
  notes: text.default(""),
  saveAddress: z.boolean().default(false),
  voucherCode: z.string().max(40).default(""),
  expectedTotal: amount.optional(),
});
export function kobo(value: number) {
  return Math.round(amount.parse(value) * 100);
}
export function naira(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid money.");
  return value / 100;
}
