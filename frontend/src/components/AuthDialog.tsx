"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { registerAccount, signIn } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";

interface AuthDialogProps {
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

export function AuthDialog({ onClose, onAuthenticated }: AuthDialogProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    try {
      if (mode === "login") {
        onAuthenticated(await signIn(email, password));
        return;
      }
      const termsAccepted = fields.get("terms_accepted") === "on";
      if (!termsAccepted) throw new Error("Accept the Privacy Policy and Terms of Service to continue.");
      const result = await registerAccount({
        email,
        password,
        full_name: String(fields.get("full_name") ?? ""),
        date_of_birth: String(fields.get("date_of_birth") ?? ""),
        terms_accepted: termsAccepted,
      });
      setMessage(result.message);
      setMode("login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-scrim" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="auth-dialog-heading">
          <div>
            <p className="eyebrow">CHRONOSPECTRA ACCOUNT</p>
            <h2 id="auth-title">{mode === "login" ? "Sign in" : "Create account"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close sign-in dialog">
            <X size={16} />
          </button>
        </div>
        <div className="auth-mode-switch" role="group" aria-label="Account action">
          <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>Sign in</button>
          <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")}>Create account</button>
        </div>
        {message && <p className="auth-success" role="status">{message}</p>}
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {mode === "register" && (
            <>
              <label>
                Full name
                <input name="full_name" autoComplete="name" required maxLength={120} />
              </label>
              <label>
                Date of birth
                <input name="date_of_birth" type="date" autoComplete="bday" required max={new Date().toISOString().slice(0, 10)} />
                <small>Stored encrypted and used only to support account requirements.</small>
              </label>
            </>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={320} />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
            />
            {mode === "register" && <small>Use at least 12 characters.</small>}
          </label>
          {mode === "register" && (
            <label className="consent-row">
              <input type="checkbox" name="terms_accepted" required />
              <span>
                I agree to the <Link href="/privacy-terms" target="_blank">Privacy Policy &amp; Terms of Service</Link>.
              </span>
            </label>
          )}
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="primary-action" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </div>
  );
}
