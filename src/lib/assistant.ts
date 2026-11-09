import type { Category, FulfillmentStatus, Product } from "./types";

/**
 * Ask PAYDAN's conservative deterministic fallback when live providers fail.
 * Answers only reference the approved catalogue and account-specific context.
 * Product identifiers are resolved by the frontend's permission-aware DTO.
 */

export type AssistantLink = { href: string; label: string };

export type AssistantReply = {
  text: string;
  /** Product ids resolved by the UI through the viewer DTO. */
  productIds?: string[];
  links?: AssistantLink[];
  /** Follow-up chips rendered after this answer. */
  starters?: string[];
};

export type AssistantOrder = {
  id: string;
  reference: string;
  fulfillmentStatus: FulfillmentStatus;
};

export type AssistantContext = {
  signedIn: boolean;
  /** Published, unrestricted catalogue only. */
  products: Product[];
  categories: Category[];
  /** The signed-in customer's orders (empty for guests). */
  orders: AssistantOrder[];
};

export const ASSISTANT_STARTERS = [
  "Find a laptop",
  "How do returns work?",
  "Track my order",
  "I need something you don't stock",
];

const GREETING = /^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/;

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "that",
  "this",
  "are",
  "you",
  "your",
  "please",
  "show",
  "find",
  "want",
  "need",
  "looking",
  "something",
  "product",
  "products",
  "paydan",
  "does",
  "have",
  "has",
  "any",
  "can",
  "how",
  "what",
  "where",
  "when",
  "who",
  "why",
  "is",
  "it",
  "of",
  "in",
  "on",
  "to",
  "from",
  "about",
  "tell",
  "give",
  "get",
  "buy",
  "shop",
]);

/**
 * Conservative shared catalogue matching for live tools and degraded mode.
 * Whole-word matching prevents `car` matching `skincare` or `carryall`.
 * Prefer not returning a product over showing misleading alternatives.
 */
const PRODUCT_QUERY_FILLERS = new Set([
  ...STOPWORDS,
  "me", "my", "some", "any", "kind", "kinds", "type", "types",
  "available", "availability", "options", "option", "best", "good", "better",
  "cheap", "affordable", "expensive", "under", "over", "around", "below", "above",
  "recommendation", "recommendations", "price", "prices", "much", "please",
  "could", "would", "should", "like", "just", "more", "one", "ones", "items", "item",
]);

function normalizeWord(value: string): string {
  if (value.endsWith("ies") && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s") && !value.endsWith("ss") && value.length > 3)
    return value.slice(0, -1);
  return value;
}

function wordList(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) || []).map(normalizeWord);
}

function tokens(value: string): string[] {
  return wordList(value).filter((token) => token.length > 1 && !PRODUCT_QUERY_FILLERS.has(token));
}

const FOOTWEAR = new Set([
  "shoe", "sneaker", "trainer", "boot", "sandal", "slipper", "loafer",
  "heel", "footwear", "flat", "cleat",
]);
const VEHICLES = new Set([
  "car", "vehicle", "automobile", "sedan", "suv", "hatchback", "coupe",
  "convertible", "crossover", "truck", "minivan",
]);
const SMARTPHONES = new Set(["phone", "smartphone", "iphone", "mobile", "handset"]);
const BAGS = new Set(["bag", "handbag", "purse", "tote", "carryall", "backpack", "satchel"]);
const VEHICLE_ACCESSORIES = new Set([
  "care", "detail", "wash", "cleaner", "polish", "wax", "charger", "charging",
  "cover", "mat", "battery", "oil", "tire", "tyre", "accessory", "freshener",
  "holder", "mount", "keychain", "part", "kit", "tool",
]);

/** Remove shopping chatter; useful when searching `what of some shoes?`. */
export function normalizeProductQuery(query: string): string {
  return tokens(query).join(" ");
}

function relatedTerms(token: string): Set<string> {
  if (FOOTWEAR.has(token)) return FOOTWEAR;
  if (VEHICLES.has(token)) return VEHICLES;
  if (SMARTPHONES.has(token)) return SMARTPHONES;
  if (BAGS.has(token)) return BAGS;
  return new Set([token]);
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const term of a) if (b.has(term)) return true;
  return false;
}

