import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { database, transaction, put } from "../src/server/db";

type SeedUser = { name: string; email: string; password: string; admin?: boolean };

async function ensureUser(user: SeedUser) {
  if (!user.email || !user.email.includes("@")) throw new Error("Invalid seed email.");
  if (!user.password || user.password.length < 12)
    throw new Error("Seed password must be at least 12 characters.");
  const now = new Date();
  const email = user.email.trim().toLowerCase();
  const passwordHash = await hashPassword(user.password);
  const result = await transaction(async (db) => {
    // Better Auth default model/table names are "user" and "account" (lowercase, quoted for case safety).
    const existing = await db.query(
      'SELECT id FROM "user" WHERE lower(email) = $1 LIMIT 1',
      [email],
    );
    let userId = existing.rows[0]?.id as string | undefined;
    if (!userId) {
      userId = randomUUID();
      await db.query(
        'INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6)',
        [userId, user.name.trim() || email, email, true, now, now],
      );
    } else {
      await db.query(
        'UPDATE "user" SET name=$2, "emailVerified"=true, "updatedAt"=$3 WHERE id=$1',
        [userId, user.name.trim() || email, now],
      );
    }

    const account = await db.query(
      'SELECT id FROM "account" WHERE "userId"=$1 AND "providerId"=$2 LIMIT 1',
      [userId, "credential"],
    );
    if (account.rows[0]?.id) {
      await db.query(
        'UPDATE "account" SET "accountId"=$2, password=$3, "updatedAt"=$4 WHERE id=$1',
        [account.rows[0].id, userId, passwordHash, now],
      );
    } else {
      await db.query(
        'INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), userId, "credential", userId, passwordHash, now, now],
      );
    }

    await put(
      db,
      "customers",
      userId,
      {
        id: userId,
        name: user.name.trim() || email,
        email,
        phone: "",
        city: "Lagos",
        state: "Lagos",
        joinedAt: now.toISOString(),
        segments: [user.admin ? "Internal" : "Test"],
        notes: "Seeded local test account.",
      },
      userId,
    );

    if (user.admin) {
      const team = await db.query(
        "SELECT id FROM commerce_record WHERE kind='team' AND lower(data->>'email')=$1",
        [email],
      );
      const teamId = (team.rows[0]?.id as string) || randomUUID();
      await put(db, "team", teamId, {
        id: teamId,
        name: user.name.trim() || email,
        email,
        role: "Super Admin",
        status: "active",
        lastActive: "",
      });
    }
    return { userId, email };
  });

  console.log(
    `${user.admin ? "Admin" : "Buyer"} user ready: ${result.email} (id=${result.userId})`,
  );
}

async function main() {
  loadEnvConfig(process.cwd());
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_SEED !== "true") {
    throw new Error(
      "Refusing to seed users in production. Set ALLOW_LOCAL_SEED=true only for controlled local/test environments.",
    );
  }

  const users: SeedUser[] = [
    {
      name: process.env.SEED_BUYER_NAME || "Test Buyer",
      email: process.env.SEED_BUYER_EMAIL || "buyer@paydan.local",
      password: process.env.SEED_BUYER_PASSWORD || "PaydanBuyer123!",
    },
    {
      name: process.env.SEED_ADMIN_NAME || "Test Admin",
      email: process.env.SEED_ADMIN_EMAIL || "admin@paydan.local",
      password: process.env.SEED_ADMIN_PASSWORD || "PaydanAdmin123!",
      admin: true,
    },
  ];

  for (const user of users) await ensureUser(user);
  console.log("Local test users are ready. Sign in at /login (email+password).");
  await database().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
