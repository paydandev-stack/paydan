import Link from "next/link";
import { about, trustPoints } from "@/data/content";
import { ArrowRightIcon } from "@/components/icons";

export const metadata = { title: "About Paydan" };

export default function AboutPage() {
  return (
    <div className="wrap info-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>About</strong>
      </nav>

      <header className="info-hero">
        <span className="kicker green">{about.eyebrow}</span>
        <h1>{about.title}</h1>
        <p>{about.intro}</p>
      </header>

      <div className="info-sections">
        {about.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      <section className="info-grid" aria-label="What Paydan does">
        {trustPoints.map((point) => (
          <article key={point.title}>
            <h3>{point.title}</h3>
            <p>{point.body}</p>
          </article>
        ))}
      </section>

      <section className="info-cta">
        <h2>Need something we don&rsquo;t list?</h2>
        <p>
          Paydan sourcing finds suppliers for products outside the catalogue and
          quotes you before anything is ordered.
        </p>
        <Link className="primary-button" href="/request-product">
          Make a request
          <ArrowRightIcon />
        </Link>
      </section>
    </div>
  );
}