function productScore(product: Product, queryTokens: string[]): number {
  const name = new Set(wordList(product.name));
  const content = new Set(wordList([
    product.brand,
    product.description,
    ...(product.highlights || []),
    ...Object.keys(product.specifications || {}),
    ...Object.values(product.specifications || {}),
  ].join(" ")));
  const category = new Set(wordList(product.categorySlug));

  // A request for a car is not a request for car shampoo or spare parts.
  if (queryTokens.length === 1 && VEHICLES.has(queryTokens[0])) {
    if (overlaps(name, VEHICLE_ACCESSORIES)) return 0;
    if (!overlaps(name, VEHICLES) && !overlaps(content, VEHICLES)) return 0;
  }

  // `shoes-and-bags` is a mixed department: bags are not footwear.
  if (queryTokens.some((token) => FOOTWEAR.has(token))) {
    if (!overlaps(name, FOOTWEAR) && !overlaps(content, FOOTWEAR)) return 0;
    if (overlaps(name, new Set(["bag", "handbag", "carryall", "tote", "purse"])) && !overlaps(name, FOOTWEAR)) return 0;
  }

  // `shoes-and-bags` is a mixed department: sneakers are not handbags.
  if (queryTokens.some((token) => BAGS.has(token))) {
    if (!overlaps(name, BAGS) && !overlaps(content, BAGS)) return 0;
    if (overlaps(name, FOOTWEAR) && !overlaps(name, BAGS)) return 0;
  }

  // Search for phones must not silently return headphones or phone accessories.
  if (queryTokens.length === 1 && SMARTPHONES.has(queryTokens[0])) {
    if (!overlaps(name, SMARTPHONES) && !overlaps(content, SMARTPHONES)) return 0;
    if (overlaps(name, new Set(["case", "charger", "cover", "cable", "holder", "headphone", "earphone", "earbud"]))) return 0;
  }

  let total = 0;
  let matched = 0;
  for (const token of queryTokens) {
    const terms = relatedTerms(token);
    if (overlaps(name, terms)) { total += 6; matched++; }
    else if (overlaps(content, terms)) { total += 2; matched++; }
    else if (overlaps(category, terms) && !FOOTWEAR.has(token) && !VEHICLES.has(token) && !BAGS.has(token)) {
      total += 1;
      matched++;
    }
  }
  // Multiple significant terms must mostly match; don't recommend unrelated items.
  if (matched < Math.ceil(queryTokens.length * 0.6)) return 0;
  return total;
}

