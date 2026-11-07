import Link from "next/link";
import { faqGroups, helpTopics } from "@/data/content";

export const metadata = { title: "Help centre" };

export default function HelpPage() {
  return (
    <div className="wrap info-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Help</strong>
      </nav>

      <header className="info-hero">
        <span className="kicker green">Help centre</span>
        <h1>How can we help?</h1>
        <p>
          Start with the common tasks below. If your question is about a
          specific order, the tracking page shows payment, fulfilment and each
          delivery group in one place.
        </p>
      </header>

      <div className="help-grid">
        {helpTopics.map((topic) => (
          <Link key={topic.title} href={topic.href}>
            <h2>{topic.title}</h2>
            <p>{topic.description}</p>
            <span>Open</span>
          </Link>
        ))}
      </div>

      <section className="help-faq">
        <h2>Popular questions</h2>
        {faqGroups[0].items.slice(0, 3).map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
        <p className="help-more">
          <Link href="/faq">See all questions</Link>
        </p>
      </section>

      <section className="contact-note">
        <h2>Still stuck?</h2>
        <p>
          <Link href="/contact">Contact the PAYDAN team</Link> with your order
          reference. Support answers Monday to Saturday, 9:00–18:00 WAT.
        </p>
      </section>
    </div>
  );
}
