"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

type SupportThread = {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    authorType: "customer" | "staff";
    body: string;
    createdAt: string;
  }>;
};

export default function Contact() {
  const { state } = useDemo();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (state.customerSession)
      setThreads(await api<SupportThread[]>("/api/support"));
  }, [state.customerSession]);
  useEffect(() => {
    void load().catch((error) => setResult((error as Error).message));
  }, [load]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api<{ reference: string }>("/api/support", {
        subject,
        message,
      });
      setResult(`Message received. Your reference is ${response.reference}.`);
      setSubject("");
      setMessage("");
      await load();
    } catch (error) {
      setResult((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendReply(threadId: string) {
    const value = reply[threadId]?.trim();
    if (!value) return;
    setBusy(true);
    try {
      await api("/api/support", { threadId, message: value });
      setReply((current) => ({ ...current, [threadId]: "" }));
      await load();
    } catch (error) {
      setResult((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap info-page">
      <header className="info-hero">
        <span className="kicker green">CUSTOMER CARE</span>
        <h1>Talk to the team behind the store.</h1>
        <p>
          Questions about an order, delivery or a product? We’re here to help.
        </p>
      </header>
      <div className="contact-grid">
        <article>
          <h2>Contact {state.settings.storeName}</h2>
          {state.settings.supportEmail ? (
            <p>
              <a href={`mailto:${state.settings.supportEmail}`}>
                {state.settings.supportEmail}
              </a>
            </p>
          ) : null}
          {state.settings.supportPhone ? (
            <p>
              <a href={`tel:${state.settings.supportPhone}`}>
                {state.settings.supportPhone}
              </a>
            </p>
          ) : null}
          <p>{state.settings.businessHours}</p>
          <Link href="/request-product">
            Looking for a product? Send a sourcing request →
          </Link>
        </article>
        <article>
          <h2>Start a conversation</h2>
          {state.customerSession ? (
            <form className="operations-form" onSubmit={submit}>
              <label>
                Subject
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label>
                Message
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Sending…" : "Send message"}
              </button>
              <p role="status">{result}</p>
            </form>
          ) : (
            <p>
              <Link href="/login?next=%2Fcontact">Sign in</Link> to send a
              message linked to your account.
            </p>
          )}
        </article>
      </div>
      {state.customerSession ? (
        <section style={{ marginTop: "2rem" }}>
          <h2>Your conversations</h2>
          <div className="operations-list">
            {threads.map((thread) => (
              <article key={thread.id}>
                <h3>{thread.subject}</h3>
                <p>
                  {thread.status.replaceAll("_", " ")} · Updated{" "}
                  {formatDateTime(thread.updatedAt)}
                </p>
                {thread.messages.map((entry) => (
                  <div className="account-group" key={entry.id}>
                    <div>
                      <strong>
                        {entry.authorType === "staff"
                          ? "PAYDAN support"
                          : "You"}
                      </strong>
                      <small>{entry.body}</small>
                    </div>
                    <small>{formatDateTime(entry.createdAt)}</small>
                  </div>
                ))}
                {thread.status !== "resolved" ? (
                  <div className="operations-form">
                    <label>
                      Reply
                      <textarea
                        value={reply[thread.id] ?? ""}
                        onChange={(event) =>
                          setReply((current) => ({
                            ...current,
                            [thread.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      disabled={busy || !reply[thread.id]?.trim()}
                      onClick={() => void sendReply(thread.id)}
                    >
                      Send reply
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
