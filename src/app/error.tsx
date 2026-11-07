"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="payment-state">
      <h1>We couldn’t load this page.</h1>
      <p>
        Please try again in a moment. Your saved account information is kept
        securely.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
      <a href="/">Back to PAYDAN</a>
    </div>
  );
}
