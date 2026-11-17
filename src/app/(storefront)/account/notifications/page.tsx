"use client";

import Link from "next/link";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
import { formatDateTime } from "@/lib/format";

export default function NotificationsPage() {
  const { state, refresh } = useDemo();
  async function mark(id?: string) {
    await api("/api/notifications", id ? { id } : { all: true });
    await refresh();
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="kicker green">YOUR PAYDAN</span>
          <h1>Updates</h1>
        </div>
        {state.notifications.some((notification) => !notification.readAt) ? (
          <button type="button" onClick={() => void mark()}>
            Mark all read
          </button>
        ) : null}
      </div>
      <div className="account-items">
        {state.notifications.map((notification) => (
          <article className="account-group" key={notification.id}>
            <div>
              <strong>{notification.title}</strong>
              <small>{notification.body}</small>
              <small>{formatDateTime(notification.createdAt)}</small>
            </div>
            <div className="account-actions">
              <Link
                href={notification.href}
                onClick={() => void mark(notification.id)}
              >
                Open
              </Link>
              {!notification.readAt ? (
                <button
                  type="button"
                  onClick={() => void mark(notification.id)}
                >
                  Mark read
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {state.notifications.length === 0 ? <p>No updates yet.</p> : null}
      </div>
    </>
  );
}
