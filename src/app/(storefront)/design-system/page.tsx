import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import { ToastDemo } from "@/components/demo/toast-demo";
import type { Tone } from "@/lib/status";

export const metadata = { title: "Design system" };

/** Mirrors the custom properties in `src/styles/tokens.css`. */
const swatches = [
  { name: "green", value: "#02923b", usage: "Primary brand, actions, focus" },
  { name: "green-dark", value: "#086b34", usage: "Hover and pressed" },
  { name: "green-deep", value: "#0b3c25", usage: "Dark bands, admin sidebar" },
  {
    name: "green-soft",
    value: "#eaf7ee",
    usage: "Selected states, active nav",
  },
  { name: "orange", value: "#ff9203", usage: "Accent CTAs, kickers" },
  { name: "orange-soft", value: "#fff2df", usage: "Notice backgrounds" },
  { name: "cream", value: "#faf7f0", usage: "Warm section fills" },
  { name: "ink", value: "#15231a", usage: "Body text" },
  { name: "muted", value: "#68736c", usage: "Secondary text" },
  { name: "border", value: "#dfe8e1", usage: "Hairlines and inputs" },
  { name: "surface", value: "#f5f7f4", usage: "Page and card fills" },
  { name: "white", value: "#ffffff", usage: "Cards and content" },
];

const tones: Tone[] = ["green", "orange", "red", "blue", "neutral"];

const radiusSamples = [
  { name: "radius-sm", value: ".4rem" },
  { name: "radius-md", value: ".8rem" },
  { name: "radius-lg", value: "1rem" },
];

const typeSamples: { label: string; sample: string; style: CSSProperties }[] = [
  {
    label: "Display · Newsreader 500",
    sample: "Coordination you can see",
    style: {
      font: "500 clamp(1.6rem, 3vw, 2.4rem)/1 var(--serif)",
      color: "var(--ink)",
    },
  },
  {
    label: "Heading · Newsreader 500 · 1.7rem",
    sample: "Section titles",
    style: { font: "500 1.7rem var(--serif)", color: "var(--ink)" },
  },
  {
    label: "Body · Manrope · .78rem",
    sample:
      "Supporting copy sits at a comfortable reading rhythm with muted colour.",
    style: { fontSize: ".78rem", color: "var(--muted)", lineHeight: 1.8 },
  },
  {
    label: "Caption · Manrope · .62rem",
    sample: "Labels, metadata and table hints",
    style: { fontSize: ".62rem", color: "var(--muted)" },
  },
  {
    label: "Kicker · Manrope 800 · letterspaced",
    sample: "EYEBROW LABEL",
    style: {
      fontSize: ".7rem",
      fontWeight: 800,
      letterSpacing: ".18em",
      color: "var(--green)",
    },
  },
];

