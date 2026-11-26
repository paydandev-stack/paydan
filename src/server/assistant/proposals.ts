import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { command } from "../commands";
import { database } from "../db";
import { HttpError, type Viewer } from "../http";
import { snapshot } from "../snapshot";

export const cartProposalInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_to_cart"),
    productId: z.string().max(160),
    variantId: z.string().max(160),
    quantity: z.number().int().min(1).max(20),
  }),
  z.object({
    action: z.literal("remove_cart_line"),
    productId: z.string().max(160),
    variantId: z.string().max(160),
  }),
  z.object({
    action: z.literal("remove_cart_lines"),
    lines: z
      .array(
        z.object({
          productId: z.string().max(160),
          variantId: z.string().max(160),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({
    action: z.literal("set_cart_quantity"),
    productId: z.string().max(160),
    variantId: z.string().max(160),
    quantity: z.number().int().min(1).max(20),
  }),
  z.object({ action: z.literal("clear_cart") }),
]);

export type CartProposalInput = z.infer<typeof cartProposalInput>;

function lineSummary(
  state: Awaited<ReturnType<typeof snapshot>>,
  productId: string,
  variantId: string,
) {
  const line = state.cart.find(
    (item) => item.productId === productId && item.variantId === variantId,
  );
  const product = state.products.find((item) => item.id === productId);
  const variant = product?.variants.find((item) => item.id === variantId);
  return { line, product, variant };
}

export async function createCartProposal(user: Viewer, raw: CartProposalInput) {
  const input = cartProposalInput.parse(raw);
  const state = await snapshot(user);
  let summary: Record<string, unknown>;

  if (input.action === "clear_cart") {
    if (!state.cart.length)
      throw new HttpError(409, "Your cart is already empty.");
    summary = {
      lineCount: state.cart.length,
      itemCount: state.cart.reduce((total, line) => total + line.quantity, 0),
      productNames: state.cart
        .slice(0, 4)
        .map(
          (line) =>
            state.products.find((product) => product.id === line.productId)
              ?.name || "Unavailable item",
        ),
    };
  } else if (input.action === "remove_cart_lines") {
    const selected = input.lines.map((selectedLine) => {
      const { line, product, variant } = lineSummary(
        state,
        selectedLine.productId,
        selectedLine.variantId,
      );
      if (!line || !product || !variant)
        throw new HttpError(
          409,
          "One of those items is no longer in your cart.",
        );
      return { line, product, variant };
    });
    summary = {
      lineCount: selected.length,
      itemCount: selected.reduce(
        (total, item) => total + item.line.quantity,
        0,
      ),
      productNames: selected.map((item) => item.product.name),
    };
  } else {
    const { line, product, variant } = lineSummary(
      state,
      input.productId,
      input.variantId,
    );
    if (!product || !variant)
      throw new HttpError(404, "That product or option is unavailable.");
    if (input.action === "add_to_cart") {
      if (variant.availability === "out_of_stock")
        throw new HttpError(409, "That option is out of stock.");
      summary = {
        productName: product.name,
        variantLabel: variant.label,
        quantity: input.quantity,
      };
    } else {
      if (!line)
        throw new HttpError(409, "That item is no longer in your cart.");
      summary = {
        productName: product.name,
        variantLabel: variant.label,
        oldQuantity: line.quantity,
        ...(input.action === "set_cart_quantity"
          ? { newQuantity: input.quantity }
          : {}),
      };
    }
  }

  const id = randomUUID();
  await database().query(
    "INSERT INTO assistant_proposal(id,owner_id,action,payload,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')",
    [id, user.id, input.action, JSON.stringify(input)],
  );
  return {
    kind: "cart-proposal" as const,
    proposalId: id,
    action: input.action,
    summary,
    expiresInSeconds: 900,
  };
}

async function proposalFor(user: Viewer, proposalId: string, lock = false) {
  const result = await database().query(
    `SELECT * FROM assistant_proposal WHERE id=$1 AND owner_id=$2${lock ? " FOR UPDATE" : ""}`,
    [proposalId, user.id],
  );
  const proposal = result.rows[0];
  if (!proposal) throw new HttpError(404, "Cart proposal not found.");
  return proposal;
}

export async function confirmCartProposal(user: Viewer, raw: unknown) {
  const { proposalId } = z.object({ proposalId: z.string().uuid() }).parse(raw);
  const proposal = await proposalFor(user, proposalId);
  if (proposal.status === "confirmed")
    return { confirmed: true, status: "already-confirmed" as const };
  if (proposal.status !== "pending")
    throw new HttpError(409, `This cart proposal is ${proposal.status}.`);
  if (Date.parse(proposal.expires_at) <= Date.now()) {
    await database().query(
      "UPDATE assistant_proposal SET status='expired' WHERE id=$1 AND owner_id=$2 AND status='pending'",
      [proposalId, user.id],
    );
    throw new HttpError(
      409,
      "This cart proposal has expired. Ask PAYDAN to create a new one.",
    );
  }

  const payload = cartProposalInput.parse({
    ...proposal.payload,
    action: proposal.action,
  });
  if (payload.action === "add_to_cart")
    await command(
      user,
      "addToCart",
      [payload.productId, payload.variantId, payload.quantity],
      proposalId,
    );
  else if (payload.action === "remove_cart_line") {
    const state = await snapshot(user);
    if (
      !state.cart.some(
        (line) =>
          line.productId === payload.productId &&
          line.variantId === payload.variantId,
      )
    )
      throw new HttpError(409, "That item is no longer in your cart.");
    await command(
      user,
      "removeLine",
      [payload.productId, payload.variantId],
      proposalId,
    );
  } else if (payload.action === "remove_cart_lines") {
    const state = await snapshot(user);
    for (const [index, selected] of payload.lines.entries()) {
      if (
        !state.cart.some(
          (line) =>
            line.productId === selected.productId &&
            line.variantId === selected.variantId,
        )
      )
        throw new HttpError(
          409,
          "One of those items is no longer in your cart.",
        );
      await command(
        user,
        "removeLine",
        [selected.productId, selected.variantId],
        `${proposalId}:${index}`,
      );
    }
  } else if (payload.action === "set_cart_quantity")
    await command(
      user,
      "setQuantity",
      [payload.productId, payload.variantId, payload.quantity],
      proposalId,
    );
  else await command(user, "clearCart", [], proposalId);

  await database().query(
    "UPDATE assistant_proposal SET status='confirmed',confirmed_at=now() WHERE id=$1 AND owner_id=$2 AND status='pending'",
    [proposalId, user.id],
  );
  return {
    confirmed: true,
    status: "confirmed" as const,
    action: payload.action,
  };
}

export async function cancelCartProposal(user: Viewer, raw: unknown) {
  const { proposalId } = z.object({ proposalId: z.string().uuid() }).parse(raw);
  const proposal = await proposalFor(user, proposalId);
  if (proposal.status === "cancelled")
    return { cancelled: true, status: "already-cancelled" as const };
  if (proposal.status !== "pending")
    throw new HttpError(409, `This cart proposal is ${proposal.status}.`);
  const result = await database().query(
    "UPDATE assistant_proposal SET status='cancelled' WHERE id=$1 AND owner_id=$2 AND status='pending' RETURNING id",
    [proposalId, user.id],
  );
  if (!result.rows.length)
    throw new HttpError(409, "This proposal is no longer pending.");
  return { cancelled: true, status: "cancelled" as const };
}
