import { z } from "zod";
import { createHash } from "node:crypto";
import {
  ADMIN_RECORD_CAPABILITIES,
  isAdminRecordKind,
} from "@/lib/admin-records-config";
import { writeAudit } from "@/server/audit";
import { database, put, record, records, transaction } from "@/server/db";
import {
  body,
  failure,
  HttpError,
  json,
  limit,
  requireCapability,
  sameOrigin,
  viewer,
} from "@/server/http";

function kindFrom(value: string | null) {
  if (!value || !isAdminRecordKind(value))
    throw new HttpError(400, "Unknown record kind.");
  return value;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = kindFrom(url.searchParams.get("kind"));
    requireCapability(
      await viewer(request.headers),
      ADMIN_RECORD_CAPABILITIES[kind],
    );
    return json({ records: await records(database(), kind) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    const input = z
      .object({
        kind: z.string().min(1).max(80),
        id: z.string().min(1).max(150),
        patch: z.record(z.string(), z.unknown()),
        key: z.string().min(8).max(150),
      })
      .parse(await body(request));
    const kind = kindFrom(input.kind);
    requireCapability(user, ADMIN_RECORD_CAPABILITIES[kind]);
    await limit("admin-record:" + user!.id, 200);
    if (JSON.stringify(input.patch).length > 20000)
      throw new HttpError(413, "The record is too large.");
    for (const field of ["id", "createdAt", "updatedAt", "updatedBy"])
      delete input.patch[field];
    const digest = createHash("sha256")
      .update(JSON.stringify({ kind, id: input.id, patch: input.patch }))
      .digest("hex");
    const result = await transaction(async (db) => {
      const priorReceipt = await db.query(
        "SELECT digest,result FROM command_receipt WHERE owner_id=$1 AND key=$2",
        [user!.id, input.key],
      );
      if (priorReceipt.rows[0]) {
        if (priorReceipt.rows[0].digest !== digest)
          throw new HttpError(409, "This request key was already used.");
        return priorReceipt.rows[0].result;
      }
      const before = await record<Record<string, unknown>>(db, kind, input.id);
      const now = new Date().toISOString();
      const next = {
        ...before,
        ...input.patch,
        id: input.id,
        createdAt: before?.createdAt ?? now,
        updatedAt: now,
        updatedBy: user!.email,
      };
      await put(db, kind, input.id, next, user!.id);
      await writeAudit(db, {
        actor: user!.email,
        action: kind + ".save",
        record: input.id,
        capability: ADMIN_RECORD_CAPABILITIES[kind],
        source: "admin",
        before,
        after: next,
      });
      await db.query(
        "INSERT INTO command_receipt(owner_id,key,digest,result) VALUES($1,$2,$3,$4)",
        [user!.id, input.key, digest, JSON.stringify(next)],
      );
      return next;
    });
    return json({ record: result });
  } catch (error) {
    return failure(error);
  }
}
