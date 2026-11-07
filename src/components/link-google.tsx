"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type LinkedAccount = { providerId: string };

export function LinkGoogle() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linked, setLinked] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void api<LinkedAccount[]>("/api/auth/list-accounts")
      .then((accounts) => {
        if (active)
          setLinked(
            accounts.some((account) => account.providerId === "google"),
          );
      })
      .catch((error) => {
        if (active) {
          setLinked(false);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to check linked accounts.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function link() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>("/api/auth/link-social", {
        provider: "google",
        callbackURL: "/account/profile",
        errorCallbackURL: "/account/profile",
      });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com")
        throw new Error("Google linking is unavailable.");
      location.assign(url.href);
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="security-option">
      <span className="security-option-icon google" aria-hidden="true">
        G
      </span>
      <div className="security-option-copy">
        <h3>Google</h3>
        <p>
          {linked
            ? "Your Google account can be used to sign in securely."
            : "Link Google as another secure way to access your account."}
        </p>
        {error && (
          <p className="profile-inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {linked === null ? (
        <span className="security-status checking">Checking…</span>
      ) : linked ? (
        <span className="security-status connected">Connected</span>
      ) : (
        <button
          className="security-action"
          type="button"
          disabled={busy}
          onClick={() => void link()}
        >
          {busy ? "Opening…" : "Link account"}
        </button>
      )}
    </div>
  );
}
