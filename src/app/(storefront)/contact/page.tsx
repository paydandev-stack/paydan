"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
export default function Contact() {
  const { state } = useDemo();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const reply = await api<{ reference: string }>("/api/support", {
        subject,
        message,
      });
      setResult(`Message received. Your reference is ${reply.reference}.`);
      setMessage("");
    } catch (e) {
      setResult((e as Error).message);
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
          <h2>Contact PAYDAN</h2>
          {state.settings.supportEmail && (
            <p>
              <a href={`mailto:${state.settings.supportEmail}`}>
                {state.settings.supportEmail}
              </a>
            </p>
          )}
          {state.settings.supportPhone && (
            <p>
              <a href={`tel:${state.settings.supportPhone}`}>
                {state.settings.supportPhone}
              </a>
            </p>
          )}
          <p>{state.settings.businessHours}</p>
          <Link href="/request-product">
            Looking for a product? Send a sourcing request →
          </Link>
        </article>
        <article>
          <h2>Send a message</h2>
          {state.customerSession ? (
            <form className="operations-form" onSubmit={submit}>
              <label>
                Subject
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>
              <label>
                Message
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
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
    </div>
  );
}
