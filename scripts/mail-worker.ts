import { loadEnvConfig } from "@next/env";
import nodemailer from "nodemailer";
import { database, transaction } from "../src/server/db";
async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM)
    throw new Error("Configure SMTP_HOST and MAIL_FROM.");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    requireTLS: process.env.SMTP_PORT !== "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 20000,
  });
  let sent = 0;
  for (let i = 0; i < 50; i++) {
    const found = await transaction(async (db) => {
      const result = await db.query(
        "SELECT * FROM mail_outbox WHERE sent_at IS NULL AND attempts<8 AND next_attempt<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      );
      const mail = result.rows[0];
      if (!mail) return false;
      try {
        await transport.sendMail({
          from: process.env.MAIL_FROM,
          to: mail.recipient,
          subject: mail.subject,
          text: mail.body,
          messageId: `<${mail.id}@${new URL(process.env.BETTER_AUTH_URL!).hostname}>`,
        });
        await db.query(
          "UPDATE mail_outbox SET sent_at=now(),last_error=NULL,body='' WHERE id=$1",
          [mail.id],
        );
        sent++;
      } catch {
        await db.query(
          "UPDATE mail_outbox SET attempts=attempts+1,last_error='SMTP delivery failed',next_attempt=now()+(power(2,attempts+1)*interval '1 minute') WHERE id=$1",
          [mail.id],
        );
      }
      return true;
    });
    if (!found) break;
  }
  console.log(`Sent ${sent} queued messages.`);
  await database().end();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
