"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { readIntent, rememberIntent, safePath } from "@/lib/intent";

export function AuthForm({
  mode = "login",
}: {
  mode?: "login" | "register" | "forgot" | "reset" | "verify" | "admin";
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("error"))
      setError(
        "Sign-in could not be completed. If you already have an email account, sign in with your password and link Google from your profile.",
      );
    const next = params.get("next");
    if (next && !readIntent()) rememberIntent({ path: safePath(next) });
  }, []);
  const title =
    mode === "register"
      ? "Make yourself at home."
      : mode === "forgot"
        ? "Forgot your password?"
        : mode === "reset"
          ? "Choose a new password."
          : mode === "verify"
            ? "Check your inbox."
            : mode === "admin"
              ? "PAYDAN operations"
              : "Welcome back.";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        await api("/api/auth/request-password-reset", {
          email: form.email,
          redirectTo: `${location.origin}/reset-password`,
        });
        setMessage(
          "If an account exists, a password reset link will arrive by email.",
        );
      } else if (mode === "reset") {
        const token = new URLSearchParams(location.search).get("token");
        if (!token)
          throw new Error("This reset link is incomplete. Request a new one.");
        await api("/api/auth/reset-password", {
          newPassword: form.password,
          token,
        });
        setMessage("Password updated. You can now sign in.");
      } else if (mode === "verify") {
        await api("/api/auth/send-verification-email", {
          email: form.email,
          callbackURL: "/login",
        });
        setMessage(
          "If verification is needed, a new link will arrive by email.",
        );
      } else if (mode === "register") {
        await api("/api/auth/sign-up/email", {
          ...form,
          callbackURL: "/login",
        });
        setMessage(
          "Your account has been created. Check your email to verify it, then sign in.",
        );
      } else {
        await api("/api/auth/sign-in/email", {
          email: form.email,
          password: form.password,
        });
        const channel = new BroadcastChannel("paydan-auth");
        channel.postMessage("changed");
        channel.close();
        location.assign(mode === "admin" ? "/admin" : "/dashboard");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url?: string }>("/api/auth/sign-in/social", {
        provider: "google",
        callbackURL: mode === "admin" ? "/admin" : "/dashboard",
        errorCallbackURL: mode === "admin" ? "/admin/login" : "/login",
      });
      if (!result.url) throw new Error("Google sign-in is not configured yet.");
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com")
        throw new Error("Invalid sign-in redirect.");
      location.assign(url.href);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Google sign-in failed.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="auth-experience">
      <aside className="auth-story">
        <Link href="/" className="auth-brand">
          <img
            src="/paydan-logo.png"
            alt="Paydan"
            width={3000}
            height={3223}
          />
          <span>One place. More possibilities.</span>
        </Link>
        <div>
          <span className="kicker">CURATED FOR YOUR EVERYDAY</span>
          <h2>
            Your world,
            <br />
            thoughtfully sourced.
          </h2>
          <p>
            Explore every department. Find something you love. Let us take care
            of the rest.
          </p>
          <div className="auth-orbit" aria-hidden="true">
            <span>Discover</span>
            <span>Connect</span>
            <span>Enjoy</span>
          </div>
        </div>
        <small>
          A personal shopping space, with a whole network behind it.
        </small>
      </aside>
      <main className="auth-form-panel">
        <div className="auth-card">
          <span className="kicker green">YOUR PAYDAN</span>
          <h1>{title}</h1>
          <p className="auth-intro">
            {mode === "login" || mode === "register"
              ? "Your dashboard brings together member prices, saved finds and every order."
              : mode === "admin"
                ? "Use your verified account. Access is assigned by your administrator."
                : "We’ll help you get back to your account."}
          </p>
          {["login", "register", "admin"].includes(mode) && (
            <>
              <button
                className="google-button"
                onClick={google}
                disabled={busy}
              >
                <span aria-hidden="true">G</span> Continue with Google
              </button>
              <div className="auth-divider">or use email</div>
            </>
          )}
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  required
                  autoComplete="name"
                  maxLength={200}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
            )}
            {["login", "register", "reset", "admin"].includes(mode) && (
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={mode === "register" || mode === "reset" ? 12 : 1}
                  maxLength={128}
                  autoComplete={
                    mode === "register" || mode === "reset"
                      ? "new-password"
                      : "current-password"
                  }
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
                {(mode === "register" || mode === "reset") && (
                  <small>At least 12 characters.</small>
                )}
              </label>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {message && <p role="status">{message}</p>}
            <button className="primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "register"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "reset"
                      ? "Update password"
                      : mode === "verify"
                        ? "Resend verification"
                        : "Sign in"}
            </button>
          </form>
          <div className="auth-links">
            {["forgot", "reset", "verify"].includes(mode) && (
              <Link href="/login">Back to sign in</Link>
            )}
            <Link href={mode === "register" ? "/login" : "/register"}>
              {mode === "register"
                ? "Already a member? Sign in"
                : "Create an account"}
            </Link>
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/verify-email">Verify email</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
