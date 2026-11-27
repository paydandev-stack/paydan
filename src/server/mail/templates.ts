import "server-only";

export type MailTemplateKey =
  | "auth.verify"
  | "auth.reset"
  | "team.invite"
  | "vendor.invite"
  | "payment.received"
  | "order.status"
  | "sourcing.received"
  | "sourcing.quote"
  | "sourcing.supply_ready"
  | "return.received"
  | "return.status"
  | "refund.processed"
  | "support.received"
  | "support.reply"
  | "operations.alert";

export type TemplateData = Record<string, string | number | boolean | null>;
export type TemplateOverrides = {
  orderSubject?: string;
  supportSubject?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function siteUrl(path = ""): string {
  const base = process.env.BETTER_AUTH_URL || "https://paydan.store";
  return new URL(path, `${base.replace(/\/+$/, "")}/`).toString();
}

function content(key: MailTemplateKey, data: TemplateData) {
  const reference = String(data.reference ?? "");
  const status = String(data.status ?? "").replaceAll("_", " ");
  switch (key) {
    case "auth.verify":
      return {
        subject: "Verify your PAYDAN email",
        heading: "Verify your email",
        message: `${data.name ? `Hello ${data.name}. ` : ""}You received this because a PAYDAN account was created with this email address. Confirm it to finish setting up your account. This link is time-limited. PAYDAN will never ask for your password by email. If you did not create the account, you can safely ignore this message.`,
        cta: "Verify email",
        href: String(data.url),
      };
    case "auth.reset":
      return {
        subject: "Reset your PAYDAN password",
        heading: "Reset your password",
        message: `${data.name ? `Hello ${data.name}. ` : ""}A password reset was requested for your PAYDAN account. Use the time-limited secure link below to choose a new password. PAYDAN will never ask for your password by email. If you did not request this, ignore this message and your password will remain unchanged.`,
        cta: "Reset password",
        href: String(data.url),
      };
    case "team.invite":
      return {
        subject: "You have been invited to PAYDAN operations",
        heading: "Operations invitation",
        message:
          "Create and verify your PAYDAN account with this invited email. Your assigned operations access activates after verification.",
        cta: "Create account",
        href: String(data.url || siteUrl("/register")),
      };
    case "vendor.invite":
      return {
        subject: "Your PAYDAN vendor portal access is ready",
        heading: "Vendor portal invitation",
        message: String(
          data.message ||
            "PAYDAN has prepared vendor access for your business. Open this secure link, create your password, verify your email, then sign in to the vendor portal.",
        ),
        cta: "Open vendor portal",
        href: String(data.url || siteUrl("/vendor/login")),
      };
    case "payment.received":
      return {
        subject: `PAYDAN payment received — ${reference}`,
        heading: "Payment confirmed",
        message: `We received ${data.amount}. Your order ${reference} is now being processed.`,
        cta: "View order",
        href: siteUrl(`/account/orders/${data.orderId}`),
      };
    case "order.status":
      return {
        subject: `PAYDAN order ${reference} updated`,
        heading: "Order update",
        message: `Your order ${reference} is now ${status}.`,
        cta: "View order",
        href: siteUrl(`/account/orders/${data.orderId}`),
      };
    case "sourcing.received":
      return {
        subject: `PAYDAN sourcing request received — ${reference}`,
        heading: "Request received",
        message: `Your sourcing request ${reference} is being reviewed by the PAYDAN team.`,
        cta: "View request",
        href: siteUrl(`/account/sourcing-requests/${data.requestId}`),
      };
    case "sourcing.quote":
      return {
        subject: `Your PAYDAN quotation is ready — ${reference}`,
        heading: "Your quotation is ready",
        message: `Review request ${reference} before ${data.validUntil}. Nothing is ordered until you accept the quote and complete payment.`,
        cta: "Review quotation",
        href: siteUrl(`/account/sourcing-requests/${data.requestId}`),
      };
    case "sourcing.supply_ready":
      return {
        subject: `Your sourced order is ready for payment — ${reference}`,
        heading: "Supplier availability confirmed",
        message: `Supplier availability is confirmed for ${reference}. Review delivery details and payment in your account.`,
        cta: "Review order",
        href: siteUrl(`/account/orders/${data.orderId}`),
      };
    case "return.received":
      return {
        subject: `PAYDAN return request received — ${reference}`,
        heading: "Return request received",
        message: `We received return request ${reference}. The team will review it before any refund is initiated.`,
        cta: "View returns",
        href: siteUrl("/account/returns"),
      };
    case "return.status":
      return {
        subject: `PAYDAN return ${reference} updated`,
        heading: "Return update",
        message: `Your return request ${reference} is now ${status}.`,
        cta: "View returns",
        href: siteUrl("/account/returns"),
      };
    case "refund.processed":
      return {
        subject: `PAYDAN refund processed — ${reference}`,
        heading: "Refund processed",
        message: `Paystack has confirmed the refund for order ${reference}. Your bank may take additional time to display the credit.`,
        cta: "View order",
        href: siteUrl(`/account/orders/${data.orderId}`),
      };
    case "support.received":
      return {
        subject: `PAYDAN support request ${reference}`,
        heading: "We received your message",
        message: "Our team will reply to your verified email address.",
        cta: "Open help centre",
        href: siteUrl("/help"),
      };
    case "support.reply":
      return {
        subject: `PAYDAN: ${data.subject}`,
        heading: "A reply from PAYDAN support",
        message: String(data.reply),
        cta: "Contact support",
        href: siteUrl("/contact"),
      };
    case "operations.alert":
      return {
        subject: `PAYDAN operations: ${data.title}`,
        heading: String(data.title),
        message: String(data.message),
        cta: "Open operations",
        href: siteUrl(String(data.href || "/admin")),
      };
  }
}

export function renderMail(
  key: MailTemplateKey,
  data: TemplateData,
  overrides: TemplateOverrides = {},
) {
  const value = content(key, data);
  const configuredSubject =
    key === "order.status" && overrides.orderSubject
      ? overrides.orderSubject.replaceAll(
          "{{reference}}",
          String(data.reference ?? ""),
        )
      : key === "support.reply" && overrides.supportSubject
        ? overrides.supportSubject.replaceAll(
            "{{subject}}",
            String(data.subject ?? ""),
          )
        : value.subject;
  const subject = configuredSubject.slice(0, 240);
  const showVisibleUrl = key === "auth.verify" || key === "auth.reset";
  const text = `${value.heading}\n\n${value.message}\n\n${value.cta}: ${value.href}${showVisibleUrl ? `\n\nIf the button does not work, copy this address into your browser:\n${value.href}` : ""}\n\nPAYDAN — One place. More possibilities.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f4;color:#10251a;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #dbe4dd;border-radius:14px;overflow:hidden"><tr><td style="padding:24px 30px;background:#073b25;color:#fff;font-weight:800;letter-spacing:.08em">PAYDAN</td></tr><tr><td style="padding:34px 30px"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;font-weight:500">${escapeHtml(value.heading)}</h1><p style="margin:0 0 26px;line-height:1.65;color:#42564a">${escapeHtml(value.message)}</p><a href="${escapeHtml(value.href)}" style="display:inline-block;padding:13px 20px;background:#009b4d;color:#fff;text-decoration:none;border-radius:7px;font-weight:700">${escapeHtml(value.cta)}</a>${showVisibleUrl ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6b7c70">If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${escapeHtml(value.href)}</span></p>` : ""}</td></tr><tr><td style="padding:18px 30px;border-top:1px solid #e1e8e3;color:#6b7c70;font-size:12px">PAYDAN · One place. More possibilities.</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