/** Returns published catalogue candidates already filtered by caller permission. */
export function searchRelevantProducts(
  query: string,
  products: Product[],
  limit = 4,
): Product[] {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return [];
  return products
    .map((product) => ({ product, score: productScore(product, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, limit)
    .map(({ product }) => product);
}

function searchProducts(query: string, products: Product[], limit = 4): Product[] {
  return searchRelevantProducts(query, products, limit);
}

function matchCategory(
  query: string,
  categories: Category[],
): Category | undefined {
  const q = query.toLowerCase();
  return categories.find((category) => {
    const names = [
      category.name,
      category.title,
      category.slug,
      ...category.subcategories.map((sub) => sub.name),
    ];
    return names.some(
      (name) =>
        name.toLowerCase().includes(q) || q.includes(name.toLowerCase()),
    );
  });
}

const CONTAINERS = [
  "i need",
  "i want",
  "do you have",
  "does paydan",
  "can i get",
  "where can i find",
  "looking for",
];

function stripContainers(query: string): string {
  let q = query;
  for (const container of CONTAINERS) {
    if (q.includes(container)) {
      q = q.slice(q.indexOf(container) + container.length);
      break;
    }
  }
  return q.trim();
}

/** Build the reply for one user message. Pure: safe to re-run on retry. */
export function answerFor(
  input: string,
  ctx: AssistantContext,
): AssistantReply {
  const raw = input.trim();
  const q = raw.toLowerCase();

  if (!q) {
    return {
      text: "Ask me anything about the catalogue or your account.",
      starters: ASSISTANT_STARTERS,
    };
  }

  // 1. Greeting / identity.
  if (
    GREETING.test(q) ||
    q === "who are you" ||
    q.includes("what can you do")
  ) {
    return {
      text: ctx.signedIn
        ? "Hi — I'm Ask PAYDAN, the shopping assistant for this storefront. I can find products with your member prices, explain policies, and pull up your orders. What are you after?"
        : "Hi — I'm Ask PAYDAN, the shopping assistant for this storefront. I can find products, explain departments and policies, and help you start a sourcing request. Prices and order history need a signed-in account.",
      starters: ASSISTANT_STARTERS,
    };
  }

  // 2. Order tracking.
  if (
    /(track|delivery status|where is my order|order status|my orders)/.test(q)
  ) {
    if (ctx.signedIn) {
      if (ctx.orders.length === 0) {
        return {
          text: "You don't have any orders yet. Once you place one, its tracking and supplier-group updates appear in your account.",
          links: [{ href: "/shop", label: "Browse the catalogue" }],
        };
      }
      return {
        text: `You have ${ctx.orders.length} ${ctx.orders.length === 1 ? "order" : "orders"}. Open one to see payment, fulfilment and tracking.`,
        links: [
          ...ctx.orders.slice(0, 3).map((order) => ({
            href: `/account/orders/${order.id}`,
            label: `${order.reference} · ${order.fulfillmentStatus.replace(/_/g, " ")}`,
          })),
          { href: "/account/orders", label: "All orders" },
        ],
      };
    }
    return {
      text: "Order history is private to an account, but you can still look up an order if you have its reference and the email used at checkout.",
      links: [
        { href: "/track-order", label: "Track an order" },
        {
          href: "/login?next=%2Faccount%2Forders",
          label: "Sign in to see your orders",
        },
      ],
    };
  }

  // 3. Returns.
  if (/(return|refund|send it back|send back|damaged|broken item)/.test(q)) {
    return {
      text: ctx.signedIn
        ? "Returns are started from the order they belong to, and each request is reviewed before anything is refunded. The full policy page is marked draft in this demonstration build."
        : "Returns are handled per order, so they start from a signed-in account. The full policy page is marked draft in this demonstration build.",
      links: ctx.signedIn
        ? [
            { href: "/account/returns", label: "Your return requests" },
            { href: "/policies/returns", label: "Returns policy" },
          ]
        : [{ href: "/policies/returns", label: "Returns policy" }],
    };
  }

  // 4. Shipping and delivery.
  if (/(ship|deliver|delivery|how long|how many days|eta|courier)/.test(q)) {
    return {
      text: "Delivery timing depends on your state: the fee and estimate for your address are shown at checkout before you pay, sourced from the store's shipping zones rather than a fixed promise.",
      links: [
        { href: "/policies/shipping", label: "Shipping and delivery policy" },
        { href: "/track-order", label: "Track an order" },
      ],
    };
  }

  // 5. Sourcing / out-of-catalogue requests.
  if (
    /(source|sourcing|don'?t (stock|carry|have)|not (stocked|available)|special order|procure|custom request)/.test(
      q,
    )
  ) {
    return {
      text: "That's what sourcing is for: describe the product, quantity and budget, and Paydan finds suppliers and quotes you before anything is ordered. You'll get a reference to follow in your account.",
      links: [
        { href: "/request-product", label: "Make a sourcing request" },
        ...(ctx.signedIn
          ? [
              {
                href: "/account/sourcing-requests",
                label: "Your sourcing requests",
              },
            ]
          : []),
      ],
    };
  }

  // 6. Prices (guests get a handoff, never an amount).
  if (/(price|how much|cost|₦|naira|expensive|cheap|affordable)/.test(q)) {
    if (!ctx.signedIn) {
      return {
        text: "Catalogue prices are shown to signed-in shoppers — guests see product details, departments and availability without amounts. Your browse and cart draft stay right where they are.",
        links: [
          { href: "/login?next=%2Fshop", label: "Sign in to view prices" },
        ],
      };
    }
    const matches = searchProducts(stripContainers(q), ctx.products);
    if (matches.length > 0) {
      return {
        text: "Here are the closest matches at your member prices:",
        productIds: matches.map((product) => product.id),
        links: [
          {
            href: `/search?q=${encodeURIComponent(raw)}`,
            label: "See full search results",
          },
        ],
      };
    }
    return {
      text: "Tell me a product name or department and I'll pull up what's listed.",
      links: [{ href: "/shop", label: "Browse everything" }],
    };
  }

  // 7. Promotions — honest: no code flow exists yet.
  if (/(voucher|coupon|promo code|discount code|promotion code)/.test(q)) {
    return {
      text: "This demonstration build has no promotion-code field at checkout, so I can't share working codes — anything discounted shows its price directly on the product.",
      links: [{ href: "/deals", label: "See what's discounted" }],
    };
  }

  // 8. Support.
  const shoppingIntent =
  /\b(find|search|show|browse|buy|shop|recommend|compare|looking for)\b/.test(q);

if (
  !shoppingIntent &&
  /\b(help|support|contact|human|agent|person|email|call you)\b/.test(q)
) {
    return {
      text: "For an existing order or account question, support can pick it up directly. The help centre covers the common cases first.",
      links: [
        { href: "/help", label: "Help centre" },
        { href: "/contact", label: "Contact support" },
        { href: "/faq", label: "FAQ" },
      ],
    };
  }

  // 9. Policies.
  if (/(privacy|terms|policy|policies|legal)/.test(q)) {
    return {
      text: "All four policies live together — note they're labelled draft in this build, pending business approval.",
      links: [
        { href: "/policies/shipping", label: "Shipping" },
        { href: "/policies/returns", label: "Returns" },
        { href: "/policies/privacy", label: "Privacy" },
        { href: "/policies/terms", label: "Terms" },
      ],
    };
  }

  // 10. Cart and checkout.
  if (/(cart|basket|checkout|pay for|purchase|buy now)/.test(q)) {
    if (ctx.signedIn) {
      return {
        text: "Your cart and checkout are where quantities, delivery estimate and payment review happen.",
        links: [
          { href: "/cart", label: "Open your cart" },
          { href: "/checkout", label: "Go to checkout" },
        ],
      };
    }
    return {
      text: "You can keep browsing and build a selection as a guest — it stays in this browser as an unpriced draft. Checkout itself needs an account.",
      links: [
        { href: "/login?next=%2Fcart", label: "Sign in to check out" },
        { href: "/cart", label: "View your draft" },
      ],
    };
  }

  // 11. Account areas.
  if (
    /(my account|profile|address|wishlist|saved items|dashboard|settings)/.test(
      q,
    )
  ) {
    if (ctx.signedIn) {
      return {
        text: "Everything about your account lives under one roof — orders, returns, sourcing, saved items and addresses.",
        links: [
          { href: "/account", label: "Account overview" },
          { href: "/account/wishlist", label: "Wishlist" },
          { href: "/account/addresses", label: "Addresses" },
        ],
      };
    }
    return {
      text: "Account details are only visible to a signed-in shopper.",
      links: [{ href: "/login?next=%2Faccount", label: "Sign in" }],
    };
  }

  // 12. Department match.
  const category = matchCategory(stripContainers(q), ctx.categories);
  if (category) {
    const inDepartment = ctx.products
      .filter((product) => product.categorySlug === category.slug)
      .slice(0, 4);
    return {
      text: `${category.name} — ${category.description}${
        category.subcategories.length > 0
          ? ` Sections: ${category.subcategories.map((sub) => sub.name).join(", ")}.`
          : ""
      }`,
      productIds:
        inDepartment.length > 0
          ? inDepartment.map((product) => product.id)
          : undefined,
      links: [
        {
          href: `/category/${category.slug}`,
          label: `Shop all ${category.name}`,
        },
      ],
    };
  }

  // 13. Product search.
  const matches = searchProducts(stripContainers(q), ctx.products);
  if (matches.length > 0) {
    return {
      text: `Found ${matches.length} ${matches.length === 1 ? "match" : "matches"} for “${raw}”${
        ctx.signedIn ? "" : " — sign in to see prices"
      }.`,
      productIds: matches.map((product) => product.id),
      links: [
        {
          href: `/search?q=${encodeURIComponent(raw)}`,
          label: "See full search results",
        },
      ],
    };
  }

  // 14. Honest fallback.
  return {
    text: "I couldn't find a reliable match in PAYDAN's catalogue. You can browse departments or request help sourcing the product.",
    starters: ASSISTANT_STARTERS,
    links: [
      { href: "/shop", label: "Browse the catalogue" },
      { href: "/help", label: "Help centre" },
    ],
  };
}
