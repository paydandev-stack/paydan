import Link from "next/link";
import { faqGroups } from "@/data/content";

export const metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <div className="wrap info-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/help">Help</Link>
        <span>/</span>
        <strong>FAQ</strong>
      </nav>

      <header className="info-hero">
        <span className="kicker green">FAQ</span>
        <h1>Questions shoppers actually ask</h1>
        <p>
          Answers describe how Paydan intends the storefront to work. Anything
          still being decided is marked as draft on the policy pages rather than
          written as a promise.
        </p>
      </header>

      <div className="faq-groups">
        {faqGroups.map((group) => (
          <section className="faq-group" key={group.title}>
            <h2>{group.title}</h2>
            {group.items.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </section>
        ))}
      </div>

      <section className="contact-note">
        <h2>Question not covered?</h2>
        <p>
          <Link href="/contact">Contact support</Link> or send a{" "}
          <Link href="/request-product">sourcing request</Link> if it is about a
          product we don&rsquo;t list.
        </p>
      </section>
    </div>
  );
}
