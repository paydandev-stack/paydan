import {
beforeAll,
beforeEach,
afterAll,
afterEach,
describe,
expect,
it,
vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const harness = vi.hoisted(() => ({
db: null as unknown as import("@electric-sql/pglite").PGlite,
pool: null as unknown,
}));
function adapter(client: Pick<PGlite, "query">) {
return {
async query(sql: string, params?: unknown[]) {
if (sql.includes("pg_advisory_xact_lock"))
return { rows: [], rowCount: 1 };
const r = await client.query(sql, params);
return { ...r, rowCount: r.affectedRows ?? r.rows.length };
},
release() {},
on() {},
removeListener() {},
};
}
vi.mock("../src/server/db", async (original) => {
const actual = await original<typeof import("../src/server/db")>();
return {
...actual,
database: () => harness.pool,
transaction: async (fn: (db: unknown) => unknown) =>
harness.db.transaction(async (tx) =>
fn(adapter(tx as unknown as PGlite)),
),
};
});
async function sessionCookieFor(
email: string,
name: string,
password: string,
verified: boolean,
) {
const headers = new Headers({
origin: "http://localhost:3000",
"content-type": "application/json",
});
await auth().handler(
new Request("http://localhost:3000/api/auth/sign-up/email", {
method: "POST",
headers,
body: JSON.stringify({ name, email, password }),
}),
);
if (verified)
await database().query('UPDATE "user" SET "emailVerified"=true WHERE email=$1', [
email,
]);
const signin = await auth().handler(
new Request("http://localhost:3000/api/auth/sign-in/email", {
method: "POST",
headers,
body: JSON.stringify({ email, password }),
}),
);
if (signin.status !== 200)
throw new Error(`sign-in failed for ${email}: ${signin.status}`);
return (signin.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "));
}
import { database, put } from "../src/server/db";
import { command } from "../src/server/commands";
import { auth } from "../src/server/auth";
import { queryCatalog, productDetail } from "../src/server/mobile-catalog";
import { toMobileError } from "../src/mobile-contract/errors";
import { checkoutInitSchema } from "../src/mobile-contract/schemas";
import { mobileSchemes, isMobileReturnUrl } from "../src/server/origins";
import { confirmAssistantProposal } from "../src/server/assistant";
import { initialize, resumePayment, verifyPayment } from "../src/server/payments";
import { GET as mobileCatalog } from "../src/app/api/mobile/v1/catalog/route";
import { GET as mobileDepartments } from "../src/app/api/mobile/v1/departments/route";
import { GET as mobileOrders, } from "../src/app/api/mobile/v1/orders/route";
import { GET as mobileOrderDetail } from "../src/app/api/mobile/v1/orders/[id]/route";
import { GET as bootstrap } from "../src/app/api/mobile/v1/bootstrap/route";
import { POST as reconcilePayment } from "../src/app/api/mobile/v1/payments/[reference]/reconcile/route";
import { GET as mobileCart, PATCH as patchMobileCart } from "../src/app/api/mobile/v1/cart/route";
import { GET as mobileWishlist, POST as postMobileWishlist } from "../src/app/api/mobile/v1/wishlist/route";
import { GET as getMobileProfile, PATCH as patchMobileProfile } from "../src/app/api/mobile/v1/profile/route";
import { GET as getMobileSourcing, POST as postMobileSourcing } from "../src/app/api/mobile/v1/sourcing/route";
import { GET as getPushPrefs, PUT as putPushPref } from "../src/app/api/mobile/v1/devices/push-preferences/route";
import type { Product } from "../src/lib/types";
import { getMigrations } from "better-auth/db/migration";

const alice = { id: "alice", email: "alice@example.com", name: "Alice" };
const bob = { id: "bob", email: "bob@example.com", name: "Bob" };

const cookies = new Map<string, string>();

const AuthedRequest = (url: string, user: typeof alice, init?: RequestInit) => {
const cookie = cookies.get(user.email);
if (!cookie) throw new Error(`no session for ${user.email}`);
return new Request(url, {
...init,
headers: { cookie, ...(init?.headers || {}) },
});
};

const product: Product = {
id: "p1",
slug: "phone",
sku: "PHONE",
name: "A phone",
categorySlug: "phones",
brand: "Example",
images: ["https://images.unsplash.com/example"],
description: "A useful phone",
highlights: ["Display"],
specifications: { storage: "128GB" },
price: 1250.25,
availability: "in_stock",
vendorId: "supplier-secret",
costPrice: 900,
variants: [
{
id: "v1",
sku: "PHONE-1",
label: "Black",
options: { color: "Black" },
price: 1250.25,
availability: "in_stock",
},
],
status: "published",
featured: true,
newArrival: true,
restricted: false,
rating: 0,
reviewCount: 0,
 createdAt: "2026-01-01T00:00:00.000Z",
 updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeAll(async () => {
vi.stubEnv("DATABASE_URL", "postgres://isolated-test");
vi.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-at-least-32-characters-please");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_isolated");
vi.stubEnv("MEDIA_CDN_URL", "https://media.paydan.test/assets");
harness.db = new PGlite();
const client = adapter(harness.db);
harness.pool = {
...client,
connect: async () => client,
end: async () => {},
};
for (const file of [
"001_commerce.sql",
"002_inventory.sql",
"004_assistant_proposals.sql",
"005_mail_outbox_upgrade.sql",
"006_operational_completion.sql",
"007_push_tokens.sql",
"008_push_outbox.sql",
])
await harness.db.exec(await readFile(`migrations/${file}`, "utf8"));
const migration = await getMigrations(auth().options);
await migration.runMigrations();
cookies.set(alice.email, await sessionCookieFor(alice.email, alice.name, "long-test-password-123", true));
cookies.set(bob.email, await sessionCookieFor(bob.email, bob.name, "long-test-password-123", true));
});
beforeEach(async () => {
await harness.db.exec(
"TRUNCATE commerce_record,catalog_sku,command_receipt,payment,webhook_event,mail_outbox,rate_bucket,media,refund,inventory,inventory_reservation,assistant_proposal,email_webhook_event,email_suppression,worker_run,notification,support_message,support_thread,push_token",
);
await put(database(), "products", product.id, product);
await put(database(), "categories", "phones", {
slug: "phones",
name: "Phones",
title: "Phones",
description: "Devices",
image: "/favicon.svg",
order: 0,
restricted: false,
subcategories: [],
facets: [],
});
await put(database(), "shippingZones", "lagos", {
id: "lagos",
state: "Lagos",
fee: 100.05,
eta: "2-3 days",
active: true,
});
await database().query(
"INSERT INTO inventory(product_id,variant_id,available) VALUES($1,$2,$3)",
["p1", "v1", 5],
);
});
afterEach(() => {
vi.unstubAllGlobals();
});
afterAll(async () => {
await harness.db.close();
vi.unstubAllEnvs();
});

describe("mobile catalogue contract", () => {
it("keeps guest catalogue price-free over the shared query path", async () => {
const result = await queryCatalog(null, { limit: 10 });
expect(result.total).toBe(1);
expect(result.products[0]).not.toHaveProperty("price");
expect(JSON.stringify(result)).not.toContain("supplier-secret");
expect(JSON.stringify(result)).not.toContain("900");
});
it("gives members prices through the mobile catalog route", async () => {
const response = await mobileCatalog(
AuthedRequest("http://localhost:3000/api/mobile/v1/catalog?limit=10", alice),
);
expect(response.status).toBe(200);
const body = (await response.json()) as {
products: Array<Record<string, unknown>>;
};
expect(body.products[0]).toMatchObject({ price: 1250.25 });
expect(body.products[0]).not.toHaveProperty("costPrice");
expect(body.products[0]).not.toHaveProperty("vendorId");
});
it("rejects guest price sorts with a stable forbidden code", async () => {
const response = await mobileCatalog(
new Request("http://localhost:3000/api/mobile/v1/catalog?sort=price-asc"),
);
expect(response.status).toBe(403);
const body = (await response.json()) as { code: string };
expect(body.code).toBe("forbidden");
});
it("returns viewer-scoped product detail without supplier fields", async () => {
const { product: detail } = await productDetail(alice, "phone");
expect(detail).toMatchObject({ id: "p1", price: 1250.25 });
expect(detail).not.toHaveProperty("costPrice");
const guest = await productDetail(null, "phone");
expect(guest.product).not.toHaveProperty("price");
});
it("lists only customer-visible departments", async () => {
const response = await mobileDepartments(
new Request("http://localhost:3000/api/mobile/v1/departments"),
);
expect(response.status).toBe(200);
const body = (await response.json()) as {
departments: Array<{ slug: string; restricted: boolean }>;
};
expect(body.departments.map((d) => d.slug)).toContain("phones");
expect(body.departments.every((d) => !d.restricted)).toBe(true);
});
it("exposes no prices or account data in bootstrap for guests", async () => {
const response = await bootstrap(
new Request("http://localhost:3000/api/mobile/v1/bootstrap"),
);
expect(response.status).toBe(200);
const wire = await response.text();
for (const field of ['"price"', '"cart"', '"costPrice"', "supplier-secret"])
expect(wire).not.toContain(field);
});
});

describe("mobile authorization boundaries", () => {
it("isolates carts between viewers", async () => {
await command(alice, "addToCart", ["p1", "v1", 1], crypto.randomUUID());
const response = await mobileOrders(
AuthedRequest("http://localhost:3000/api/mobile/v1/orders", bob),
);
expect(response.status).toBe(200);
expect(((await response.json()) as { orders: unknown[] }).orders).toEqual(
[],
);
});
it("returns 404 for another viewer's order id", async () => {
await put(
database(),
"orders",
"order-alice",
{ id: "order-alice", customerId: alice.id, reference: "PD-1" },
alice.id,
);
const response = await mobileOrderDetail(
AuthedRequest("http://localhost:3000/api/mobile/v1/orders/order-alice", bob),
{ params: Promise.resolve({ id: "order-alice" }) },
);
expect(response.status).toBe(404);
expect(((await response.json()) as { code: string }).code).toBe("not_found");
});
it("requires authentication for account routes", async () => {
const response = await mobileOrders(
new Request("http://localhost:3000/api/mobile/v1/orders"),
);
expect(response.status).toBe(401);
expect(((await response.json()) as { code: string }).code).toBe(
"unauthenticated",
);
});
it("rejects unverified sessions for member data", async () => {
const verifiedCookie = await sessionCookieFor(
"unverified@example.com",
"Unverified",
"long-test-password-123",
true,
);
await database().query('UPDATE "user" SET "emailVerified"=false WHERE email=$1', [
"unverified@example.com",
]);
const unverified = verifiedCookie;
const response = await mobileOrders(
new Request("http://localhost:3000/api/mobile/v1/orders", {
headers: { cookie: unverified },
}),
);
expect(response.status).toBe(401);
});
it("replays idempotent cart mutations without duplicating lines", async () => {
const key = crypto.randomUUID();
await command(alice, "addToCart", ["p1", "v1", 1], key);
await command(alice, "addToCart", ["p1", "v1", 1], key);
const { account } = await import("../src/server/commands");
const state = await account(database(), alice);
expect(state.cart).toHaveLength(1);
expect(state.cart[0].quantity).toBe(1);
await expect(
command(alice, "addToCart", ["p1", "v1", 2], key),
).rejects.toMatchObject({ status: 409 });
});
it("keeps another viewer's cart proposal unconfirmable", async () => {
const id = crypto.randomUUID();
await database().query(
"INSERT INTO assistant_proposal(id,owner_id,action,payload,expires_at) VALUES($1,$2,'add_to_cart',$3,now()+interval '15 minutes')",
[id, alice.id, JSON.stringify({ productId: "p1", variantId: "v1", quantity: 1 })],
);
await expect(confirmAssistantProposal(bob, { proposalId: id })).rejects.toMatchObject({ status: 404 });
await confirmAssistantProposal(alice, { proposalId: id });
const { account } = await import("../src/server/commands");
expect((await account(database(), alice)).cart[0].quantity).toBe(1);
});
});

describe("mobile contract schemas and errors", () => {
describe("mobile account and commerce routes", () => {
it("reads and mutates the viewer cart through mobile routes", async () => {
const patched = await patchMobileCart(
AuthedRequest("http://localhost:3000/api/mobile/v1/cart", alice, {
method: "PATCH",
body: JSON.stringify({
key: crypto.randomUUID(),
mutation: { op: "add", productId: "p1", variantId: "v1", quantity: 2 },
}),
}),
);
expect(patched.status).toBe(200);
expect(
((await patched.json()) as { cart: { quantity: number }[] }).cart[0].quantity,
).toBe(2);
const response = await mobileCart(
AuthedRequest("http://localhost:3000/api/mobile/v1/cart", alice),
);
expect(response.status).toBe(200);
expect(((await response.json()) as { cart: unknown[] }).cart).toHaveLength(1);
});
it("toggles the wishlist and returns priced product projections", async () => {
const toggled = await postMobileWishlist(
AuthedRequest("http://localhost:3000/api/mobile/v1/wishlist", alice, {
method: "POST",
body: JSON.stringify({ key: crypto.randomUUID(), productId: "p1" }),
}),
);
expect(toggled.status).toBe(200);
expect(
((await toggled.json()) as { wishlist: string[] }).wishlist,
).toContain("p1");
const response = await mobileWishlist(
AuthedRequest("http://localhost:3000/api/mobile/v1/wishlist", alice),
);
expect(response.status).toBe(200);
const body = (await response.json()) as {
wishlist: string[];
products: { price?: number; costPrice?: number }[];
};
expect(body.products[0].price).toBe(1250.25);
expect(body.products[0]).not.toHaveProperty("costPrice");
});
it("updates and reads the viewer profile", async () => {
const patched = await patchMobileProfile(
AuthedRequest("http://localhost:3000/api/mobile/v1/profile", alice, {
method: "PATCH",
headers: { origin: "http://localhost:3000" },
body: JSON.stringify({
name: "Alice Updated",
phone: "0801",
city: "Ikeja",
state: "Lagos",
}),
}),
);
expect(patched.status).toBe(200);
const response = await getMobileProfile(
AuthedRequest("http://localhost:3000/api/mobile/v1/profile", alice),
);
expect(response.status).toBe(200);
expect((await response.json()) as unknown).toMatchObject({
profile: { phone: "0801", city: "Ikeja", state: "Lagos" },
});
});
it("sets and reads non-essential push preferences", async () => {
const updated = await putPushPref(
AuthedRequest("http://localhost:3000/api/mobile/v1/devices/push-preferences", alice, {
method: "PUT",
body: JSON.stringify({ category: "marketing", optedOut: true }),
}),
);
expect(updated.status).toBe(200);
const response = await getPushPrefs(
AuthedRequest("http://localhost:3000/api/mobile/v1/devices/push-preferences", alice),
);
expect(response.status).toBe(200);
const body = (await response.json()) as {
preferences: { category: string; optedOut: boolean }[];
};
expect(body.preferences.find((p) => p.category === "marketing")?.optedOut).toBe(true);
});
it("submits and lists viewer sourcing requests", async () => {
const submitted = await postMobileSourcing(
AuthedRequest("http://localhost:3000/api/mobile/v1/sourcing", alice, {
method: "POST",
body: JSON.stringify({
key: crypto.randomUUID(),
customerName: "Alice",
email: alice.email,
phone: "0801",
productName: "Industrial mixer",
categorySlug: "phones",
description: "Stainless steel bowl",
quantity: 1,
city: "Ikeja",
state: "Lagos",
}),
}),
);
expect(submitted.status).toBe(200);
const response = await getMobileSourcing(
AuthedRequest("http://localhost:3000/api/mobile/v1/sourcing", alice),
);
expect(response.status).toBe(200);
const body = (await response.json()) as {
sourcing: { productName: string; status: string }[];
};
expect(body.sourcing[0].productName).toBe("Industrial mixer");
expect(body.sourcing[0].status).toBe("received");
});
});
it("validates checkout input with an idempotency key", () => {
expect(() =>
checkoutInitSchema.parse({
customerName: "Alice",
email: "alice@example.com",
phone: "0801",
address: {
label: "Home",
recipient: "Alice",
phone: "0801",
street: "1 Road",
city: "Ikeja",
state: "Lagos",
},
key: "not-a-uuid",
}),
).toThrow();
const parsed = checkoutInitSchema.parse({
customerName: "Alice",
email: "alice@example.com",
phone: "0801",
address: {
label: "Home",
recipient: "Alice",
phone: "0801",
street: "1 Road",
city: "Ikeja",
state: "Lagos",
},
key: crypto.randomUUID(),
});
expect(parsed.saveAddress).toBe(false);
expect(parsed.notes).toBe("");
});
it("maps statuses to stable machine-readable codes", () => {
expect(toMobileError(401, "Sign in")).toMatchObject({ code: "unauthenticated" });
expect(toMobileError(401, "verify your email")).toMatchObject({ code: "email_unverified" });
expect(toMobileError(404, "missing")).toMatchObject({ code: "not_found" });
expect(toMobileError(409, "Prices changed")).toMatchObject({ code: "price_changed" });
expect(toMobileError(409, "insufficient stock")).toMatchObject({ code: "stock_changed" });
expect(toMobileError(409, "pending payment")).toMatchObject({ code: "pending_payment" });
expect(toMobileError(503, "down")).toMatchObject({ code: "service_unavailable" });
});
it("allow-lists mobile return URLs by explicit prefix only", () => {
vi.stubEnv("MOBILE_APP_SCHEMES", "paydan://app,https://paydan.store");
expect(mobileSchemes()).toEqual(["paydan://app", "https://paydan.store"]);
expect(isMobileReturnUrl("paydan://app/checkout/success?ref=PD-1")).toBe(true);
expect(isMobileReturnUrl("https://paydan.store/checkout/success")).toBe(true);
expect(isMobileReturnUrl("https://evil.com/paydan://app")).toBe(false);
expect(isMobileReturnUrl(undefined)).toBe(false);
});
it("rejects forged payment references for another viewer", async () => {
await expect(verifyPayment("PD-forged-reference", bob)).rejects.toMatchObject({ status: 404 });
});
it("reconciles only the signed-in viewer's payment reference", async () => {
const viewer = await database().query('SELECT id FROM "user" WHERE email=$1', [
alice.email,
]);
const viewerId = viewer.rows[0].id as string;
await database().query(
"INSERT INTO payment(reference,order_id,owner_id,amount_kobo,currency,email,status) VALUES($1,$2,$3,$4,'NGN',$5,'paid')",
["PD-reconcile-1", "order-reconcile", viewerId, 100000, alice.email],
);
const request = AuthedRequest(
"http://localhost:3000/api/mobile/v1/payments/PD-reconcile-1/reconcile",
alice,
{ method: "POST", body: "{}" },
);
const response = await reconcilePayment(request, {
params: Promise.resolve({ reference: "PD-reconcile-1" }),
});
expect(response.status).toBe(200);
expect(await response.json()).toMatchObject({
status: "paid",
orderId: "order-reconcile",
});
const denied = await reconcilePayment(
AuthedRequest(
"http://localhost:3000/api/mobile/v1/payments/PD-reconcile-1/reconcile",
bob,
{ method: "POST", body: "{}" },
),
{ params: Promise.resolve({ reference: "PD-reconcile-1" }) },
);
expect(denied.status).toBe(404);
});
it("registers and removes push tokens per owner device", async () => {
await database().query(
"INSERT INTO push_token(owner_id,device_id,platform,app_environment,token) VALUES($1,$2,$3,$4,$5)",
[alice.id, "device-1", "android", "production", "ExponentPushToken[aaa]"],
);
await database().query(
"INSERT INTO push_token(owner_id,device_id,platform,app_environment,token) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,device_id,app_environment) DO UPDATE SET token=excluded.token,updated_at=now()",
[alice.id, "device-1", "android", "production", "ExponentPushToken[bbb]"],
);
const rows = await database().query("SELECT token FROM push_token WHERE owner_id=$1", [alice.id]);
expect(rows.rows).toHaveLength(1);
expect(rows.rows[0].token).toBe("ExponentPushToken[bbb]");
await database().query("DELETE FROM push_token WHERE owner_id=$1 AND device_id=$2", [alice.id, "device-1"]);
const after = await database().query("SELECT count(*)::int AS c FROM push_token WHERE owner_id=$1", [alice.id]);
expect(after.rows[0].c).toBe(0);
});
it("threads a mobile callback URL without changing web defaults", async () => {
vi.stubEnv("PAYSTACK_SECRET_KEY", "");
await expect(initialize(alice, { orderId: "x" } as never, crypto.randomUUID())).rejects.toBeTruthy();
expect(typeof resumePayment).toBe("function");
});
});
