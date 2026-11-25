import { randomUUID } from "node:crypto";
import { database, record, records, put, type Queryable } from "./db";
import { HttpError } from "./http";
import type { TeamMember, Vendor } from "@/lib/types";

export type VendorInvite = {
  id: string;
  token: string;
  vendorId: string;
  memberId: string;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function inviteUrl(token: string, email: string) {
  const base = process.env.BETTER_AUTH_URL || "https://paydan.store";
  const url = new URL("/vendor/login", base.replace(/\/+$/, "") + "/");
  url.searchParams.set("invite", token);
  url.searchParams.set("email", email);
  return url.toString();
}

export async function revokeVendorInvites(db: Queryable, memberId: string) {
  const invites = await records<VendorInvite>(db, "vendorInvites");
  for (const invite of invites) {
    if (invite.memberId !== memberId || invite.status !== "pending") continue;
    await put(db, "vendorInvites", invite.id, {
      ...invite,
      status: "revoked",
    });
  }
}

export async function issueVendorInvite(
  db: Queryable,
  member: TeamMember,
  vendor: Vendor,
) {
  if (member.role !== "Vendor" || !member.vendorId)
    throw new HttpError(400, "This access record is not a vendor account.");
  if (member.status === "suspended")
    throw new HttpError(
      409,
      "Reactivate this vendor before sending an invite.",
    );
  await revokeVendorInvites(db, member.id);
  const now = new Date();
  const invite: VendorInvite = {
    id: randomUUID(),
    token: randomUUID(),
    vendorId: vendor.id,
    memberId: member.id,
    email: member.email,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TWO_WEEKS_MS).toISOString(),
  };
  await put(db, "vendorInvites", invite.id, invite, member.id);
  return {
    invite,
    url: inviteUrl(invite.token, invite.email),
    eventKey: "vendor:" + member.id + ":invite:" + invite.token,
  };
}

export async function readVendorInvite(token: string) {
  const db = database();
  const invites = await records<VendorInvite>(db, "vendorInvites");
  const invite = invites.find((item) => item.token === token);
  if (!invite) throw new HttpError(404, "This invitation was not found.");
  if (invite.status !== "pending" || Date.parse(invite.expiresAt) <= Date.now())
    throw new HttpError(410, "This invitation is no longer active.");
  const member = await record<TeamMember>(db, "team", invite.memberId);
  const vendor = await record<Vendor>(db, "vendors", invite.vendorId);
  if (
    !member ||
    member.role !== "Vendor" ||
    member.status === "suspended" ||
    !vendor
  )
    throw new HttpError(410, "This invitation is no longer active.");
  return {
    token: invite.token,
    email: invite.email,
    vendorName: vendor.name,
    expiresAt: invite.expiresAt,
  };
}

export async function claimVendorInvite(token: string) {
  const db = database();
  const invites = await records<VendorInvite>(db, "vendorInvites");
  const invite = invites.find((item) => item.token === token);
  if (!invite) throw new HttpError(404, "This invitation was not found.");
  if (invite.status !== "pending" || Date.parse(invite.expiresAt) <= Date.now())
    throw new HttpError(410, "This invitation is no longer active.");
  await put(db, "vendorInvites", invite.id, {
    ...invite,
    status: "accepted",
    acceptedAt: new Date().toISOString(),
  });
  return { accepted: true, email: invite.email };
}
