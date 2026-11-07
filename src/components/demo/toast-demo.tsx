"use client";

import { useDemo } from "@/lib/store";

/** Live specimen: fires a real toast through the shared demo store. */
export function ToastDemo() {
  const { actions } = useDemo();

  return (
    <div className="ds-row">
      <button
        type="button"
        className="admin-btn"
        onClick={() =>
          actions.notify("Saved — toasts stack bottom-right.", "success")
        }
      >
        Show a success toast
      </button>
      <button
        type="button"
        className="admin-btn quiet"
        onClick={() =>
          actions.notify("Something needs a second look.", "error")
        }
      >
        Show an error toast
      </button>
      <button
        type="button"
        className="admin-btn ghost"
        onClick={() =>
          actions.notify("Item saved for later.", "info", {
            actionLabel: "View cart",
            actionHref: "/cart",
          })
        }
      >
        Show a toast with a link
      </button>
    </div>
  );
}
