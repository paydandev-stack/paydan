import "server-only";

import { randomUUID } from "node:crypto";
import { tool } from "ai";
import { z } from "zod";
import type { Product } from "@/lib/types";
import { database } from "../db";
import type { Viewer } from "../http";
import { snapshot } from "../snapshot";

function productResult(product: Product, signedIn: boolean) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    description: product.description,
    availability: product.availability,
    categorySlug: product.categorySlug,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      availability: variant.availability,
      ...(signedIn && typeof variant.price === "number" ? { price: variant.price } : {}),
    })),
  };
}

function simpleScore(product: Product, query: string) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1);
  const name = product.name.toLowerCase();
  const haystack = [product.name, product.brand, product.description, product.categorySlug, ...(product.highlights || [])].join(" ").toLowerCase();
  return terms.reduce((score, term) => score + (name.includes(term) ? 4 : haystack.includes(term) ? 1 : 0), 0);
}

async function rankedProducts(query: string, products: Product[], limit: number) {
  if (process.env.DATABASE_URL) {
    try {
      const result = await database().query(
        `SELECT product_id FROM product_search
         WHERE search_document @@ websearch_to_tsquery('simple',$1) OR search_text % $1
         ORDER BY ts_rank(search_document,websearch_to_tsquery('simple',$1)) DESC,
                  similarity(search_text,$1) DESC LIMIT $2`,
        [query, limit],
      );
      const byId = new Map(products.map((product) => [product.id, product]));
      const ranked = result.rows.map((row) => byId.get(row.product_id)).filter(Boolean) as Product[];
      if (ranked.length) return ranked;
    } catch (error) {
      if ((error as { code?: string }).code !== "42P01") throw error;
    }
  }
  return products.map((product) => ({ product, score: simpleScore(product, query) })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((entry) => entry.product);
}

export async function assistantTools(user: Viewer | null) {
  const state = await snapshot(user);
  const signedIn = Boolean(user);
  const published = state.products.filter((product) => product.status === "published" && !product.restricted);
  return {
    searchCatalog: tool({
      description: "Search PAYDAN's published catalog. Use this before recommending or claiming that an item exists.",
      inputSchema: z.object({ query: z.string().trim().min(2).max(160), category: z.string().max(100).optional(), limit: z.number().int().min(1).max(6).default(4) }),
      execute: async ({ query, category, limit }) => {
        const candidates = category ? published.filter((product) => product.categorySlug === category) : published;
        const products = await rankedProducts(query, candidates, limit);
        return { kind: "products" as const, products: products.map((product) => productResult(product, signedIn)), priceVisibility: signedIn ? "member" : "hidden" };
      },
    }),
    getProductDetails: tool({
      description: "Load current details for a known catalog product ID.",
      inputSchema: z.object({ productId: z.string().max(160) }),
      execute: async ({ productId }) => {
        const product = published.find((item) => item.id === productId);
        return product ? { kind: "product" as const, product: productResult(product, signedIn) } : { kind: "not-found" as const };
      },
    }),
    compareProducts: tool({
      description: "Compare two to four known PAYDAN product IDs using catalog facts only.",
      inputSchema: z.object({ productIds: z.array(z.string().max(160)).min(2).max(4) }),
      execute: async ({ productIds }) => ({ kind: "comparison" as const, products: published.filter((product) => productIds.includes(product.id)).map((product) => productResult(product, signedIn)) }),
    }),
    getCurrentCart: tool({
      description: "Read the signed-in shopper's current cart. Never use for guests.",
      inputSchema: z.object({}),
      execute: async () => user ? {
        kind: "cart" as const,
        lines: state.cart.map((line) => {
          const product = published.find((item) => item.id === line.productId);
          const variant = product?.variants.find((item) => item.id === line.variantId);
          return { ...line, productName: product?.name || "Unavailable item", variantLabel: variant?.label || "", price: variant?.price };
        }),
      } : { kind: "auth-required" as const, href: "/login?next=%2Fcart" },
    }),
    proposeCartChange: tool({
      description: "Create a short-lived add-to-cart proposal for explicit user confirmation. This never changes the cart.",
      inputSchema: z.object({ productId: z.string().max(160), variantId: z.string().max(160), quantity: z.number().int().min(1).max(20) }),
      execute: async ({ productId, variantId, quantity }) => {
        if (!user) return { kind: "auth-required" as const, href: "/login?next=%2Fcart" };
        const product = published.find((item) => item.id === productId);
        const variant = product?.variants.find((item) => item.id === variantId && item.availability !== "out_of_stock");
        if (!product || !variant) return { kind: "not-found" as const };
        const id = randomUUID();
        await database().query(
          "INSERT INTO assistant_proposal(id,owner_id,action,payload,expires_at) VALUES($1,$2,'add_to_cart',$3,now()+interval '15 minutes')",
          [id, user.id, JSON.stringify({ productId, variantId, quantity })],
        );
        return { kind: "cart-proposal" as const, proposalId: id, productId, variantId, quantity, expiresInSeconds: 900 };
      },
    }),
    getOwnOrders: tool({
      description: "Read only the signed-in shopper's own recent orders and statuses.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(5).default(3) }),
      execute: async ({ limit }) => user ? { kind: "orders" as const, orders: state.orders.slice(0, limit).map((order) => ({ id: order.id, reference: order.reference, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, placedAt: order.placedAt })) } : { kind: "auth-required" as const, href: "/login?next=%2Faccount%2Forders" },
    }),
    getShippingOptions: tool({
      description: "Explain configured shipping availability. Fees are account-only and checkout remains authoritative.",
      inputSchema: z.object({ state: z.string().max(80).optional() }),
      execute: async ({ state: requestedState }) => user ? { kind: "shipping" as const, zones: state.shippingZones.filter((zone) => zone.active && (!requestedState || zone.state.toLowerCase() === requestedState.toLowerCase())).map((zone) => ({ state: zone.state, eta: zone.eta, fee: zone.fee })), checkoutAuthoritative: true } : { kind: "shipping-policy" as const, text: "Delivery availability, fees and estimates are confirmed at checkout after sign-in.", href: "/policies/shipping" },
    }),
    getPolicyLinks: tool({
      description: "Return server-approved PAYDAN policy links. Do not invent policy terms.",
      inputSchema: z.object({ topic: z.enum(["shipping", "returns", "privacy", "terms"]) }),
      execute: async ({ topic }) => ({ kind: "links" as const, links: [{ label: `${topic[0].toUpperCase()}${topic.slice(1)} policy`, href: `/policies/${topic}` }] }),
    }),
    createSourcingDraft: tool({
      description: "Provide a safe handoff to the sourcing request form; this does not submit a request.",
      inputSchema: z.object({ productName: z.string().max(160), notes: z.string().max(500).optional() }),
      execute: async ({ productName, notes }) => ({ kind: "draft-link" as const, links: [{ label: "Complete sourcing request", href: `${user ? "" : "/login?next="}${user ? `/request-product?product=${encodeURIComponent(productName)}` : encodeURIComponent(`/request-product?product=${encodeURIComponent(productName)}`)}` }], draft: { productName, notes: notes || "" } }),
    }),
    createSupportDraft: tool({
      description: "Provide a handoff to PAYDAN support; this does not send a message.",
      inputSchema: z.object({ subject: z.string().max(160) }),
      execute: async ({ subject }) => ({ kind: "draft-link" as const, links: [{ label: "Contact support", href: user ? `/contact?subject=${encodeURIComponent(subject)}` : "/login?next=%2Fcontact" }] }),
    }),
  };
}