export default function DesignSystemPage() {
  return (
    <div className="wrap info-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Design system</strong>
      </nav>

      <header className="info-hero">
        <span className="kicker green">DEMONSTRATION UTILITY</span>
        <h1>Design system</h1>
        <p>
          The tokens, components and patterns every Paydan screen is built from.
          Style lives in plain CSS files under <code>src/styles/</code> — tokens
          first, then feature sheets — so this page renders the same primitives
          the storefront, account area and operations console use.
        </p>
      </header>

      <div className="ds-sections">
        <section className="ds-section">
          <h2>Colour tokens</h2>
          <p>
            Declared once in <code>src/styles/tokens.css</code> and referenced
            everywhere as CSS custom properties. Green carries action and
            confirmation; orange is the accent; warm neutrals do the rest.
          </p>
          <div className="ds-swatches">
            {swatches.map((swatch) => (
              <div className="ds-swatch" key={swatch.name}>
                <i style={{ background: `var(--${swatch.name})` }} />
                <div>
                  <strong>--{swatch.name}</strong>
                  <code>{swatch.value}</code>
                  <code>{swatch.usage}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ds-section">
          <h2>Typography</h2>
          <p>
            Newsreader (serif) for display and headings; Manrope (sans) for
            everything that has to be read quickly — prices, labels, tables.
            Interface type runs small and dense by design.
          </p>
          <div className="ds-demo plain ds-stack">
            {typeSamples.map((sample) => (
              <div className="ds-type-sample" key={sample.label}>
                <span style={sample.style}>{sample.sample}</span>
                <span>{sample.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ds-section">
          <h2>Status and feedback</h2>
          <p>
            Every state label comes from <code>src/lib/status.ts</code>, which
            maps domain statuses to a tone, so an order reads the same in the
            customer account, order tracking and the operations console.
          </p>
          <div className="ds-demo ds-stack">
            <div className="ds-row">
              {tones.map((tone) => (
                <StatusPill key={tone} tone={tone}>
                  {tone} tone
                </StatusPill>
              ))}
            </div>
            <ToastDemo />
            <p style={{ margin: 0, color: "var(--muted)", fontSize: ".65rem" }}>
              Toasts stack bottom-right (bottom above the mobile tab bar),
              dismiss after five seconds, and are announced to screen readers.
            </p>
          </div>
        </section>

        <section className="ds-section">
          <h2>Actions</h2>
          <p>
            Storefront calls-to-action are warm orange, the dark button anchors
            heavy sections, and the console uses the bordered green family for
            operator controls.
          </p>
          <div className="ds-demo ds-row">
            <Link className="primary-button" href="/shop">
              Shop the catalogue
              <ArrowRightIcon />
            </Link>
            <Link className="dark-button" href="/request-product">
              Request a product
              <ArrowRightIcon />
            </Link>
            <span className="admin-btn">Primary</span>
            <span className="admin-btn ghost">Ghost</span>
            <span className="admin-btn quiet">Quiet</span>
            <span className="admin-btn danger">Destructive</span>
          </div>
          <p
            style={{
              marginTop: ".8rem",
              color: "var(--muted)",
              fontSize: ".65rem",
            }}
          >
            The green family is shown as static specimens here; the console
            wires it to real operations.
          </p>
        </section>

        <section className="ds-section">
          <h2>Forms and surfaces</h2>
          <p>
            Fields share a 1px border, .4rem radius and generous hit height;
            cards are white on the muted surface with a hairline border. Nothing
            relies on colour alone — labels and headings carry the meaning.
          </p>
          <div className="ds-grid-2">
            <div className="ds-demo plain">
              <div className="form-grid">
                <label className="wide">
                  Field label
                  <input defaultValue="Value lives here" readOnly />
                </label>
                <label>
                  Select
                  <select defaultValue="lagos" aria-label="Example select">
                    <option value="lagos">Lagos</option>
                    <option value="fct">FCT</option>
                  </select>
                </label>
                <label>
                  Number
                  <input type="number" defaultValue={2500} readOnly />
                </label>
              </div>
            </div>
            <div className="ds-demo plain ds-stack">
              <div className="admin-meta">
                <div>
                  <span>Label</span>
                  <strong>Value</strong>
                </div>
                <div>
                  <span>Secondary label</span>
                  <strong>Another value</strong>
                </div>
              </div>
              <div className="admin-note">
                Notice · used for caveats and pending states.
              </div>
              <div className="admin-notice">
                Notice · used for confirmations and hints.
              </div>
            </div>
          </div>
        </section>

        <section className="ds-section">
          <h2>Tables</h2>
          <p>
            Data tables set a grid template once on the wrapper; header and rows
            inherit it. The console scrolls them horizontally on narrow screens.
          </p>
          <div
            className="ds-demo plain ds-table-demo admin-table"
            style={{ "--cols": "1.2fr 1fr .8fr" } as CSSProperties}
          >
            <div className="table-head">
              <span>Column one</span>
              <span>Column two</span>
              <span>Column three</span>
            </div>
            <div className="table-row">
              <span>Sample row</span>
              <span>Derived value</span>
              <StatusPill tone="green">Active</StatusPill>
            </div>
            <div className="table-row">
              <span>Second row</span>
              <span>Derived value</span>
              <StatusPill tone="orange">Pending</StatusPill>
            </div>
          </div>
        </section>

        <section className="ds-section">
          <h2>Shape and elevation</h2>
          <p>Three radii and two shadows cover the whole product.</p>
          <div className="ds-grid-2">
            <div className="ds-demo ds-radius">
              {radiusSamples.map((radius) => (
                <div key={radius.name} style={{ borderRadius: radius.value }}>
                  {radius.name}
                </div>
              ))}
            </div>
            <div className="ds-demo ds-shadow">
              <div style={{ boxShadow: "var(--shadow-card)" }}>
                shadow-card · resting cards
              </div>
              <div style={{ boxShadow: "var(--shadow-overlay)" }}>
                shadow-overlay · toasts and popovers
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="info-cta">
        <h2>Where every route stands</h2>
        <p>
          The route directory renders the live manifest — which screens are
          implemented, which are still pending, grouped the same way the build
          plan groups them.
        </p>
        <Link className="primary-button" href="/demo/route-directory">
          Open the route directory
          <ArrowRightIcon />
        </Link>
      </section>
    </div>
  );
}
