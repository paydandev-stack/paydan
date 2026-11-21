import { checkoutInitSchema } from "@/mobile-contract/schemas";
import { checkout } from "@/server/schemas";
import { initialize, quoteCart } from "@/server/payments";
import { database } from "@/server/db";
import { isMobileReturnUrl } from "@/server/origins";
import {
mobileBody,
mobileFailure,
mobileJson,
mobileLimit,
mobileViewer,
requireMobileUser,
} from "@/server/mobile-http";

export const runtime = "nodejs";

/**
 * POST /api/mobile/v1/checkout/initialize
 * Body: MobileCheckoutInit. Server recalculates totals, reserves stock,
 * initializes Paystack with the server secret, and returns the
 * authorization URL. The client never supplies the authoritative total —
 * `expectedTotal` is an anti-tamper check, and mismatches are rejected.
 * Idempotent on `key`.
 */
export async function POST(request: Request) {
try {
const user = await mobileViewer(request);
requireMobileUser(user);
await mobileLimit(`mobile-checkout:${user.id}`, 20);
const raw = await mobileBody(request);
const parsed = checkoutInitSchema.parse(raw);
if (parsed.returnUrl && !isMobileReturnUrl(parsed.returnUrl))
return mobileJson(
{
code: "validation",
message: "This return URL is not approved for payments.",
},
400,
);
const input = checkout.parse({
customerName: parsed.customerName,
email: parsed.email,
phone: parsed.phone,
address: {
label: parsed.address.label,
recipient: parsed.address.recipient,
phone: parsed.address.phone,
street: parsed.address.street,
landmark: parsed.address.landmark,
city: parsed.address.city,
state: parsed.address.state,
isDefault: parsed.address.isDefault,
},
notes: parsed.notes,
saveAddress: parsed.saveAddress,
voucherCode: parsed.voucherCode,
expectedTotal: parsed.expectedTotal,
});
if (raw.action === "quote") {
const quote = await quoteCart(database(), user, input);
return mobileJson({
subtotal: quote.subtotal,
deliveryFee: quote.deliveryFee,
discount: quote.discount,
total: quote.total,
eta: quote.eta,
});
}
const order = await initialize(user, input, parsed.key, parsed.returnUrl);
return mobileJson(order);
} catch (error) {
return mobileFailure(error);
}
}
