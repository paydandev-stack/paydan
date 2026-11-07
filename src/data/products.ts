import "server-only";
import type { Availability, Product, ProductStatus } from "@/lib/types";
import { slugify } from "@/lib/format";
import { IMAGES, categoryImages } from "./images";

type SeedVariant = {
  label: string;
  price?: number;
  compareAt?: number;
  options?: Record<string, string>;
  availability?: Availability;
};

type Seed = {
  id: string;
  name: string;
  categorySlug: string;
  brand: string;
  price: number;
  costRatio?: number;
  compareAt?: number;
  vendorId: string;
  image: keyof typeof IMAGES;
  blurb: string;
  availability?: Availability;
  status?: ProductStatus;
  restricted?: boolean;
  featured?: boolean;
  newArrival?: boolean;
  variants?: SeedVariant[];
  highlights?: string[];
  specifications?: Record<string, string>;
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
};

function p(seed: Seed): Product {
  const sku = `PD-${seed.categorySlug.slice(0, 3).toUpperCase()}-${seed.id.split("-")[1]}`;
  const availability = seed.availability ?? "in_stock";
  const variants = (seed.variants ?? [{ label: "Standard" }]).map(
    (variant, index) => ({
      id: `${seed.id}-v${index + 1}`,
      sku: `${sku}-${index + 1}`,
      label: variant.label,
      options: variant.options ?? {},
      price: variant.price ?? seed.price,
      compareAt:
        variant.compareAt ?? (index === 0 ? seed.compareAt : undefined),
      availability: variant.availability ?? availability,
    }),
  );
  const status = seed.status ?? "published";
  return {
    id: seed.id,
    slug: slugify(seed.name),
    sku,
    name: seed.name,
    categorySlug: seed.categorySlug,
    brand: seed.brand,
    images: [IMAGES[seed.image], categoryImages[seed.categorySlug]],
    description: `${seed.blurb} Every listing on Paydan is coordinated by our own team: we confirm supplier availability, then follow the order through to dispatch. Availability is checked again before payment.`,
    highlights: seed.highlights ?? [
      "Sourced and coordinated by Paydan",
      "Supplier availability confirmed before dispatch",
      "Availability checked again before payment",
    ],
    specifications: {
      Brand: seed.brand,
      SKU: sku,
      Department: seed.categorySlug.replaceAll("-", " "),
      ...seed.specifications,
    },
    price: seed.price,
    compareAt: seed.compareAt,
    availability,
    vendorId: seed.vendorId,
    costPrice: Math.round((seed.price * (seed.costRatio ?? 0.7)) / 100) * 100,
    variants,
    status,
    featured: seed.featured ?? false,
    newArrival: seed.newArrival ?? false,
    restricted: seed.restricted ?? false,
    rating: seed.rating ?? 4.6,
    reviewCount: seed.reviewCount ?? 24,
    createdAt:
      seed.createdAt ??
      (seed.newArrival ? "2026-10-28T09:00:00Z" : "2026-09-18T09:00:00Z"),
    updatedAt: seed.newArrival
      ? "2026-10-28T09:00:00Z"
      : "2026-09-18T09:00:00Z",
  };
}

