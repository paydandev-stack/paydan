import Link from "next/link";
import { notFound } from "next/navigation";
import { policyBySlug, policyPages } from "@/data/content";

export function generateStaticParams() {
  return policyPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = policyBySlug(slug);
  return { title: policy ? policy.title : "Policy" };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = policyBySlug(slug);
  if (!policy) notFound();

  return (
    <div className="wrap info-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>{policy.title}</strong>
      </nav>

      <header className="info-hero">
        <span className="kicker green">Policy</span>
        <h1>{policy.title}</h1>
        <p>{policy.summary}</p>
        <p className="policy-status">
          <span className="policy-draft">{policy.status}</span> · Updated{" "}
          {policy.updated}
        </p>
      </header>

      <div className="info-sections">
        {policy.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      <nav className="policy-links" aria-label="Other policies">
        {policyPages
          .filter((item) => item.slug !== policy.slug)
          .map((item) => (
            <Link key={item.slug} href={`/policies/${item.slug}`}>
              {item.title}
            </Link>
          ))}
      </nav>
    </div>
  );
}
