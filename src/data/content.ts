/**
 * Storefront editorial and service copy.
 * Policy text is deliberately marked draft: the business has not approved
 * final terms, so nothing here may promise delivery, return or warranty
 * commitments as settled policy.
 */

export const about = {
  eyebrow: "About Paydan",
  title: "One storefront. A whole network behind it.",
  intro:
    "Paydan is a Nigerian retailer and procurement partner. We list products from many suppliers under one Paydan-branded store, then coordinate the sourcing, purchase and delivery of each item ourselves.",
  sections: [
    {
      heading: "Why the supplier network matters",
      body: [
        "A supermarket pack, a phone and a piece of furniture rarely come from the same place. Instead of sending you to three different shops, Paydan keeps one checkout and follows each supplier order separately.",
        "That means a single order can progress in stages. One item may be ready while another is still being confirmed with its supplier. Your order page shows the whole picture rather than a single vague status.",
      ],
    },
    {
      heading: "What we are building",
      body: [
        "Browse our departments, sign in to your personal dashboard, and review your selections before paying securely through Paystack.",
        "Behind the scenes, Paydan's team handles supplier relationships, order splitting, procurement and customer follow-up. Supplier records and costs stay internal.",
      ],
    },
    {
      heading: "What we do not claim",
      body: [
        "Delivery timelines, return terms and payment options are confirmed per order while the business finalises its published policies. We will not publish a promise we cannot keep.",
        "If a product cannot be sourced, you will see it in the order status rather than an invented assurance.",
      ],
    },
  ],
};

export const contactChannels = [
  {
    title: "Customer support",
    detail: "Order questions, delivery coordination and returns.",
    value: "support@paydan.demo",
    note: "Demo contact address",
  },
  {
    title: "Sourcing team",
    detail: "Requests for products not currently listed.",
    value: "source@paydan.demo",
    note: "Demo contact address",
  },
  {
    title: "Phone",
    detail: "Monday to Saturday, 9:00–18:00 WAT.",
    value: "+234 801 000 0000",
    note: "Demo contact number",
  },
];

export const faqGroups = [
  {
    title: "Ordering and payment",
    items: [
      {
        q: "How do I pay for an order?",
        a: "Sign in, review your cart and delivery details, then pay through Paystack. Payment is verified before your order is processed.",
      },
      {
        q: "Why does my order show more than one status?",
        a: "Payment and fulfilment are tracked separately. A paid order can be in processing, packing or delivery. Each delivery group also progresses on its own so you can see which items are moving.",
      },
      {
        q: "Can I change my delivery address after ordering?",
        a: "Contact support as early as possible. Once an item has been dispatched, the delivery address cannot usually be changed.",
      },
    ],
  },
  {
    title: "Products and availability",
    items: [
      {
        q: "Does Paydan hold all the stock?",
        a: "No. Paydan lists products sourced from many suppliers and coordinates the order. Items requiring supplier confirmation must be confirmed before payment. Where that is the case, the product card says availability is to be confirmed.",
      },
      {
        q: "What if a product is out of stock?",
        a: "You can request the product instead. Paydan's sourcing team will look for a supplier and send a quotation with a price and estimated delivery window.",
      },
      {
        q: "Are the prices final?",
        a: "Current prices are available after signing in. Your checkout total is confirmed before payment. Sourcing quotations have a validity date.",
      },
    ],
  },
  {
    title: "Delivery and returns",
    items: [
      {
        q: "How much is delivery?",
        a: "Delivery is estimated from your state at checkout. The final fee is confirmed once the supplier and delivery method are set. No fixed nationwide fee is promised here.",
      },
      {
        q: "Can I return an item?",
        a: "Return eligibility depends on the item and its condition. You can submit a return request from your account; Paydan reviews each request before approving it.",
      },
      {
        q: "Can different items in one order arrive separately?",
        a: "Yes. Items from different suppliers are fulfilled separately, so parts of one order may arrive at different times.",
      },
    ],
  },
];

export type PolicyPage = {
  slug: string;
  title: string;
  summary: string;
  updated: string;
  status: "Draft — pending business approval";
  sections: { heading: string; paragraphs: string[] }[];
};

const draftLabel = "Draft — pending business approval" as const;

