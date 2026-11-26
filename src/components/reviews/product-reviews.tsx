"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { StarIcon } from "@/components/icons";
import { api } from "@/lib/api-client";
import { formatDate, plural } from "@/lib/format";
import type { ProductReview } from "@/lib/types";

type EligiblePurchase = {
  orderId: string;
  orderLineId: string;
  productName: string;
  variantLabel?: string;
  deliveredAt: string;
};

type ReviewPayload = {
  reviews: ProductReview[];
  ownReviews: ProductReview[];
  eligibility: EligiblePurchase[];
  summary: {
    count: number;
    average: number;
    distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  };
  nextCursor: string | null;
};

const EMPTY: ReviewPayload = {
  reviews: [],
  ownReviews: [],
  eligibility: [],
  summary: {
    count: 0,
    average: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  },
  nextCursor: null,
};

function Stars({
  value,
  interactive,
  onChange,
}: {
  value: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
}) {
  return (
    <span
      className={`review-stars${interactive ? " interactive" : ""}`}
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) =>
        interactive ? (
          <button
            key={star}
            type="button"
            aria-label={`Rate ${star} out of 5 stars`}
            aria-pressed={star === value}
            onClick={() => onChange?.(star)}
          >
            <StarIcon className={star <= value ? "filled" : undefined} />
          </button>
        ) : (
          <StarIcon
            key={star}
            className={star <= Math.round(value) ? "filled" : undefined}
            aria-hidden="true"
          />
        ),
      )}
    </span>
  );
}

async function mutate<T>(
  path: string,
  method: "PATCH" | "DELETE",
  body?: unknown,
) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error || "The review could not be updated.");
  return data;
}

