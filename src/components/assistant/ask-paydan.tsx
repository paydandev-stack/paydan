"use client";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api-client";
import { rememberIntent } from "@/lib/intent";
import { toViewerProducts } from "@/lib/catalog-dto";
import { ProductCard } from "@/components/product-card";
import { AssistantRichText } from "@/components/assistant/assistant-rich-text";
import {
  AssistantCartResult,
  type AssistantCartLine,
} from "@/components/assistant/assistant-cart-result";
import {
  CloseIcon,
  MinusIcon,
  RotateIcon,
  SparkleIcon,
} from "@/components/icons";
import { money } from "@/lib/format";
import {
  clampLauncherPosition,
  launcherAnchorToPosition,
  launcherPositionToAnchor,
  type LauncherAnchor,
  type LauncherPosition,
} from "@/lib/launcher-position";
type CartProposalAction =
  | "add_to_cart"
  | "remove_cart_line"
  | "remove_cart_lines"
  | "set_cart_quantity"
  | "clear_cart";
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  productIds?: string[];
  cartLines?: AssistantCartLine[];
  links?: { label: string; href: string }[];
  cartProposal?: {
    proposalId: string;
    action: CartProposalAction;
    summary: Record<string, unknown>;
  };
  proposalStatus?:
    "pending" | "confirming" | "confirmed" | "cancelled" | "failed";
  error?: boolean;
};
// Proposal payloads changed in v3 (remove, quantity and clear actions). Do not
// revive incompatible add-only proposal state from an older browser session.
const key = "paydan-chat-v3";
const launcherAnchorKey = "paydan-assistant-launcher-anchor-v2";
const legacyLauncherPositionKey = "paydan-assistant-launcher-position-v1";
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
  const [loaded, setLoaded] = useState(false);
  const [launcherPosition, setLauncherPosition] =
    useState<LauncherPosition | null>(null);
  const [draggingLauncher, setDraggingLauncher] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const currentOwner = useRef(owner);
  const launcherPositionRef = useRef<LauncherPosition | null>(null);
  const launcherAnchorRef = useRef<LauncherAnchor | null>(null);
  const launcherDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const suppressLauncherClick = useRef(false);
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
    const element = launcher.current;
    if (!element) return;
    const viewport = () => ({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    try {
      const savedAnchor = JSON.parse(
        localStorage.getItem(launcherAnchorKey) || "null",
      ) as Partial<LauncherAnchor> | null;
      let anchor: LauncherAnchor | null = null;
      if (Number.isFinite(savedAnchor?.x) && Number.isFinite(savedAnchor?.y)) {
        anchor = { x: Number(savedAnchor?.x), y: Number(savedAnchor?.y) };
      } else {
        const legacy = JSON.parse(
          localStorage.getItem(legacyLauncherPositionKey) || "null",
        ) as Partial<LauncherPosition> | null;
        if (Number.isFinite(legacy?.left) && Number.isFinite(legacy?.top)) {
          anchor = launcherPositionToAnchor(
            { left: Number(legacy?.left), top: Number(legacy?.top) },
            element.getBoundingClientRect(),
            viewport(),
          );
          localStorage.setItem(launcherAnchorKey, JSON.stringify(anchor));
          localStorage.removeItem(legacyLauncherPositionKey);
        }
      }
      if (anchor) {
        launcherAnchorRef.current = anchor;
        const position = launcherAnchorToPosition(
          anchor,
          element.getBoundingClientRect(),
          viewport(),
        );
        launcherPositionRef.current = position;
        setLauncherPosition(position);
      }
    } catch {}
    const restoreRelativePosition = () => {
      const current = launcher.current;
      const anchor = launcherAnchorRef.current;
      if (!current || !anchor) return;
      const position = launcherAnchorToPosition(
        anchor,
        current.getBoundingClientRect(),
        viewport(),
      );
      launcherPositionRef.current = position;
      setLauncherPosition(position);
    };
    const observer = new ResizeObserver(restoreRelativePosition);
    observer.observe(element);
    window.addEventListener("resize", restoreRelativePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", restoreRelativePosition);
    };
  }, [view]);
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
    const open = () => setView("open");
    window.addEventListener("paydan:open-assistant", open);
    return () => window.removeEventListener("paydan:open-assistant", open);
  }, []);
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
    const assistantId = crypto.randomUUID();
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next
            .filter((m) => !m.error)
            .slice(-16)
            .map((m) => ({ role: m.role, text: m.text })),
          page: { path: location.pathname, title: document.title },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.message ||
            payload.error ||
            "The assistant is unavailable. Please try again.",
        );
      }
      if (!response.body)
        throw new Error("The assistant returned no response.");
      let reply: Message = { id: assistantId, role: "assistant", text: "" };
      const publish = () => {
        if (currentOwner.current === requestOwner)
          setThread({ owner: requestOwner, messages: [...next, { ...reply }] });
      };
      publish();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            text?: string;
            message?: string;
            data?: Record<string, unknown>;
          };
          if (event.type === "text-delta") reply.text += event.text || "";
          if (event.type === "reply" && event.data)
            reply = { ...reply, ...event.data } as Message;
          if (event.type === "error")
            throw new Error(
              event.message || "The assistant connection ended early.",
            );
          if (event.type === "tool-result" && event.data) {
            const data = event.data as Record<string, unknown>;
            const products = Array.isArray(data.products)
              ? data.products
              : data.product
                ? [data.product]
                : [];
            const ids = products
              .map((product) => String((product as { id?: string }).id || ""))
              .filter(Boolean);
            if (ids.length)
              reply.productIds = [
                ...new Set([...(reply.productIds || []), ...ids]),
              ].slice(0, 6);
            if (data.kind === "cart-proposal")
              reply.cartProposal = {
                proposalId: String(data.proposalId),
                action: data.action as CartProposalAction,
                summary: (data.summary || {}) as Record<string, unknown>,
              };
            if (data.kind === "cart" && Array.isArray(data.lines))
              reply.cartLines = data.lines
                .map((line) => line as Partial<AssistantCartLine>)
                .filter(
                  (line): line is AssistantCartLine =>
                    typeof line.productId === "string" &&
                    typeof line.variantId === "string" &&
                    typeof line.productName === "string" &&
                    typeof line.quantity === "number",
                );
            if (Array.isArray(data.links))
              reply.links = data.links as Message["links"];
            if (data.kind === "auth-required" && typeof data.href === "string")
              reply.links = [{ label: "Sign in to continue", href: data.href }];
          }
          publish();
        }
        if (done) break;
      }
      if (!reply.text.trim())
        reply.text = reply.productIds?.length
          ? "Here are the closest matches I found."
          : "I’ve prepared the next step for you.";
      publish();
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
    if (!state.customerSession) {
      rememberIntent({ path: "/cart" });
      location.assign("/login");
      return;
    }
    const requestOwner = owner;
    setBusy(true);
    setThread((t) => ({
      ...t,
      messages: t.messages.map((m) =>
        m.id === message.id ? { ...m, proposalStatus: "confirming" } : m,
      ),
    }));
    try {
      await api("/api/assistant/proposals/confirm", {
        proposalId: proposal.proposalId,
      });
      await refresh();
      if (currentOwner.current === requestOwner)
        setThread((t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  proposalStatus: "confirmed",
                  text: "Cart change confirmed. Review your cart before checkout.",
                }
              : m,
          ),
        }));
    } catch (error) {
      if (currentOwner.current === requestOwner)
        setThread((t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  proposalStatus: "failed",
                  text:
                    error instanceof Error
                      ? error.message
                      : "The cart could not be updated.",
                  error: true,
                }
              : m,
          ),
        }));
    } finally {
      setBusy(false);
    }
  }
  async function prepareRemoval(lines: AssistantCartLine[]) {
    if (!lines.length || busy) return;
    if (!state.customerSession) {
      rememberIntent({ path: "/cart" });
      location.assign("/login");
      return;
    }
    setBusy(true);
    try {
      const input =
        lines.length === 1
          ? {
              action: "remove_cart_line" as const,
              productId: lines[0].productId,
              variantId: lines[0].variantId,
            }
          : {
              action: "remove_cart_lines" as const,
              lines: lines.map(({ productId, variantId }) => ({
                productId,
                variantId,
              })),
            };
      const proposal = await api<{
        proposalId: string;
        action: CartProposalAction;
        summary: Record<string, unknown>;
      }>("/api/assistant/proposals", input);
      setThread((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text:
              lines.length === 1
                ? "I’ve prepared this item for removal. Confirm below before the cart changes."
                : `I’ve prepared ${lines.length} cart lines for removal. Confirm below before the cart changes.`,
            cartProposal: proposal,
            proposalStatus: "pending",
          },
        ],
      }));
    } catch (error) {
      setThread((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text:
              error instanceof Error
                ? error.message
                : "I couldn’t prepare that cart change.",
            error: true,
          },
        ],
      }));
    } finally {
      setBusy(false);
    }
  }
  async function cancelProposal(message: Message) {
    if (!message.cartProposal || busy) return;
    setBusy(true);
    try {
      await api("/api/assistant/proposals/cancel", {
        proposalId: message.cartProposal.proposalId,
      });
      setThread((t) => ({
        ...t,
        messages: t.messages.map((m) =>
          m.id === message.id
            ? {
                ...m,
                proposalStatus: "cancelled",
                text: "Cart change cancelled.",
              }
            : m,
        ),
      }));
    } catch (error) {
      setThread((t) => ({
        ...t,
        messages: t.messages.map((m) =>
          m.id === message.id
            ? {
                ...m,
                proposalStatus: "failed",
                text:
                  error instanceof Error
                    ? error.message
                    : "The proposal could not be cancelled.",
                error: true,
              }
            : m,
        ),
      }));
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }
  function moveLauncher(position: LauncherPosition, persist = false) {
    const element = launcher.current;
    if (!element) return;
    const bounded = clampLauncherPosition(
      position,
      element.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
    );
    launcherPositionRef.current = bounded;
    setLauncherPosition(bounded);
    if (persist)
      try {
        const anchor = launcherPositionToAnchor(
          bounded,
          element.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
        );
        launcherAnchorRef.current = anchor;
        localStorage.setItem(launcherAnchorKey, JSON.stringify(anchor));
        localStorage.removeItem(legacyLauncherPositionKey);
      } catch {}
  }
  function beginLauncherDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || mobile) return;
    const rect = event.currentTarget.getBoundingClientRect();
    launcherDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function dragLauncher(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = launcherDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6
    )
      return;
    event.preventDefault();
    drag.moved = true;
    suppressLauncherClick.current = true;
    setDraggingLauncher(true);
    moveLauncher({
      left: event.clientX - drag.offsetX,
      top: event.clientY - drag.offsetY,
    });
  }
  function endLauncherDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = launcherDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved && launcherPositionRef.current)
      moveLauncher(launcherPositionRef.current, true);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    launcherDrag.current = null;
    setDraggingLauncher(false);
  }
  function moveLauncherWithKeyboard(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    if (!event.altKey || !event.key.startsWith("Arrow") || mobile) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const current = launcherPositionRef.current || {
      left: rect.left,
      top: rect.top,
    };
    const amount = event.shiftKey ? 32 : 12;
    moveLauncher(
      {
        left:
          current.left +
          (event.key === "ArrowLeft"
            ? -amount
            : event.key === "ArrowRight"
              ? amount
              : 0),
        top:
          current.top +
          (event.key === "ArrowUp"
            ? -amount
            : event.key === "ArrowDown"
              ? amount
              : 0),
      },
      true,
    );
  }
  function openFromLauncher(event: React.MouseEvent<HTMLButtonElement>) {
    if (suppressLauncherClick.current) {
      event.preventDefault();
      suppressLauncherClick.current = false;
      return;
    }
    setView("open");
  }
  const launcherStyle: CSSProperties | undefined = launcherPosition
    ? {
        left: launcherPosition.left,
        top: launcherPosition.top,
        right: "auto",
        bottom: "auto",
      }
    : undefined;
  const launcherClass = (base: string) =>
    `${base}${draggingLauncher ? " is-dragging" : ""}`;
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
        className={launcherClass("ask-launcher")}
        style={launcherStyle}
        aria-haspopup="dialog"
        aria-expanded={false}
        aria-label="Ask PAYDAN. Drag to move, press Enter to open, or use Alt plus an arrow key to reposition."
        title="Drag to move Ask PAYDAN"
        onPointerDown={beginLauncherDrag}
        onPointerMove={dragLauncher}
        onPointerUp={endLauncherDrag}
        onPointerCancel={endLauncherDrag}
        onKeyDown={moveLauncherWithKeyboard}
        onClick={openFromLauncher}
      >
        <SparkleIcon />
        Ask PAYDAN
      </button>
    );
  if (view === "minimized")
    return (
      <button
        ref={launcher}
        className={launcherClass("ask-peek")}
        style={launcherStyle}
        aria-label="Restore Ask PAYDAN. Drag to move or use Alt plus an arrow key to reposition."
        title="Drag to move Ask PAYDAN"
        onPointerDown={beginLauncherDrag}
        onPointerMove={dragLauncher}
        onPointerUp={endLauncherDrag}
        onPointerCancel={endLauncherDrag}
        onKeyDown={moveLauncherWithKeyboard}
        onClick={openFromLauncher}
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
          const proposal = message.cartProposal;
          const summary = proposal?.summary || {};
          const proposalTitle = proposal
            ? {
                add_to_cart: "Add to cart",
                remove_cart_line: "Remove cart item",
                remove_cart_lines: "Remove selected cart items",
                set_cart_quantity: "Change cart quantity",
                clear_cart: "Clear cart",
              }[proposal.action]
            : "";
          return (
            <div
              key={message.id}
              className={`ask-msg ${message.role === "user" ? "user" : "bot"}${message.error ? " error" : ""}`}
            >
              <AssistantRichText
                text={message.text}
                suppressTables={Boolean(
                  message.cartLines?.length || message.productIds?.length,
                )}
              />
              {message.cartLines?.length ? (
                <AssistantCartResult
                  lines={message.cartLines}
                  busy={busy}
                  onPrepareRemoval={prepareRemoval}
                />
              ) : null}
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
              {proposal && (
                <div className="ask-confirm">
                  <span className="ask-confirm-label">
                    Requires confirmation
                  </span>
                  <strong>{proposalTitle}</strong>
                  {typeof summary.productName === "string" ? (
                    <span>{summary.productName}</span>
                  ) : null}
                  {typeof summary.variantLabel === "string" &&
                  summary.variantLabel ? (
                    <small>{summary.variantLabel}</small>
                  ) : null}
                  {proposal.action === "add_to_cart" ? (
                    <small>Quantity: {String(summary.quantity || 1)}</small>
                  ) : null}
                  {proposal.action === "set_cart_quantity" ? (
                    <small>
                      Quantity: {String(summary.oldQuantity)} →{" "}
                      {String(summary.newQuantity)}
                    </small>
                  ) : null}
                  {proposal.action === "clear_cart" ||
                  proposal.action === "remove_cart_lines" ? (
                    <small>
                      {String(summary.lineCount || 0)} cart lines ·{" "}
                      {String(summary.itemCount || 0)} items
                    </small>
                  ) : null}
                  {message.proposalStatus === "confirmed" ||
                  message.proposalStatus === "cancelled" ? (
                    <span
                      className={`ask-proposal-state ${message.proposalStatus}`}
                    >
                      {message.proposalStatus === "confirmed"
                        ? "Confirmed"
                        : "Cancelled"}
                    </span>
                  ) : (
                    <div className="ask-confirm-actions">
                      <button
                        disabled={
                          busy || message.proposalStatus === "confirming"
                        }
                        onClick={() => void confirm(message)}
                      >
                        {message.proposalStatus === "confirming"
                          ? "Confirming…"
                          : state.customerSession
                            ? "Confirm change"
                            : "Sign in to continue"}
                      </button>
                      <button
                        className="quiet"
                        disabled={
                          busy || message.proposalStatus === "confirming"
                        }
                        onClick={() => void cancelProposal(message)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
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