export const policyPages: PolicyPage[] = [
  {
    slug: "shipping",
    title: "Shipping and delivery",
    summary:
      "How Paydan coordinates delivery across multiple suppliers. Draft copy pending business approval.",
    updated: "October 2026",
    status: draftLabel,
    sections: [
      {
        heading: "How delivery is coordinated",
        paragraphs: [
          "Paydan confirms each item with its supplier before dispatch. Because an order can include items from several suppliers, items may be packed and dispatched in more than one group.",
          "The delivery estimate shown at checkout is calculated from the delivery state and the suppliers involved. It is an estimate, not a guaranteed date.",
        ],
      },
      {
        heading: "Delivery fees",
        paragraphs: [
          "Fees vary by state and by the size of the items in the order. Bulk items and appliances may require additional handling or installation coordination.",
          "No nationwide free-delivery or fixed-fee promise is made. The applicable fee is shown before you place the order.",
        ],
      },
      {
        heading: "Receiving an order",
        paragraphs: [
          "Please check items on arrival and report damage through your account within the window confirmed for that order. Keep packaging until the order is confirmed complete.",
        ],
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns and refunds",
    summary:
      "Return request process and eligibility caveats. Draft copy pending business approval.",
    updated: "October 2026",
    status: draftLabel,
    sections: [
      {
        heading: "Requesting a return",
        paragraphs: [
          "Submit a return request from the order in your account. Select the item, provide a reason and add any photos that help the team assess the request.",
          "Paydan reviews every request. Submitting a request does not automatically approve it.",
        ],
      },
      {
        heading: "Eligibility",
        paragraphs: [
          "Eligibility depends on the item category, its condition and the time since delivery. Perishable food, personal-care items and installed appliances may be excluded.",
          "The exact return window for each item will be published once the business confirms its policy. Until then, this page is a draft and the support team confirms eligibility per request.",
        ],
      },
      {
        heading: "Refunds",
        paragraphs: [
          "Approved refunds are sent through Paystack to the original payment method. The status is updated after Paystack confirms processing.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy",
    summary:
      "How PAYDAN uses account and shopping data. Draft copy pending business approval.",
    updated: "October 2026",
    status: draftLabel,
    sections: [
      {
        heading: "Data used by PAYDAN",
        paragraphs: [
          "Your account, cart, orders and sourcing requests are stored on PAYDAN servers. Uploaded images are stored in private object storage. Chat history and unfinished shopping selections may be kept in this browser session.",
          "Account details and delivery information are used to provide the shopping, payment, delivery and support services you request.",
        ],
      },
      {
        heading: "Service providers",
        paragraphs: [
          "Account data is stored in PostgreSQL, images in AWS S3, and payments are handled by Paystack. Google sign-in is optional. When enabled, the AI provider receives your chat and relevant catalogue context; member requests may include limited order status. PAYDAN does not collect card details in its own forms.",
          "Supplier costs and contacts are internal business records and are not shown to customers.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of use",
    summary: "Draft terms for business review before public launch.",
    updated: "October 2026",
    status: draftLabel,
    sections: [
      {
        heading: "Shopping and payment",
        paragraphs: [
          "Sign in to review current prices, delivery availability and your order total before making a payment. These draft terms must be replaced with the business-approved purchase terms before public launch.",
          "Payment details are entered on Paystack. Never share card details or passwords through chat or support.",
        ],
      },
      {
        heading: "Catalogue and availability",
        paragraphs: [
          "Products requiring supplier confirmation cannot be paid for until availability is confirmed. Stock and delivery are rechecked before checkout.",
        ],
      },
      {
        heading: "Quotations",
        paragraphs: [
          "Review a sourcing quotation before accepting it. Quotes have a validity date; supplier confirmation and delivery details are required before payment.",
        ],
      },
    ],
  },
];

export function policyBySlug(slug: string): PolicyPage | undefined {
  return policyPages.find((page) => page.slug === slug);
}

export const helpTopics = [
  {
    title: "Track an order",
    description:
      "Use your order reference and contact details to see progress.",
    href: "/track-order",
  },
  {
    title: "Returns and after-sales",
    description:
      "Start a return request from an eligible order in your account.",
    href: "/account/returns",
  },
  {
    title: "Product sourcing",
    description: "Ask Paydan to find a product that is not in the catalogue.",
    href: "/request-product",
  },
  {
    title: "Contact support",
    description: "Reach the team about an existing order or account question.",
    href: "/contact",
  },
];

export const trustPoints = [
  {
    title: "One Paydan checkout",
    body: "A single cart and one payment, even when items come from different suppliers.",
  },
  {
    title: "Supplier coordination",
    body: "Our team handles supplier confirmation, procurement and follow-up behind the scenes.",
  },
  {
    title: "Sourcing assistance",
    body: "If it is not in the catalogue, tell us what you need and we will look for it.",
  },
];
