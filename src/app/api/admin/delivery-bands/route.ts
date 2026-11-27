import { z } from "zod";
import { database } from "@/server/db";
import {
  body,
  failure,
  json,
  requireCapability,
  sameOrigin,
  viewer,
} from "@/server/http";
import { writeAudit } from "@/server/audit";

const band = z
  .object({
    id: z.enum([
      "same_city",
      "same_state",
      "nearby_region",
      "interstate",
      "remote_area",
    ]),
    label: z.string().trim().min(2).max(80),
    fee: z.number().finite().min(0).max(100000000),
    transitDaysMin: z.number().int().min(0).max(365),
    transitDaysMax: z.number().int().min(0).max(365),
    active: z.boolean(),
  })
  .refine((value) => value.transitDaysMax >= value.transitDaysMin, {
    message: "Maximum transit days must not be below the minimum.",
    path: ["transitDaysMax"],
  });

export async function GET(request: Request) {
  try {
    requireCapability(await viewer(request.headers), "shipping.write");
    const result = await database().query(
      `SELECT id,label,fee,transit_days_min AS "transitDaysMin",
              transit_days_max AS "transitDaysMax",active
       FROM delivery_band ORDER BY id`,
    );
    return json(result.rows.map((row) => ({ ...row, fee: Number(row.fee) })));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireCapability(user, "shipping.write");
    const value = band.parse(await body(request));
    await database().query(
      `INSERT INTO delivery_band(id,label,fee,transit_days_min,transit_days_max,active)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(id) DO UPDATE SET
         label=excluded.label,fee=excluded.fee,
         transit_days_min=excluded.transit_days_min,
         transit_days_max=excluded.transit_days_max,
         active=excluded.active,updated_at=now()`,
      [
        value.id,
        value.label,
        value.fee,
        value.transitDaysMin,
        value.transitDaysMax,
        value.active,
      ],
    );
    await writeAudit(database(), {
      actor: user!.email,
      action: "deliveryBand.save",
      record: value.id,
      capability: "shipping.write",
      source: "admin",
      after: value,
    });
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
