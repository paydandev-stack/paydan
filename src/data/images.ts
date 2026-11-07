/**
 * Demo photography.
 *
 * The client supplied one brand asset (the logo). These are openly hosted
 * Unsplash photographs used as stand-ins until Paydan's own product
 * photography is available, so a small pool is reused across the catalogue.
 * Swap this module for the client's media library (R2/CDN) at integration time.
 */
const unsplash = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

export const IMAGES = {
  phone: unsplash("photo-1662638035662-455f32fd02ad"),
  earbuds: unsplash("photo-1542321964-7cf9c7ba3b88"),
  laptop: unsplash("photo-1739292774892-0bb523c51a34"),
  skincare: unsplash("photo-1556228720-195a672e8a03"),
  ankara: unsplash("photo-1590739225287-bd31519780c3"),
  controller: unsplash("photo-1592840496694-26d035b52b48"),
  chair: unsplash("photo-1505797149-43b0069ec26b"),
  groceries: unsplash("photo-1542838132-92c53300491e"),
  camera: unsplash("photo-1591869754715-5f679687039c"),
  beauty: unsplash("photo-1676570092589-a6c09ecbb373"),
  bag: unsplash("photo-1548036328-c9fa89d128fa"),
  workspace: unsplash("photo-1634990677553-4a2a6b2dcaac"),
  interior: unsplash("photo-1618221195710-dd6b41faaea6"),
  shopping: unsplash("photo-1739269552505-9263189ce9eb", 1600),
  food: unsplash("photo-1504674900247-0877df9cc836"),
  fashion: unsplash("photo-1483985988355-763728e1935b"),
  gaming: unsplash("photo-1592840496694-26d035b52b48"),
  appliance: unsplash("photo-1584622650111-993a426fbf0a"),
  car: unsplash("photo-1492144534655-ae79c964c9d7"),
} as const;

export const categoryImages: Record<string, string> = {
  supermarket: IMAGES.groceries,
  "health-and-beauty": IMAGES.skincare,
  "phones-and-tablets": IMAGES.phone,
  "adult-toys": IMAGES.beauty,
  fashion: IMAGES.ankara,
  "food-and-eatery": IMAGES.food,
  "home-and-living": IMAGES.interior,
  "village-market": IMAGES.groceries,
  gaming: IMAGES.gaming,
  "fuel-and-energy": IMAGES.car,
  "personal-care": IMAGES.beauty,
  "shoes-and-bags": IMAGES.bag,
  appliances: IMAGES.appliance,
  "automotive-and-fuel": IMAGES.car,
  "smoke-box": IMAGES.groceries,
};

export const heroImage = IMAGES.shopping;
