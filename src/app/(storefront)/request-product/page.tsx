"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { rememberIntent } from "@/lib/intent";
import { MediaUpload } from "@/components/media-upload";
import { useDemo } from "@/lib/store";
import { nigerianStates } from "@/lib/catalog";

function RequestProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, actions } = useDemo();

  const [form, setForm] = useState({
    customerName: state.customerSession?.name ?? "",
    email: state.customerSession?.email ?? "",
    phone: "",
    productName: searchParams.get("product") ?? "",
    categorySlug: "",
    description: "",
    quantity: "1",
    budget: "",
    city: state.location.city,
    state: state.location.state,
  });
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    try {
      const draft = JSON.parse(
        sessionStorage.getItem("paydan-sourcing-draft") || "null",
      );
      if (draft) setForm((f) => ({ ...f, ...draft }));
    } catch {}
  }, []);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const departments = [...state.categories]
    .filter((category) => !category.restricted)
    .sort((a, b) => a.order - b.order);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (!form.customerName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError(
        "We need your name, email and phone number to send a quotation.",
      );
      return;
    }
    if (!form.productName.trim() || !form.categorySlug) {
      setError("Tell us the product and the department it belongs to.");
      return;
    }
    if (!form.city.trim() || !form.state.trim()) {
      setError("Add the city and state the item should be delivered to.");
      return;
    }

    if (!state.customerSession) {
      sessionStorage.setItem("paydan-sourcing-draft", JSON.stringify(form));
      rememberIntent({ path: "/request-product" });
      router.push("/login");
      return;
    }
    setSubmitting(true);
    try {
      await actions.submitSourcing({
        images,
        customerName: form.customerName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        productName: form.productName.trim(),
        categorySlug: form.categorySlug,
        description: form.description.trim(),
        quantity: Math.max(1, Number(form.quantity) || 1),
        budget: form.budget.trim()
          ? Number(form.budget.replace(/[^0-9]/g, ""))
          : undefined,
        city: form.city.trim(),
        state: form.state.trim(),
      });
      sessionStorage.removeItem("paydan-sourcing-draft");
      router.push("/request-product/success");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to submit the request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wrap request-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Request a product</strong>
      </nav>

      <header className="flow-heading">
        <span className="kicker green">Paydan sourcing</span>
        <h1>Looking for something we don&rsquo;t stock?</h1>
        <p>
          Tell us what you need. Our sourcing team finds a supplier, checks
          availability and sends a quotation with a price, delivery estimate and
          validity date. Accepting is your choice.
        </p>
      </header>

      <div className="request-layout">
        <form className="request-form" onSubmit={handleSubmit}>
          {state.customerSession && (
            <MediaUpload
              purpose="sourcing"
              onUploaded={(url) =>
                setImages((current) => [...current, url].slice(0, 5))
              }
            />
          )}{" "}
          {images.length > 0 && (
            <p>{images.length} reference images attached.</p>
          )}
          <section>
            <h2>Your details</h2>
            <div className="form-grid">
              <label>
                Full name
                <input
                  value={form.customerName}
                  onChange={(event) =>
                    update("customerName", event.target.value)
                  }
                  autoComplete="name"
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="wide">
                Phone number
                <input
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  autoComplete="tel"
                />
              </label>
            </div>
          </section>
          <section>
            <h2>What do you need?</h2>
            <div className="form-grid">
              <label className="wide">
                Product name
                <input
                  value={form.productName}
                  onChange={(event) =>
                    update("productName", event.target.value)
                  }
                  placeholder="e.g. Standing desk, 140cm"
                />
              </label>
              <label>
                Department
                <select
                  value={form.categorySlug}
                  onChange={(event) =>
                    update("categorySlug", event.target.value)
                  }
                >
                  <option value="">Select a department</option>
                  {departments.map((department) => (
                    <option key={department.slug} value={department.slug}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(event) => update("quantity", event.target.value)}
                />
              </label>
              <label>
                Budget per unit (optional)
                <input
                  value={form.budget}
                  onChange={(event) => update("budget", event.target.value)}
                  placeholder="e.g. 150000"
                  inputMode="numeric"
                />
              </label>
              <label>
                City
                <input
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                />
              </label>
              <label>
                State
                <select
                  value={form.state}
                  onChange={(event) => update("state", event.target.value)}
                >
                  {nigerianStates.map((stateName) => (
                    <option key={stateName} value={stateName}>
                      {stateName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Description, size, colour or model
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  placeholder="Anything that helps us source the exact item."
                />
              </label>
            </div>
          </section>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions">
            <Link href="/shop">Browse instead</Link>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? "Sending request…" : "Send sourcing request"}
            </button>
          </div>
        </form>

        <aside className="request-aside">
          <h2>What happens next</h2>
          <ol>
            <li>
              <strong>We review your request.</strong> A sourcing manager checks
              the specification and looks for a supplier.
            </li>
            <li>
              <strong>You get a quotation.</strong> Price, quantity, delivery
              estimate and a validity date — no obligation to accept.
            </li>
            <li>
              <strong>Accept or decline.</strong> Accepting converts the quote
              into an order you can track like any other.
            </li>
          </ol>
          <p>
            Your request is saved to your account and reviewed by the PAYDAN
            sourcing team.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default function RequestProductPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap request-page">
          <div className="empty">
            <h3>Loading request form…</h3>
          </div>
        </div>
      }
    >
      <RequestProductForm />
    </Suspense>
  );
}
