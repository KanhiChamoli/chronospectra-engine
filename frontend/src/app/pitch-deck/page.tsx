"use client";

import Link from "next/link";
import Image from "next/image";

const slideFooter = "CHRONOSPECTRA · NASA SPACE APPS · © KANHI CHAMOLI";

export default function PitchDeckPage() {
  return (
    <main className="pitch-deck">
      <header className="pitch-deck-controls">
        <Link href="/" className="document-back">← Back to the observatory</Link>
        <Link href="/observatory" className="document-back">🔭 Back to the viewport</Link>
        <button type="button" className="primary-action" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </header>

      <article className="pitch-slide pitch-demo-slide" aria-labelledby="pitch-demo-heading">
        <p className="eyebrow">CHRONOSPECTRA · 30-SECOND DEMO</p>
        <h2 id="pitch-demo-heading">Explore the observatory in half a minute.</h2>
        <video
          className="pitch-demo-player"
          controls
          playsInline
          preload="metadata"
          poster="/chronospectra-demo-poster.png"
          aria-label="Chronospectra 30-second product demo with British-English female narration"
        >
          <source src="/chronospectra-demo.mp4" type="video/mp4" />
          <track
            kind="captions"
            src="/chronospectra-demo.en.vtt"
            srcLang="en-GB"
            label="English (British)"
            default
          />
          Your browser does not support embedded video.
        </video>
        <Image
          className="pitch-demo-print-poster"
          src="/chronospectra-demo-poster.png"
          alt="Chronospectra's time-by-wavelength observatory demo"
          width={1280}
          height={720}
          unoptimized
        />
        <p className="pitch-demo-note">British-English female narration · English captions · CC0 ambient soundtrack</p>
        <p className="pitch-demo-warning">
          <strong>Data status:</strong> the video uses synthetic demo examples, not verified SPHEREx QR3 observations.
        </p>
        <footer>{slideFooter}</footer>
      </article>

      <article className="pitch-slide pitch-title-slide">
        <p className="eyebrow">NASA SPACE APPS · PLANET X &amp; SPHEREx</p>
        <div className="pitch-orbit" aria-hidden="true"><span /></div>
        <h1>Chronospectra</h1>
        <p className="pitch-subtitle">A time × wavelength observatory for a changing sky</p>
        <p className="pitch-slide-number">01 / 07</p>
        <footer>{slideFooter}</footer>
      </article>

      <article className="pitch-slide">
        <p className="eyebrow">THE CHALLENGE</p>
        <h2>One sky. Many epochs. 102 spectral channels.</h2>
        <p className="pitch-lead">
          Comparing astronomical images across time is only the beginning.
          Chronospectra brings time and near-infrared wavelength into one
          interactive observing workflow.
        </p>
        <div className="pitch-facts">
          <div><strong>TIME</strong><span>Compare available observation epochs</span></div>
          <div><strong>WAVELENGTH</strong><span>Inspect measured channels from 0.75–5 μm</span></div>
          <div><strong>SKY</strong><span>Navigate targets in an interactive WWT viewport</span></div>
        </div>
        <p className="pitch-slide-number">02 / 07</p>
        <footer>{slideFooter}</footer>
      </article>

      <article className="pitch-slide">
        <p className="eyebrow">THE DUAL-AXIS MATRIX</p>
        <h2>See change in both time and color.</h2>
        <p className="pitch-lead">
          The horizontal axis selects epochs; the vertical axis selects
          wavelength. Each cell represents an observed sample, not an
          interpolated value.
        </p>
        <div className="pitch-matrix" aria-label="Illustration of the time by wavelength matrix">
          <span>μm ↓ / TIME →</span>
          <b>Epoch A</b><b>Epoch B</b><b>Epoch C</b>
          <span>0.75</span><i /><i /><i />
          <span>2.80</span><i /><i className="pitch-highlight" /><i />
          <span>3.00</span><i /><i className="pitch-highlight" /><i />
          <span>4.27</span><i /><i /><i className="pitch-highlight" />
          <span>5.00</span><i /><i /><i />
        </div>
        <p className="pitch-caption">
          Select a measured cell to inspect a wavelength; compare Epoch A and B
          in the spectrum view.
        </p>
        <p className="pitch-slide-number">03 / 07</p>
        <footer>{slideFooter}</footer>
      </article>

      <article className="pitch-slide">
        <p className="eyebrow">SPECTROSCOPY &amp; ANOMALY RADAR</p>
        <h2>From a sky position to a spectrum—and a lead to inspect.</h2>
        <div className="pitch-columns">
          <section>
            <h3>Pixel-level SED</h3>
            <p>FastAPI reads detector-level Zarr products and returns the available wavelength, flux, variance, and flags for a coordinate.</p>
            <p>Epoch curves and annotated absorption regions support visual comparison; the annotations are not molecule detections.</p>
          </section>
          <section>
            <h3>Differential candidates</h3>
            <p>A variance-based comparison highlights candidate changes and links each result back to its sky position.</p>
            <p>Candidate scores are screening aids, not confirmed discoveries or causal explanations.</p>
          </section>
        </div>
        <p className="pitch-slide-number">04 / 07</p>
        <footer>{slideFooter}</footer>
      </article>

      <article className="pitch-slide">
        <p className="eyebrow">OPEN ARCHITECTURE</p>
        <h2>Built to update as public data becomes available.</h2>
        <div className="pitch-architecture">
          <span>IRSA SIA2<br /><small>FITS products</small></span>
          <b aria-hidden="true">→</b>
          <span>FastAPI ingestion<br /><small>WCS · flags · epochs</small></span>
          <b aria-hidden="true">→</b>
          <span>Zarr products<br /><small>coordinate extraction</small></span>
          <b aria-hidden="true">→</b>
          <span>Next.js + WWT<br /><small>map · matrix · SED</small></span>
        </div>
        <p className="pitch-lead">
          Vercel hosts the frontend; the current Render free-tier API stores
          SQLite and Zarr under ephemeral /tmp paths, so data may be lost on
          restart. Use persistent private storage before collecting real data.
          Cloudflare R2 is optional; storage, operations, compute, and delivery
          costs may still apply.
        </p>
        <p className="pitch-slide-number">05 / 07</p>
        <footer>{slideFooter}</footer>
      </article>

      <article className="pitch-slide">
        <p className="eyebrow">TRANSPARENCY &amp; NEXT STEPS</p>
        <h2>Clean-room interface. Honest data status.</h2>
        <ul className="pitch-list">
          <li>Original observatory UI and components, licensed under MIT; no Stellarium source code or artwork is included.</li>
          <li>WWT, NASA/IPAC IRSA, Gaia, SIMBAD, and challenge resources are credited separately.</li>
          <li><strong>Demo values are synthetic—not NASA observations or scientific evidence.</strong></li>
          <li>The final SIA2 attempt in this environment stopped at the IRSA capabilities endpoint with a proxy HTTP 502; no verified QR3 products were downloaded.</li>
          <li>Next: retry IRSA when reachable and validate real product coverage with secure keys and persistent storage.</li>
        </ul>
        <nav className="pitch-resources" aria-label="Pitch deck resources">
          <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noreferrer">IRSA SPHEREx archive ↗</a>
          <a href="https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=resources" target="_blank" rel="noreferrer">Challenge resources ↗</a>
          <Link href="/credits">Software and data credits</Link>
        </nav>
        <p className="pitch-slide-number">06 / 07</p>
        <footer>{slideFooter}</footer>
      </article>

      <article className="pitch-slide">
        <p className="eyebrow">LIVE DEMO WALKTHROUGH</p>
        <h2>Start with a question. Leave with a lead to investigate.</h2>
        <div className="pitch-facts">
          <div>
            <strong>01 · FIND</strong>
            <span>Search a challenge target or open a shared RA/Dec link to fly to a point in the sky.</span>
          </div>
          <div>
            <strong>02 · COMPARE</strong>
            <span>Inspect available epochs and measured wavelengths; open a pixel spectrum where coverage exists.</span>
          </div>
          <div>
            <strong>03 · FOLLOW UP</strong>
            <span>Review anomaly candidates, their variance-based scores, and the supporting epoch comparison.</span>
          </div>
        </div>
        <p className="pitch-lead">
          Today’s hosted demo uses synthetic products—not SPHEREx observations.
          The goal is a release-ready workflow that can be validated against
          verified QR3 products when archive access and coverage are available.
        </p>
        <nav className="pitch-resources" aria-label="Demo deck links">
          <Link href="/">Open the live observatory ↗</Link>
          <Link href="/credits">Review data and software credits</Link>
        </nav>
        <p className="pitch-slide-number">07 / 07</p>
        <footer>{slideFooter}</footer>
      </article>
    </main>
  );
}
