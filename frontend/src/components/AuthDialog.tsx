"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { registerAccount, signIn } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: "signup";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "dark";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface AuthDialogProps {
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

const turnstileScript =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function AuthDialog({ onClose, onAuthenticated }: AuthDialogProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    if (mode !== "register" || !siteKey || !captchaContainer.current) return;
    let active = true;
    const renderWidget = () => {
      if (!active || !window.turnstile || !captchaContainer.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(captchaContainer.current, {
        sitekey: siteKey,
        action: "signup",
        theme: "dark",
        callback: setCaptchaToken,
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => {
          setCaptchaToken("");
          setError("CAPTCHA verification failed to load. Please reload and try again.");
        },
      });
    };

    let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (!script) {
      script = document.createElement("script");
      script.src = turnstileScript;
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      document.head.append(script);
    }
    script.addEventListener("load", renderWidget);
    renderWidget();
    return () => {
      active = false;
      script?.removeEventListener("load", renderWidget);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [mode, siteKey]);

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
      if (!siteKey) {
        throw new Error("Account creation is not configured. Contact the site administrator.");
      }
      if (!captchaToken) throw new Error("Complete the CAPTCHA before creating an account.");
      const termsAccepted = fields.get("terms_accepted") === "on";
      if (!termsAccepted) throw new Error("Accept the Privacy Policy and Terms of Service to continue.");
      const result = await registerAccount({
        email,
        password,
        full_name: String(fields.get("full_name") ?? ""),
        date_of_birth: String(fields.get("date_of_birth") ?? ""),
        terms_accepted: termsAccepted,
        captcha_token: captchaToken,
      });
      setMessage(result.message);
      setMode("login");
      setCaptchaToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account request failed.");
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
      setCaptchaToken("");
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
            <>
              <label className="consent-row">
                <input type="checkbox" name="terms_accepted" required />
                <span>
                  I agree to the <Link href="/privacy-terms" target="_blank">Privacy Policy &amp; Terms of Service</Link>.
                </span>
              </label>
              {siteKey ? (
                <div ref={captchaContainer} className="turnstile-box" aria-label="CAPTCHA verification" />
              ) : (
                <p className="auth-config-warning" role="status">
                  Registration is disabled until the administrator configures the CAPTCHA site key.
                </p>
              )}
            </>
          )}
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="primary-action" type="submit" disabled={busy || (mode === "register" && !siteKey)}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        {mode === "register" && (
          <p className="auth-footnote">
            An email verification link is required before sign-in. Account creation requires a configured email service.
          </p>
        )}
      </section>
    </div>
  );
}
