"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useDemo } from "@/lib/store";
import { CloseIcon } from "./icons";

const DISMISS_AFTER_MS = 5000;

/**
 * Floating confirmations for cart, wishlist and demo actions.
 * Kept in the root layout so storefront and admin share one queue.
 */
export function ToastViewport() {
  const { state, actions } = useDemo();
  const { toasts } = state;

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => actions.dismissToast(toast.id), DISMISS_AFTER_MS),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, actions]);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} key={toast.id}>
          <span>{toast.message}</span>
          {toast.action === "undo-remove" ? (
            <button
              type="button"
              className="toast-action"
              onClick={actions.undoRemove}
            >
              {toast.actionLabel ?? "Undo"}
            </button>
          ) : toast.actionHref ? (
            <Link className="toast-action" href={toast.actionHref}>
              {toast.actionLabel ?? "View"}
            </Link>
          ) : null}
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Dismiss notification"
            onClick={() => actions.dismissToast(toast.id)}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
