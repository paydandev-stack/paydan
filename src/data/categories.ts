import type { Category } from "@/lib/types";
import { categoryImages } from "./images";

/**
 * Public departments plus restricted categories.
 *
 * Restricted departments (regulated goods) stay `restricted: true` and are
 * filtered out of every public surface. They remain visible in the admin
 * catalogue as unpublished previews, per the business brief.
 *
 * Adult Toys is published as a normal department by owner decision; it is no
 * longer treated as a restricted category.
 */
export const categories: Category[] = [
  {
    slug: "supermarket",
    name: "Supermarket",
    title: "Everyday essentials, all in one place",
    description:
      "Pantry staples, household basics and bulk packs sourced from trusted suppliers.",
    image: categoryImages.supermarket,
    order: 1,
    restricted: false,
    subcategories: [
      { slug: "pantry", name: "Pantry" },
      { slug: "household", name: "Household" },
      { slug: "bulk-packs", name: "Bulk packs" },
    ],
    facets: ["Pack size", "Brand"],
  },
  {
    slug: "phones-and-tablets",
    name: "Phones & Tablets",
    title: "Upgrade your everyday tech",
    description:
      "Smartphones, tablets and charging accessories from authorised distributors.",
    image: categoryImages["phones-and-tablets"],
    order: 2,
    restricted: false,
    subcategories: [
      { slug: "smartphones", name: "Smartphones" },
      { slug: "tablets", name: "Tablets" },
      { slug: "accessories", name: "Accessories" },
    ],
    facets: ["Storage", "RAM", "Colour"],
  },
  {
    slug: "adult-toys",
    name: "Adult Toys",
    title: "Discreetly packed, plainly described",
    description:
      "Body-safe personal products from vetted suppliers, shipped in plain packaging.",
    image: categoryImages["adult-toys"],
    order: 7,
    restricted: false,
    subcategories: [
      { slug: "personal-massagers", name: "Personal massagers" },
      { slug: "couples", name: "Couples" },
      { slug: "care-and-accessories", name: "Care & accessories" },
    ],
    facets: ["Material", "Power source", "Water resistance"],
  },
  {
    slug: "health-and-beauty",
    name: "Health & Beauty",
    title: "Care for every routine",
    description:
      "Skincare, haircare and wellness products from vetted beauty suppliers.",
    image: categoryImages["health-and-beauty"],
    order: 4,
    restricted: false,
    subcategories: [
      { slug: "skincare", name: "Skincare" },
      { slug: "haircare", name: "Haircare" },
      { slug: "wellness", name: "Wellness" },
    ],
    facets: ["Skin type", "Volume", "Brand"],
  },
  {
    slug: "fashion",
    name: "Fashion",
    title: "Fresh everyday style",
    description:
      "Contemporary Nigerian labels, wardrobe staples and accessories.",
    image: categoryImages.fashion,
    order: 5,
    restricted: false,
    subcategories: [
      { slug: "womenswear", name: "Womenswear" },
      { slug: "menswear", name: "Menswear" },
      { slug: "accessories", name: "Accessories" },
    ],
    facets: ["Size", "Colour", "Material"],
  },
  {
    slug: "food-and-eatery",
    name: "Food & Eatery",
    title: "Meals worth sharing",
    description:
      "Party trays, family platters and fresh produce prepared by local kitchens.",
    image: categoryImages["food-and-eatery"],
    order: 6,
    restricted: false,
    subcategories: [
      { slug: "party-packs", name: "Party packs" },
      { slug: "fresh-produce", name: "Fresh produce" },
      { slug: "everyday-meals", name: "Everyday meals" },
    ],
    facets: ["Serves", "Preparation"],
  },
  {
    slug: "home-and-living",
    name: "Home & Living",
    title: "Make space for better living",
    description:
      "Furniture, bedding and tableware chosen for practical, comfortable homes.",
    image: categoryImages["home-and-living"],
    order: 13,
    restricted: false,
    subcategories: [
      { slug: "furniture", name: "Furniture" },
      { slug: "bedding", name: "Bedding" },
      { slug: "kitchen-dining", name: "Kitchen & dining" },
    ],
    facets: ["Material", "Size", "Colour"],
  },
  {
    slug: "village-market",
    name: "Village Market",
    title: "Straight from the open-air market",
    description:
      "Fresh produce, grains, spices and household goods bought in from local market traders.",
    image: categoryImages["village-market"],
    order: 3,
    restricted: false,
    subcategories: [
      { slug: "fresh-produce", name: "Fresh produce" },
      { slug: "grains-and-spices", name: "Grains & spices" },
      { slug: "market-household", name: "Household goods" },
    ],
    facets: ["Weight", "Origin", "Market day"],
  },
  {
    slug: "personal-care",
    name: "Personal Care",
    title: "Small rituals, big difference",
    description:
      "Everyday grooming and self-care essentials from specialist suppliers.",
    image: categoryImages["personal-care"],
    order: 14,
    restricted: false,
    subcategories: [
      { slug: "body-care", name: "Body care" },
      { slug: "grooming", name: "Grooming" },
    ],
    facets: ["Type", "Scent"],
  },
  {
    slug: "fuel-and-energy",
    name: "Fuel & Energy",
    title: "Energy products and accessories",
    description:
      "Gas, fuel and power accessories coordinated through licensed suppliers.",
    image: categoryImages["fuel-and-energy"],
    order: 10,
    restricted: false,
    subcategories: [
      { slug: "cooking-gas", name: "Cooking gas" },
      { slug: "fuel", name: "Fuel" },
      { slug: "power-accessories", name: "Power accessories" },
    ],
    facets: ["Volume", "Delivery", "Licence"],
  },
  {
    slug: "shoes-and-bags",
    name: "Shoes & Bags",
    title: "Finish every look",
    description: "Sneakers, formal shoes and bags for work and weekends.",
    image: categoryImages["shoes-and-bags"],
    order: 11,
    restricted: false,
    subcategories: [
      { slug: "sneakers", name: "Sneakers" },
      { slug: "formal", name: "Formal" },
      { slug: "bags", name: "Bags" },
    ],
    facets: ["Size", "Material", "Colour"],
  },
  {
    slug: "gaming",
    name: "Gaming",
    title: "Consoles and accessories",
    description:
      "Consoles, controllers and headsets for casual and competitive players.",
    image: categoryImages.gaming,
    order: 8,
    restricted: false,
    subcategories: [
      { slug: "consoles", name: "Consoles" },
      { slug: "controllers", name: "Controllers" },
      { slug: "headsets", name: "Headsets" },
    ],
    facets: ["Platform", "Connection"],
  },
  {
    slug: "appliances",
    name: "Appliances",
    title: "Make home life easier",
    description:
      "Cooling, laundry and kitchen appliances with installation guidance.",
    image: categoryImages.appliances,
    order: 9,
    restricted: false,
    subcategories: [
      { slug: "cooling", name: "Cooling" },
      { slug: "laundry", name: "Laundry" },
      { slug: "kitchen", name: "Kitchen" },
    ],
    facets: ["Capacity", "Energy rating"],
  },
  {
    slug: "automotive-and-fuel",
    name: "Automotive",
    title: "Keep moving",
    description:
      "Car care, tools and fuel-station convenience items coordinated by Paydan.",
    image: categoryImages["automotive-and-fuel"],
    order: 12,
    restricted: false,
    subcategories: [
      { slug: "car-care", name: "Car care" },
      { slug: "tools", name: "Tools" },
    ],
    facets: ["Vehicle type", "Volume"],
  },
  {
    slug: "smoke-box",
    name: "Smoke Box",
    title: "Regulated tobacco-adjacent products",
    description:
      "Regulated department. Unpublished pending licence and age-verification approval.",
    image: categoryImages["smoke-box"],
    order: 91,
    restricted: true,
    subcategories: [{ slug: "tobacco", name: "Tobacco" }],
    facets: ["Compliance"],
  },
];

export const publicCategories = categories.filter(
  (category) => !category.restricted,
);

export function categoryBySlug(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}

export function categoryName(slug: string): string {
  return categoryBySlug(slug)?.name ?? "Other";
}
