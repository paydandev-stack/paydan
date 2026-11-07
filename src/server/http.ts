import { createHash } from "node:crypto";
import { z } from "zod";
import { auth } from "./auth";
import { database, records } from "./db";
import type { AdminRole, TeamMember } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Viewer = {
  id: string;
  name: string;
  email: string;
  role?: AdminRole;
};
export async function viewer(headers: Headers): Promise<Viewer | null> {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  const session = await auth().api.getSession({ headers });
  if (!session || !session.user.emailVerified) return null;
  await database().query(
    "INSERT INTO commerce_record(kind,id,owner_id,data) VALUES('customers',$1,$1,$2) ON CONFLICT(kind,id) DO NOTHING",
    [
      session.user.id,
      JSON.stringify({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        phone: "",
        city: "",
        state: "",
        joinedAt: new Date().toISOString(),
        segments: [],
        notes: "",
      }),
    ],
  );
  const team = await records<TeamMember>(database(), "team");
  const member = team.find(
    (m) =>
      m.email.toLowerCase() === session.user.email.toLowerCase() &&
      m.status === "active",
  );
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: member?.role,
  };
}
export function requireUser(user: Viewer | null): asserts user is Viewer {
  if (!user)
    throw new HttpError(401, "Sign in with a verified account to continue.");
}
export function requireRole(user: Viewer | null, roles: AdminRole[]) {
  requireUser(user);
  if (!user.role || (user.role !== "Super Admin" && !roles.includes(user.role)))
    throw new HttpError(403, "Your role cannot perform this action.");
}
export function sameOrigin(request: Request) {
  const expected = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
  if (request.headers.get("origin") !== expected)
    throw new HttpError(403, "Invalid request origin.");
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 100000) throw new HttpError(413, "Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
export async function limit(key: string, max = 60, seconds = 60) {
  const hash = createHash("sha256").update(key).digest("hex");
  const result = await database().query(
    "INSERT INTO rate_bucket(key,count,expires_at) VALUES($1,1,now()+($2 * interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_bucket.expires_at < now() THEN 1 ELSE rate_bucket.count+1 END,expires_at=CASE WHEN rate_bucket.expires_at < now() THEN excluded.expires_at ELSE rate_bucket.expires_at END RETURNING count",
    [hash, seconds],
  );
  if (result.rows[0].count > max)
    throw new HttpError(429, "Too many requests. Please try again shortly.");
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return json({ error: error.issues.map((i) => i.message).join("; ") }, 400);
  console.error(
    "PAYDAN request failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return json(
    {
      error: "This service is temporarily unavailable. Please try again later.",
    },
    503,
  );
}
