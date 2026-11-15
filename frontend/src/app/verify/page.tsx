"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { verifyEmail } from "@/lib/auth";

export default function VerifyEmailPage() {
  const [message, setMessage] = useState("Verifying your email link…");
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError(true);
      setMessage("This verification link is missing its token.");
      return;
    }
    window.history.replaceState(null, "", "/verify");
    let active = true;
    void verifyEmail(token)
      .then((result) => {
        if (active) setMessage(result.message);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(true);
          setMessage(caught instanceof Error ? caught.message : "Email verification failed.");
        }
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="document-page verify-page">
      <p className="eyebrow">CHRONOSPECTRA ACCOUNT</p>
      <h1>Email verification</h1>
      <p className={error ? "error-message" : "auth-success"} role={error ? "alert" : "status"}>{message}</p>
      <Link href="/" className="primary-action">Return to the observatory</Link>
    </main>
  );
}
