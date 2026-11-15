import Link from "next/link";

export default function PrivacyTermsPage() {
  return (
    <main className="document-page">
      <Link href="/" className="document-back">← Back to the sky</Link>
      <p className="eyebrow">CHRONOSPECTRA · ACCOUNT INFORMATION</p>
      <h1>Privacy Policy &amp; Terms of Service</h1>
      <p className="document-notice">
        This project is a challenge prototype. The operator must review and adapt
        this notice to the deployed service, applicable law, and actual retention
        practices before accepting real users.
      </p>

      <h2>Privacy</h2>
      <p>
        Account creation requests your name, email address, and date of birth.
        Passwords are stored as salted scrypt hashes. Date of birth is encrypted
        in the application database and is not returned by the account API. The
        prototype does not use it to profile users or determine eligibility.
      </p>
      <p>
        Saved observations and their notes are private to the account that
        created them. They are stored by the Chronospectra API and retained until
        removed by the user or the account is deleted. Do not put sensitive
        personal information in observing notes.
      </p>
      <p>
        Cloudflare Turnstile processes CAPTCHA requests, and the configured
        email provider sends account verification messages. Their own privacy
        policies apply when these services are enabled. Browser location is
        requested for local sky coordinates; the app uses the browser-provided
        coordinates in the page and does not send them to a reverse-geocoding
        service.
      </p>
      <p>
        To limit password guessing, the API temporarily stores a one-way hash
        of the client network address and a failed-sign-in counter. Raw network
        addresses are not written to this rate-limit record, which expires
        after its 15-minute window.
      </p>

      <h2>Terms</h2>
      <p>
        Chronospectra is provided as-is for exploration and demonstration, not
        as a source of medical, navigational, commercial, or professional
        astronomical advice. Synthetic products are not NASA observations.
        Catalog references and derived rise/set values may be incomplete or
        approximate; independently verify scientific results.
      </p>
      <p>
        NASA and the NASA Space Apps Challenge do not endorse this project.
        Third-party catalogs, data archives, and services remain subject to
        their own licenses and terms.
      </p>

      <h2>Account control</h2>
      <p>
        Use “Delete account” in the signed-in observation sidebar to remove the
        account, saved observations, and active sessions from the application
        database. Backups and provider delivery logs may follow separate
        retention schedules configured by the operator.
      </p>
      <p className="document-footnote">Last updated: November 15, 2026 · Prototype notice, not legal advice.</p>
    </main>
  );
}
