"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminKpis, AdminPageHeader } from "@/components/admin/page-header";
import { AdminSearch, AdminSelect } from "@/components/admin/data-table";
import { StarIcon } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { ProductReview, ProductReviewStatus } from "@/lib/types";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const suffix =
      status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    const result = await api<{ reviews: ProductReview[] }>(
      `/api/admin/reviews${suffix}`,
    );
    setReviews(result.reviews);
    setResponses((current) =>
      Object.fromEntries(
        result.reviews.map((review) => [
          review.id,
          current[review.id] ?? review.adminResponse ?? "",
        ]),
      ),
    );
  }, [status]);

  useEffect(() => {
    void load().catch((cause) => setMessage((cause as Error).message));
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reviews.filter(
      (review) =>
        !needle ||
        [
          review.productName,
          review.productId,
          review.reviewerName,
          review.title,
          review.body,
        ].some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [query, reviews]);

  async function moderate(
    review: ProductReview,
    next: "published" | "rejected",
  ) {
    setBusy(review.id);
    setMessage("");
    try {
      await api("/api/admin/reviews", {
        id: review.id,
        status: next,
        adminResponse: responses[review.id] || undefined,
      });
      await load();
      setMessage(`Review ${next === "published" ? "published" : "rejected"}.`);
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  const count = (value: ProductReviewStatus) =>
    reviews.filter((review) => review.status === value).length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue trust"
        title="Product reviews"
        description="Moderate verified-purchase feedback and respond publicly without changing the customer’s words."
      />
      <AdminKpis
        items={[
          { label: "In this view", value: reviews.length },
          { label: "Awaiting review", value: count("pending") },
          { label: "Published", value: count("published") },
          { label: "Rejected", value: count("rejected") },
        ]}
      />
      <div className="admin-filters">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search product, buyer or review"
          label="Search reviews"
        />
        <AdminSelect
          label="Moderation status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "published", label: "Published" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </div>
      {message ? (
        <p className="admin-note" role="status">
          {message}
        </p>
      ) : null}
      <div className="admin-review-list">
        {!visible.length ? (
          <div className="admin-empty">
            <h3>No reviews match this view.</h3>
            <p>
              New verified-purchase reviews will appear here for moderation.
            </p>
          </div>
        ) : null}
        {visible.map((review) => (
          <article key={review.id}>
            <div className="admin-section-card-header">
              <div>
                <span
                  className="admin-review-stars"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      className={star <= review.rating ? "filled" : undefined}
                    />
                  ))}
                </span>
                <h2>{review.title}</h2>
                <p>
                  {review.productName || review.productId} ·{" "}
                  {review.reviewerName} · {formatDateTime(review.createdAt)}
                </p>
              </div>
              <StatusPill
                tone={
                  review.status === "published"
                    ? "green"
                    : review.status === "rejected"
                      ? "red"
                      : "orange"
                }
              >
                {review.status}
              </StatusPill>
            </div>
            <p className="admin-review-body">{review.body}</p>
            <label className="admin-field wide">
              Public PAYDAN response{" "}
              <small>
                Optional. This appears below the customer’s review when
                published.
              </small>
              <textarea
                value={responses[review.id] ?? ""}
                maxLength={1000}
                onChange={(event) =>
                  setResponses((current) => ({
                    ...current,
                    [review.id]: event.target.value,
                  }))
                }
              />
            </label>
            <div className="admin-actions">
              <button
                className="admin-btn primary"
                disabled={busy === review.id}
                onClick={() => void moderate(review, "published")}
              >
                {busy === review.id
                  ? "Saving…"
                  : review.status === "published"
                    ? "Save response"
                    : "Publish"}
              </button>
              <button
                className="admin-btn danger"
                disabled={busy === review.id}
                onClick={() => void moderate(review, "rejected")}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
