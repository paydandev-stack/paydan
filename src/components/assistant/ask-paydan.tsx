"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
import { rememberIntent } from "@/lib/intent";
import { toViewerProducts } from "@/lib/catalog-dto";
import { ProductCard } from "@/components/product-card";
import {
  CloseIcon,
  MinusIcon,
  RotateIcon,
  SparkleIcon,
} from "@/components/icons";
import { money } from "@/lib/format";
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  productIds?: string[];
  links?: { label: string; href: string }[];
  cartProposal?: { productId: string; variantId?: string; quantity: number };
  confirmed?: boolean;
  error?: boolean;
};
const key = "paydan-chat-v2";
export function AskPaydan() {
  const { state, hydrated, refresh } = useDemo();
  const owner = state.customerSession?.id ?? "guest";
  const [thread, setThread] = useState<{ owner: string; messages: Message[] }>({
    owner: "guest",
    messages: [],
  });
  const [view, setView] = useState<"closed" | "minimized" | "open">("closed");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const messages = thread.owner === owner ? thread.messages : [];
  useEffect(() => {
    if (!hydrated) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      setThread(
        (saved?.owner === owner ||
          (saved?.owner === "guest" && owner !== "guest")) &&
          Array.isArray(saved.messages)
          ? { owner, messages: saved.messages.slice(-40) }
          : { owner, messages: [] },
      );
    } catch {
      setThread({ owner, messages: [] });
    }
    setLoaded(true);
  }, [hydrated, owner]);
  useEffect(() => {
    if (loaded && thread.owner === owner)
      try {
        sessionStorage.setItem(key, JSON.stringify(thread));
      } catch {}
  }, [loaded, thread, owner]);
  useEffect(() => {
    const media = matchMedia("(max-width: 600px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (view !== "open") return;
    input.current?.focus();
    const previous = document.body.style.overflow;
    const siblings = mobile
      ? Array.from(document.body.children).filter(
          (node): node is HTMLElement =>
            node instanceof HTMLElement &&
            node !== panel.current &&
            !node.contains(panel.current),
        )
      : [];
    const priorInert = siblings.map((node) => node.inert);
    siblings.forEach((node) => (node.inert = true));
    if (mobile) document.body.style.overflow = "hidden";
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setView("closed");
        requestAnimationFrame(() => launcher.current?.focus());
      }
      if (event.key === "Tab" && mobile) {
        const elements = panel.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])",
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      siblings.forEach((node, index) => (node.inert = priorInert[index]));
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keyboard);
    };
  }, [view, mobile]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, busy, view]);
  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || busy || !hydrated) return;
    const requestOwner = owner;
    const next = [
      ...messages,
      { id: crypto.randomUUID(), role: "user" as const, text: prompt },
    ];
    setThread({ owner, messages: next });
    setDraft("");
    setBusy(true);
    try {
      const reply = await api<Omit<Message, "id" | "role">>("/api/assistant", {
        messages: next
          .filter((m) => !m.error)
          .slice(-16)
          .map((m) => ({ role: m.role, text: m.text })),
      });
      if (currentOwner.current === requestOwner)
        setThread({
          owner: requestOwner,
          messages: [
            ...next,
            { ...reply, id: crypto.randomUUID(), role: "assistant" },
          ],
        });
    } catch (error) {
      if (currentOwner.current === requestOwner)
        setThread({
          owner: requestOwner,
          messages: [
            ...next,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text:
                error instanceof Error
                  ? error.message
                  : "The assistant is unavailable. Please try again.",
              error: true,
            },
          ],
        });
    } finally {
      setBusy(false);
    }
  }
  async function confirm(message: Message) {
    const proposal = message.cartProposal;
    if (!proposal || busy) return;
    const variantId = selection[message.id] || proposal.variantId;
    if (!variantId) return;
    if (!state.customerSession) {
      rememberIntent({
        productId: proposal.productId,
        variantId,
        quantity: proposal.quantity,
        path: "/cart",
      });
      location.assign("/login");
      return;
    }
    const requestOwner = owner;
    setBusy(true);
    try {
      await api("/api/commands", {
        name: "addToCart",
        args: [proposal.productId, variantId, proposal.quantity],
        key: message.id,
      });
      await refresh();
      if (currentOwner.current === requestOwner)
        setThread((t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  confirmed: true,
                  text: `Added ${proposal.quantity} item${proposal.quantity === 1 ? "" : "s"} to your cart. Review your cart before checkout.`,
                }
              : m,
          ),
        }));
    } catch (error) {
      if (currentOwner.current === requestOwner)
        setThread((t) => ({
          ...t,
          messages: [
            ...t.messages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text:
                error instanceof Error
                  ? error.message
                  : "The cart could not be updated.",
              error: true,
            },
          ],
        }));
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }
  const count = state.cart.reduce((n, l) => n + l.quantity, 0);
  const total = state.cart.reduce(
    (n, l) =>
      n +
      (state.products
        .find((p) => p.id === l.productId)
        ?.variants.find((v) => v.id === l.variantId)?.price ?? 0) *
        l.quantity,
    0,
  );
  if (view === "closed")
    return (
      <button
        ref={launcher}
        className="ask-launcher"
        aria-haspopup="dialog"
        aria-expanded={false}
        onClick={() => setView("open")}
      >
        <SparkleIcon />
        Ask PAYDAN
      </button>
    );
  if (view === "minimized")
    return (
      <button
        ref={launcher}
        className="ask-peek"
        aria-label="Restore Ask PAYDAN"
        onClick={() => setView("open")}
      >
        <SparkleIcon />
        <span>
          <strong>Ask PAYDAN</strong>
          <em>Your conversation is here</em>
        </span>
      </button>
    );
  return (
    <section
      ref={panel}
      className={`ask-panel${expanded ? " expanded" : ""}`}
      role="dialog"
      aria-modal={mobile || undefined}
      aria-label="Ask PAYDAN assistant"
    >
      <header className="ask-head">
        <SparkleIcon />
        <div>
          <h2>
            Ask PAYDAN <span className="ask-badge">AI</span>
          </h2>
          <small>
            {state.customerSession
              ? "Your personal shopping assistant"
              : "Explore with PAYDAN"}
          </small>
        </div>
        <div className="ask-tools">
          <button
            className="ask-expand"
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Compress" : "Expand"}
          </button>
          <button
            aria-label="Minimize chat"
            onClick={() => {
              setView("minimized");
              requestAnimationFrame(() => launcher.current?.focus());
            }}
          >
            <MinusIcon />
          </button>
          <button
            disabled={busy}
            aria-label="New conversation"
            onClick={() => setThread({ owner, messages: [] })}
          >
            <RotateIcon />
          </button>
          <button
            aria-label="Close chat"
            onClick={() => {
              setView("closed");
              requestAnimationFrame(() => launcher.current?.focus());
            }}
          >
            <CloseIcon />
          </button>
        </div>
      </header>
      <div
        ref={log}
        className="ask-body"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && (
          <>
            <div className="ask-msg bot">
              <p>
                Tell me what you’re looking for.{" "}
                {state.customerSession
                  ? "Explore your member prices, compare products and add a selection to your cart."
                  : "Explore products and departments. Sign in for prices and shopping."}
              </p>
            </div>
            <div className="ask-starters">
              {[
                "Help me find a phone",
                "Explore departments",
                "How does sourcing work?",
              ].map((s) => (
                <button disabled={busy} key={s} onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((message) => {
          const product = state.products.find(
            (p) => p.id === message.cartProposal?.productId,
          );
          return (
            <div
              key={message.id}
              className={`ask-msg ${message.role === "user" ? "user" : "bot"}${message.error ? " error" : ""}`}
            >
              <p>{message.text}</p>
              {message.productIds && (
                <div className="ask-products">
                  {toViewerProducts(
                    state.products.filter((p) =>
                      message.productIds!.includes(p.id),
                    ),
                    { pricesVisible: !!state.customerSession },
                  ).map((p) => (
                    <ProductCard key={p.id} product={p} showPrice />
                  ))}
                </div>
              )}
              {product && message.cartProposal && !message.confirmed && (
                <div className="ask-confirm">
                  <strong>
                    {product.name} × {message.cartProposal.quantity}
                  </strong>
                  <label>
                    Choose your option
                    <select
                      aria-label="Product variant"
                      value={
                        selection[message.id] ||
                        message.cartProposal.variantId ||
                        ""
                      }
                      onChange={(e) =>
                        setSelection({
                          ...selection,
                          [message.id]: e.target.value,
                        })
                      }
                    >
                      <option value="">Select an option</option>
                      {product.variants.map((v) => (
                        <option
                          disabled={v.availability === "out_of_stock"}
                          key={v.id}
                          value={v.id}
                        >
                          {v.label}
                          {state.customerSession ? ` · ${money(v.price)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={
                      busy ||
                      !(selection[message.id] || message.cartProposal.variantId)
                    }
                    onClick={() => void confirm(message)}
                  >
                    {state.customerSession
                      ? "Confirm add to cart"
                      : "Sign in to add this selection"}
                  </button>
                </div>
              )}
              {message.links && (
                <div className="ask-links">
                  {message.links
                    .filter(
                      (l) => l.href.startsWith("/") && !l.href.startsWith("//"),
                    )
                    .map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setView("minimized")}
                      >
                        {l.label}
                      </Link>
                    ))}
                </div>
              )}
            </div>
          );
        })}
        {busy && (
          <div className="ask-msg bot" role="status">
            <p>Working on that…</p>
          </div>
        )}
      </div>
      {state.customerSession && count > 0 && (
        <div className="ask-cart">
          <span>
            {count} items · <strong>{money(total)}</strong>
          </span>
          <Link href="/cart" onClick={() => setView("minimized")}>
            Review cart
          </Link>
        </div>
      )}
      <p className="ask-disclosure">
        AI can make mistakes. Review selections and checkout totals. Never share
        passwords or card details.
      </p>
      <form className="ask-composer" onSubmit={submit}>
        <input
          ref={input}
          value={draft}
          maxLength={3000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about products, delivery, orders…"
          aria-label="Message Ask PAYDAN"
        />
        <button disabled={busy || !draft.trim() || !hydrated}>Send</button>
      </form>
    </section>
  );
}