export const products: Product[] = [
  // Supermarket
  p({
    id: "p-01",
    name: "Everyday Pantry Value Pack",
    categorySlug: "supermarket",
    brand: "Paydan Pantry",
    price: 28500,
    compareAt: 32000,
    vendorId: "v-1",
    image: "groceries",
    featured: true,
    blurb:
      "Rice, pasta, cooking oil and seasoning bundled into one weekly shop.",
    highlights: [
      "Eight pantry staples in one bundle",
      "Bulk pricing from a Lagos supplier",
      "Delivery timing confirmed after order",
    ],
    specifications: { Contents: "8 items", "Pack weight": "12.4kg" },
    rating: 4.7,
    reviewCount: 61,
  }),
  p({
    id: "p-02",
    name: "Premium Long-Grain Rice 10kg",
    categorySlug: "supermarket",
    brand: "Mama's Choice",
    price: 42000,
    compareAt: 46000,
    vendorId: "v-6",
    image: "groceries",
    availability: "supplier_confirm",
    blurb: "Long-grain parboiled rice packed in a resealable 10kg sack.",
    specifications: { Weight: "10kg", Grade: "Premium parboiled" },
  }),
  p({
    id: "p-03",
    name: "Cold-Pressed Cooking Oil 5L",
    categorySlug: "supermarket",
    brand: "Gold Drop",
    price: 18900,
    vendorId: "v-1",
    image: "groceries",
    blurb: "Vegetable cooking oil supplied in a 5-litre food-grade container.",
    specifications: { Volume: "5 litres", Type: "Vegetable oil" },
  }),
  p({
    id: "p-04",
    name: "Household Cleaning Bundle",
    categorySlug: "supermarket",
    brand: "CleanDay",
    price: 15750,
    compareAt: 18500,
    vendorId: "v-1",
    image: "groceries",
    blurb:
      "Dish soap, surface cleaner, bleach and wipes in one household pack.",
    specifications: { Contents: "4 items", Use: "Kitchen and bathroom" },
  }),
  p({
    id: "p-05",
    name: "Breakfast Essentials Hamper",
    categorySlug: "supermarket",
    brand: "Paydan Pantry",
    price: 24300,
    vendorId: "v-6",
    image: "groceries",
    newArrival: true,
    blurb:
      "Tea, milk powder, oats, spreads and a local honey jar in a gift-ready hamper.",
    specifications: { Contents: "6 items", Packaging: "Gift hamper" },
  }),

  // Health & Beauty
  p({
    id: "p-06",
    name: "Daily Radiance Skincare Set",
    categorySlug: "health-and-beauty",
    brand: "Lumière",
    price: 32500,
    compareAt: 38500,
    vendorId: "v-2",
    image: "skincare",
    featured: true,
    blurb:
      "Cleanser, toner and moisturiser for a simple morning and evening routine.",
    highlights: [
      "Three-step routine for normal to dry skin",
      "Batch numbers recorded on delivery",
      "Gift set option available",
    ],
    specifications: { "Skin type": "Normal to dry", Volume: "3 x 150ml" },
    variants: [{ label: "Standard set" }, { label: "Gift set", price: 36000 }],
    rating: 4.8,
    reviewCount: 74,
  }),
  p({
    id: "p-07",
    name: "Hydrating Face Serum 30ml",
    categorySlug: "health-and-beauty",
    brand: "Lumière",
    price: 14800,
    vendorId: "v-2",
    image: "beauty",
    blurb: "Lightweight hyaluronic serum for daily hydration.",
    specifications: { Volume: "30ml", "Skin type": "All skin types" },
  }),
  p({
    id: "p-08",
    name: "Herbal Hair Care Duo",
    categorySlug: "health-and-beauty",
    brand: "Root & Crown",
    price: 19500,
    vendorId: "v-2",
    image: "beauty",
    availability: "supplier_confirm",
    blurb: "Shampoo and leave-in conditioner formulated for natural hair.",
    specifications: { Volume: "2 x 250ml", Hair: "Natural and relaxed" },
  }),
  p({
    id: "p-09",
    name: "Vitamin C Wellness Pack",
    categorySlug: "health-and-beauty",
    brand: "Wellwise",
    price: 12900,
    compareAt: 15000,
    vendorId: "v-2",
    image: "beauty",
    newArrival: true,
    blurb: "Thirty-day vitamin C and zinc supplement pack.",
    specifications: { Supply: "30 days", Form: "Tablets" },
  }),

  // Phones & Tablets
  p({
    id: "p-10",
    name: "Samsung Galaxy A55 5G",
    categorySlug: "phones-and-tablets",
    brand: "Samsung",
    price: 629500,
    compareAt: 684000,
    vendorId: "v-3",
    image: "phone",
    featured: true,
    blurb: "6.6-inch 5G smartphone with 120Hz display and 50MP main camera.",
    highlights: [
      "Sealed unit with manufacturer warranty",
      "Two storage options",
      "Serial number captured for warranty",
    ],
    specifications: {
      Display: "6.6-inch Super AMOLED",
      Camera: "50MP + 12MP + 5MP",
      Battery: "5,000mAh",
      Warranty: "12 months",
    },
    variants: [
      { label: "128GB", price: 589500 },
      { label: "256GB", price: 629500 },
    ],
    rating: 4.8,
    reviewCount: 112,
  }),
  p({
    id: "p-11",
    name: "Infinix Note 40 Pro",
    categorySlug: "phones-and-tablets",
    brand: "Infinix",
    price: 385000,
    vendorId: "v-4",
    image: "phone",
    blurb: "Mid-range 5G phone with fast charging and a 108MP camera.",
    specifications: {
      Display: "6.78-inch AMOLED",
      Battery: "5,000mAh",
      Charging: "45W",
    },
    variants: [
      { label: "128GB", price: 349000 },
      { label: "256GB", price: 385000 },
    ],
  }),
  p({
    id: "p-12",
    name: "Tecno Camon 30",
    categorySlug: "phones-and-tablets",
    brand: "Tecno",
    price: 298500,
    vendorId: "v-4",
    image: "phone",
    availability: "supplier_confirm",
    blurb: "Everyday smartphone with a large display and all-day battery.",
    specifications: { Display: "6.78-inch AMOLED", Battery: "5,000mAh" },
    variants: [{ label: "128GB" }, { label: "256GB", price: 328500 }],
  }),
  p({
    id: "p-13",
    name: "10.1-inch Android Tablet 64GB",
    categorySlug: "phones-and-tablets",
    brand: "Samsung",
    price: 215000,
    vendorId: "v-3",
    image: "phone",
    newArrival: true,
    blurb: "Lightweight tablet for study, streaming and light work.",
    specifications: { Display: "10.1-inch LCD", Storage: "64GB" },
  }),
  p({
    id: "p-14",
    name: "20,000mAh Fast-Charge Power Bank",
    categorySlug: "phones-and-tablets",
    brand: "Oraimo",
    price: 28900,
    compareAt: 34000,
    vendorId: "v-3",
    image: "phone",
    blurb: "High-capacity power bank with dual output and USB-C input.",
    specifications: { Capacity: "20,000mAh", Output: "22.5W" },
  }),

  // Computing

  // Fashion
  p({
    id: "p-20",
    name: "Contemporary Ankara Two-Piece",
    categorySlug: "fashion",
    brand: "Àṣà Studio",
    price: 42000,
    vendorId: "v-5",
    image: "ankara",
    featured: true,
    blurb: "Tailored Ankara top and trousers cut from locally printed fabric.",
    highlights: [
      "Cut and sewn in Lagos",
      "Four sizes available",
      "Small-batch production",
    ],
    specifications: {
      Material: "100% cotton wax print",
      Care: "Hand wash cold",
    },
    variants: [
      { label: "S", price: 42000 },
      { label: "M", price: 42000 },
      { label: "L", price: 44000 },
      { label: "XL", price: 46000 },
    ],
    rating: 4.9,
    reviewCount: 41,
  }),
  p({
    id: "p-21",
    name: "Tailored Linen Shirt",
    categorySlug: "fashion",
    brand: "Àṣà Studio",
    price: 26500,
    vendorId: "v-5",
    image: "fashion",
    blurb: "Breathable linen shirt with a relaxed tailored fit.",
    specifications: { Material: "70% linen, 30% cotton" },
    variants: [{ label: "S" }, { label: "M" }, { label: "L" }, { label: "XL" }],
  }),
  p({
    id: "p-22",
    name: "Denim Jacket",
    categorySlug: "fashion",
    brand: "Yaba Denim Co.",
    price: 38000,
    compareAt: 44000,
    vendorId: "v-5",
    image: "fashion",
    blurb: "Mid-weight denim jacket with a classic collar and metal buttons.",
    specifications: { Material: "100% cotton denim" },
    variants: [{ label: "S" }, { label: "M" }, { label: "L" }],
  }),
  p({
    id: "p-23",
    name: "Silk-Blend Headwrap Set",
    categorySlug: "fashion",
    brand: "Àṣà Studio",
    price: 12500,
    vendorId: "v-5",
    image: "ankara",
    newArrival: true,
    blurb: "Two silk-blend headwraps in complementary prints.",
    specifications: { Contents: "2 wraps", Material: "Silk blend" },
  }),

  // Shoes & Bags
  p({
    id: "p-24",
    name: "Classic Leather Carryall",
    categorySlug: "shoes-and-bags",
    brand: "Abuja Atelier",
    price: 74500,
    vendorId: "v-9",
    image: "bag",
    featured: true,
    blurb: "Structured leather carryall with a detachable shoulder strap.",
    specifications: {
      Material: "Full-grain leather",
      Dimensions: "38 x 28 x 12cm",
    },
    rating: 4.8,
    reviewCount: 33,
  }),
  p({
    id: "p-25",
    name: "Everyday Canvas Sneakers",
    categorySlug: "shoes-and-bags",
    brand: "Streetline",
    price: 36900,
    vendorId: "v-9",
    image: "fashion",
    blurb: "Low-top canvas sneakers with a cushioned footbed.",
    specifications: { Upper: "Canvas", Sole: "Rubber" },
    variants: [
      { label: "40" },
      { label: "41" },
      { label: "42" },
      { label: "43" },
      { label: "44" },
      { label: "45" },
    ],
  }),
  p({
    id: "p-26",
    name: "Structured Tote Bag",
    categorySlug: "shoes-and-bags",
    brand: "Abuja Atelier",
    price: 48000,
    vendorId: "v-9",
    image: "bag",
    newArrival: true,
    blurb: "Roomy tote with an interior laptop sleeve for everyday commuting.",
    specifications: {
      Material: "Vegan leather",
      "Laptop fit": "Up to 14 inches",
    },
  }),

  // Food & Eatery
  p({
    id: "p-27",
    name: "Small Chops Party Tray",
    categorySlug: "food-and-eatery",
    brand: "Lagos Kitchen",
    price: 35000,
    vendorId: "v-1",
    image: "food",
    blurb:
      "Assorted small chops prepared fresh for gatherings and office events.",
    highlights: [
      "Prepared to order",
      "Serves 10 guests",
      "Larger tray available",
    ],
    specifications: {
      Serves: "10 guests",
      Contents: "Puff-puff, samosa, spring rolls, peppered gizzard",
    },
    variants: [{ label: "Serves 10" }, { label: "Serves 20", price: 65000 }],
  }),
  p({
    id: "p-28",
    name: "Grilled Chicken Family Platter",
    categorySlug: "food-and-eatery",
    brand: "Lagos Kitchen",
    price: 28500,
    vendorId: "v-1",
    image: "food",
    availability: "supplier_confirm",
    blurb: "Grilled chicken with jollof rice, plantain and coleslaw.",
    specifications: { Serves: "4 people", Preparation: "Same-day" },
  }),
  p({
    id: "p-29",
    name: "Jollof Rice Party Pack (Serves 10)",
    categorySlug: "food-and-eatery",
    brand: "Northern Pantry Kitchen",
    price: 45000,
    vendorId: "v-6",
    image: "food",
    featured: true,
    blurb: "Smoky party jollof with chicken, plantain and a side salad.",
    specifications: { Serves: "10 people", Packaging: "Catering tray" },
    rating: 4.8,
    reviewCount: 52,
  }),
  p({
    id: "p-30",
    name: "Fresh Fruit Basket",
    categorySlug: "food-and-eatery",
    brand: "Northern Pantry Kitchen",
    price: 19800,
    compareAt: 24000,
    vendorId: "v-6",
    image: "food",
    blurb:
      "Seasonal fruit basket assembled by the supplier on the morning of dispatch.",
    specifications: { Contents: "6-8 varieties", Packaging: "Woven basket" },
  }),

  // Home & Living
  p({
    id: "p-31",
    name: "Minimal Home Office Chair",
    categorySlug: "home-and-living",
    brand: "Form & Rest",
    price: 148000,
    compareAt: 165000,
    vendorId: "v-7",
    image: "chair",
    featured: true,
    blurb: "Ergonomic office chair with adjustable height and lumbar support.",
    specifications: { Material: "Mesh and steel", "Max load": "120kg" },
    rating: 4.7,
    reviewCount: 44,
  }),
  p({
    id: "p-32",
    name: "Three-Seater Fabric Sofa",
    categorySlug: "home-and-living",
    brand: "Form & Rest",
    price: 385000,
    vendorId: "v-7",
    image: "interior",
    availability: "supplier_confirm",
    blurb:
      "Three-seater sofa with removable cushion covers and a wooden frame.",
    specifications: {
      Dimensions: "210 x 92 x 85cm",
      Fabric: "Woven polyester",
    },
  }),
  p({
    id: "p-33",
    name: "Ceramic Dinner Set (16 pieces)",
    categorySlug: "home-and-living",
    brand: "Table Story",
    price: 56500,
    vendorId: "v-7",
    image: "interior",
    blurb:
      "Service for four in glazed stoneware, packed with protective inserts.",
    specifications: { Pieces: "16", Material: "Stoneware" },
  }),
  p({
    id: "p-34",
    name: "Cotton Bedding Set",
    categorySlug: "home-and-living",
    brand: "Table Story",
    price: 42000,
    compareAt: 49000,
    vendorId: "v-7",
    image: "interior",
    newArrival: true,
    blurb: "Breathable cotton duvet cover, fitted sheet and two pillowcases.",
    specifications: { Material: "100% cotton", Weave: "300 thread count" },
    variants: [{ label: "Queen" }, { label: "King", price: 51000 }],
  }),

  // Gaming

  // Personal care
  p({
    id: "p-35",
    name: "Smart Console Controller",
    categorySlug: "gaming",
    brand: "Playtech",
    price: 86500,
    vendorId: "v-3",
    image: "controller",
    featured: true,
    blurb:
      "Wireless controller with adjustable triggers and a rechargeable battery.",
    specifications: { Connection: "Bluetooth / USB-C", Battery: "20 hours" },
    rating: 4.7,
    reviewCount: 67,
  }),
  p({
    id: "p-36",
    name: "Wireless Gaming Headset",
    categorySlug: "gaming",
    brand: "Playtech",
    price: 58000,
    compareAt: 65000,
    vendorId: "v-8",
    image: "gaming",
    blurb:
      "Over-ear headset with a detachable microphone and low-latency wireless.",
    specifications: { Connection: "2.4GHz wireless", Battery: "25 hours" },
  }),
  p({
    id: "p-37",
    name: "Retro Handheld Console",
    categorySlug: "gaming",
    brand: "Playtech",
    price: 124000,
    vendorId: "v-8",
    image: "gaming",
    availability: "supplier_confirm",
    blurb: "Handheld console preloaded with a curated retro game library.",
    specifications: { Display: "4-inch IPS", Storage: "64GB" },
  }),
  p({
    id: "p-38",
    name: "Shea Butter Body Ritual Set",
    categorySlug: "personal-care",
    brand: "Greenfield Naturals",
    price: 18500,
    vendorId: "v-2",
    image: "beauty",
    blurb: "Unrefined shea butter, body oil and a natural soap bar.",
    specifications: { Contents: "3 items", Origin: "Nigerian shea" },
  }),
  p({
    id: "p-39",
    name: "Beard Grooming Kit",
    categorySlug: "personal-care",
    brand: "Greenfield Grooming",
    price: 16900,
    vendorId: "v-2",
    image: "beauty",
    newArrival: true,
    blurb: "Beard oil, balm and a stainless steel comb in a travel pouch.",
    specifications: { Contents: "3 items" },
  }),

  // Appliances
  p({
    id: "p-40",
    name: "1.5HP Inverter Air Conditioner",
    categorySlug: "appliances",
    brand: "CoolHome",
    price: 585000,
    vendorId: "v-7",
    image: "appliance",
    availability: "supplier_confirm",
    blurb: "Energy-efficient split air conditioner with installation guidance.",
    specifications: {
      Capacity: "1.5HP",
      Energy: "Inverter",
      Warranty: "12 months",
    },
  }),
  p({
    id: "p-41",
    name: "7kg Front-Load Washing Machine",
    categorySlug: "appliances",
    brand: "CoolHome",
    price: 465000,
    vendorId: "v-7",
    image: "appliance",
    blurb: "Front-load washer with a quick-wash cycle and child lock.",
    specifications: { Capacity: "7kg", Warranty: "12 months" },
  }),

  // Automotive
  p({
    id: "p-42",
    name: "Car Care Detailing Kit",
    categorySlug: "automotive-and-fuel",
    brand: "AutoShine",
    price: 34500,
    vendorId: "v-10",
    image: "car",
    availability: "supplier_confirm",
    blurb:
      "Wash shampoo, microfibre cloths, wax and interior cleaner in one kit.",
    specifications: { Contents: "6 items" },
  }),

  // Restricted / unpublished — admin preview only
  p({
    id: "p-43",
    name: "Rechargeable Personal Massager",
    categorySlug: "adult-toys",
    brand: "Private Label",
    price: 22500,
    compareAt: 26000,
    vendorId: "v-2",
    image: "beauty",
    blurb:
      "Body-safe silicone massager with ten intensity settings and USB-C charging.",
    highlights: [
      "Body-safe silicone",
      "Shipped in unbranded packaging",
      "USB-C rechargeable",
    ],
    specifications: {
      Material: "Body-safe silicone",
      Power: "USB-C rechargeable",
      Settings: "10 intensities",
    },
  }),
  p({
    id: "p-44",
    name: "Premium Cigar Selection Box",
    categorySlug: "smoke-box",
    brand: "Regulated Goods",
    price: 65000,
    vendorId: "v-2",
    image: "groceries",
    status: "draft",
    restricted: true,
    blurb:
      "Regulated demo listing. Unpublished pending licence and age-verification approval.",
  }),
  p({
    id: "p-45",
    name: "Festival Gift Hamper",
    categorySlug: "supermarket",
    brand: "Paydan Pantry",
    price: 56000,
    vendorId: "v-1",
    image: "groceries",
    status: "draft",
    blurb:
      "Seasonal gift hamper awaiting merchandising sign-off before publication.",
  }),
];

export const publishedProducts = products.filter(
  (product) => product.status === "published" && !product.restricted,
);

export function productBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function productById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}