export function ProductReviews({
  productId,
  productSlug,
  signedIn,
}: {
  productId: string;
  productSlug: string;
  signedIn: boolean;
}) {
  const [data, setData] = useState(EMPTY);
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [purchase, setPurchase] = useState("");
  const [editing, setEditing] = useState<ProductReview | null>(null);

  const load = useCallback(
    async (cursor?: string, append = false) => {
      const params = new URLSearchParams({ productId, sort });
      if (cursor) params.set("cursor", cursor);
      const next = await api<ReviewPayload>(`/api/reviews?${params}`);
      setData((current) => ({
        ...next,
        reviews: append ? [...current.reviews, ...next.reviews] : next.reviews,
      }));
    },
    [productId, sort],
  );

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((cause) => setMessage((cause as Error).message))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!purchase && data.eligibility[0])
      setPurchase(data.eligibility[0].orderLineId);
  }, [data.eligibility, purchase]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selected = data.eligibility.find(
      (item) => item.orderLineId === purchase,
    );
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      await api("/api/reviews", {
        productId,
        orderId: selected.orderId,
        orderLineId: selected.orderLineId,
        rating,
        title,
        body,
      });
      setTitle("");
      setBody("");
      setRating(5);
      setPurchase("");
      await load();
      setMessage("Thanks — your review is awaiting moderation.");
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await mutate(`/api/reviews/${editing.id}`, "PATCH", {
        rating: editing.rating,
        title: editing.title,
        body: editing.body,
      });
      setEditing(null);
      await load();
      setMessage("Your changes were saved and returned to moderation.");
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(review: ProductReview) {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    setBusy(true);
    try {
      await mutate(`/api/reviews/${review.id}`, "DELETE");
      await load();
      setMessage("Your review was deleted.");
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="product-reviews"
      id="reviews"
      aria-labelledby="reviews-title"
    >
      <div className="review-heading">
        <div>
          <span className="eyebrow">Customer experience</span>
          <h2 id="reviews-title">Reviews and comments</h2>
        </div>
        <label>
          Sort reviews
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </label>
      </div>

      <div className="review-overview">
        <div className="review-score">
          <strong>{data.summary.average.toFixed(1)}</strong>
          <Stars value={data.summary.average} />
          <span>{plural(data.summary.count, "verified review")}</span>
        </div>
        <div className="review-distribution" aria-label="Rating distribution">
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star}>
              <span>{star} star</span>
              <i>
                <b
                  style={{
                    width: `${data.summary.count ? (data.summary.distribution[String(star) as keyof typeof data.summary.distribution] / data.summary.count) * 100 : 0}%`,
                  }}
                />
              </i>
              <span>
                {
                  data.summary.distribution[
                    String(star) as keyof typeof data.summary.distribution
                  ]
                }
              </span>
            </div>
          ))}
        </div>
      </div>

      {message ? (
        <p className="review-message" role="status">
          {message}
        </p>
      ) : null}

      {signedIn && data.ownReviews.length ? (
        <div className="own-reviews">
          <h3>Your reviews</h3>
          {data.ownReviews.map((review) => (
            <article key={review.id}>
              {editing?.id === review.id ? (
                <form className="review-form compact" onSubmit={saveEdit}>
                  <Stars
                    value={editing.rating}
                    interactive
                    onChange={(value) =>
                      setEditing({ ...editing, rating: value })
                    }
                  />
                  <label>
                    Review title
                    <input
                      minLength={2}
                      maxLength={120}
                      required
                      value={editing.title}
                      onChange={(event) =>
                        setEditing({ ...editing, title: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Your comments
                    <textarea
                      minLength={10}
                      maxLength={2000}
                      required
                      value={editing.body}
                      onChange={(event) =>
                        setEditing({ ...editing, body: event.target.value })
                      }
                    />
                  </label>
                  <div>
                    <button disabled={busy}>Save changes</button>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <Stars value={review.rating} />
                    <span className={`review-status ${review.status}`}>
                      {review.status}
                    </span>
                  </div>
                  <strong>{review.title}</strong>
                  <p>{review.body}</p>
                  <div className="review-actions">
                    <button type="button" onClick={() => setEditing(review)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() => void remove(review)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {signedIn && data.eligibility.length ? (
        <form className="review-form" onSubmit={submit}>
          <div>
            <span className="eyebrow">Verified purchase</span>
            <h3>Share your experience</h3>
            <p>Your review will appear after a quick moderation check.</p>
          </div>
          {data.eligibility.length > 1 ? (
            <label>
              Purchase
              <select
                value={purchase}
                onChange={(event) => setPurchase(event.target.value)}
              >
                {data.eligibility.map((item) => (
                  <option key={item.orderLineId} value={item.orderLineId}>
                    {item.variantLabel || item.productName} · delivered{" "}
                    {formatDate(item.deliveredAt)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <fieldset>
            <legend>Your rating</legend>
            <Stars value={rating} interactive onChange={setRating} />
          </fieldset>
          <label>
            Review title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={2}
              maxLength={120}
              required
              placeholder="Sum up your experience"
            />
          </label>
          <label>
            Your comments
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={10}
              maxLength={2000}
              required
              placeholder="What did you like, and what should another buyer know?"
            />
          </label>
          <button disabled={busy}>
            {busy ? "Submitting…" : "Submit review"}
          </button>
        </form>
      ) : signedIn ? (
        <p className="review-eligibility">
          Reviews are available after a paid order has been delivered.
        </p>
      ) : (
        <p className="review-eligibility">
          <Link
            href={`/login?next=${encodeURIComponent(`/product/${productSlug}#reviews`)}`}
          >
            Sign in
          </Link>{" "}
          to review a delivered purchase.
        </p>
      )}

      <div className="review-list">
        {loading ? <p>Loading reviews…</p> : null}
        {!loading && !data.reviews.length ? (
          <div className="empty">
            <h3>No published reviews yet.</h3>
            <p>Verified buyers can be the first to share their experience.</p>
          </div>
        ) : null}
        {data.reviews.map((review) => (
          <article key={review.id}>
            <header>
              <div>
                <Stars value={review.rating} />
                <h3>{review.title}</h3>
              </div>
              <time dateTime={review.createdAt}>
                {formatDate(review.createdAt)}
              </time>
            </header>
            <p>{review.body}</p>
            <footer>
              <strong>{review.reviewerName}</strong>
              {review.verifiedPurchase ? <span>Verified purchase</span> : null}
            </footer>
            {review.adminResponse ? (
              <blockquote>
                <strong>PAYDAN response</strong>
                <p>{review.adminResponse}</p>
              </blockquote>
            ) : null}
          </article>
        ))}
        {data.nextCursor ? (
          <button
            className="load-reviews"
            onClick={() => void load(data.nextCursor!, true)}
          >
            Load more reviews
          </button>
        ) : null}
      </div>
    </section>
  );
}
