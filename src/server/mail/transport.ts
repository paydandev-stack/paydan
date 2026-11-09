import "server-only";

import nodemailer from "nodemailer";

export function mailTransport() {
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM) throw new Error("Configure SMTP_HOST and MAIL_FROM.");
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000,
    socketTimeout: 20000,
  });
}

export function messageDomain() {
  try { return new URL(process.env.BETTER_AUTH_URL || "https://paydan.store").hostname; }
  catch { return "paydan.store"; }
}
