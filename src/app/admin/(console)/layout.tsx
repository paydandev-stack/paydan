"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccessAdmin } from "@/lib/admin-access";
import type { ReactNode } from "react";
import { useDemo } from "@/lib/store";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/sidebar";

/**
 * Operations shell: sidebar + content column (`.admin-page`). The console is
 * gated in place rather than redirected so the static prerender stays honest —
 * the same approach the customer account shell uses.
 */
export default function AdminConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { state, hydrated, actions } = useDemo();
  const session = state.adminSession;
  const pathname = usePathname();

  if (!hydrated) {
    return (
      <div className="admin-page" aria-busy="true">
        <aside className="admin-sidebar" aria-hidden="true" />
        <div className="admin-content" id="main-content">
          <p style={{ color: "var(--muted)", fontSize: ".7rem" }}>
            Opening the operations console…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminSidebar />
      <div className="admin-content" id="main-content">
        <AdminMobileNav />
        {session ? (
          canAccessAdmin(session.role, pathname) ? (
            children
          ) : (
            <div className="admin-gate">
              <h1>Access restricted</h1>
              <p>Your role does not have access to this section.</p>
              <Link href="/admin">Back to operations</Link>
            </div>
          )
        ) : (
          <div className="admin-gate">
            <span>PAYDAN OPERATIONS</span>
            <h2>Operations console</h2>
            <p>
              Sign in with a verified account that has been granted operations
              access.
            </p>
            <div className="admin-actions">
              <Link className="admin-btn" href="/admin/login">
                Sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
