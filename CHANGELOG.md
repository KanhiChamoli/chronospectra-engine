# Changelog

Notable Chronospectra changes are documented here. Dates use ISO 8601.

## Unreleased — 2026-11-15

### Discovery-grade observatory upgrade

- Added `/observatory` discovery workspace with view toggles for **All-Sky WWT**, **8′ Cutout Inspector**, and **Light Curve & SED Plots**, preserving existing WWT, DualAxisMatrix, SED modal, anomaly tools, and synthetic-fallback behavior.
- Implemented multi-epoch cutout comparator with 6-visit timeline, Play/Pause/step/speed controls, **Blink/Diff/Stack** modes (median diff, cyan/red diverging residuals, median coadd), **asinh/log/linear** stretch, FoV/band controls, compass/scale bar, and overlays (Gaia/Flags/Finds/Planet X) with keyboard shortcuts.
- Added Gaia cross-match/astrometric inspector with per-visit residuals, proper-motion summary (″/yr, PA, baseline shift), candidate triage tags (**Moving/Variable/Very Red/Not in Gaia**) and counts, with cached/synthetic fallback when live services are unavailable.
- Added bottom plot dock with **Light Curve** (D1–D6, log flux vs UTC, error bars, hollow saturated points, epoch sync) and **R=40 binned 102-channel Spectrum** (raw grey exposures, cyan inverse-variance bins, H₂O/CO₂ markers, visit selector, tooltips).
- Added **Planet X shift-stack** controls (µ/PA sliders, scan/grid snap, live stacked SNR) and solar-system clearance badge/fallback in inspector; added **Discovery Packet** JSON export (coords, epochs, Gaia/SSO/PM, photometry, R=40 spectrum, share URL).
- Added 5 challenge presets (Barnard’s Star, ε Indi B, WISE 0855−0714, RW Aur, R Dra), shareable URL state foundations, 20-step **voice-guided tour** (Read Aloud, en-GB preference), localStorage **My Observations** with seeded community finds, and zero-login save flow.
- Added new responsive landing page with hero/starfield, metrics, feature sections, team/contact/footer, **constellation art throughout the home page**, and observatory capabilities showcase linking to `/observatory`.

### Pitch-deck demo

- Added a 30-second, 720p product-demo video with a British-English female
  voice-over, synchronized captions, and a CC0 ambient soundtrack. The animation
  labels spectra and anomaly examples as synthetic and states that no verified
  QR3 products are staged.
- Added the video before the seven-slide deck, with native playback controls,
  captions, a print poster, and a source/license credit for its soundtrack.
- Added an optional video-generation script and isolated media requirements;
  these do not add dependencies to the production frontend or API.

### Observatory interaction and QR3 ingestion

- Added persistent, user-toggleable retro button beeps and a small animated
  orbital marker beside the temporal sky heading. The animation respects the
  existing reduced-motion preference.
- Added an explicit verified-QR3 product count; only non-synthetic groups with
  QR3 collection metadata, an archive product ID, and an HTTPS IRSA source URL
  qualify. Synthetic demo products remain separate.
- Added bounded retries for transient IRSA SIA2 and FITS-download failures.
  Query failures are recorded per target in the ingest manifest, and incomplete
  queries still fail the ingestion command.

### Account, audio, and deployment polish

- Configured Render to generate a persistent secret seed for Fernet-protected
  birth dates, while continuing to support an explicitly configured Fernet key.
  Added registration tests for seeded encryption and missing-secret failure.
- Added a looping background music player with saved play/volume
  preferences and playback controls in the observation sidebar.
- Added a direct sidebar link to the seven-slide pitch deck and removed the
  unused Vercel Analytics and Speed Insights components and dependencies.
- Clarified the WWT startup status when tile metadata takes longer than usual,
  and corrected the map badge so it reports QR3 data status without implying
  that QR3 spectra are already available.
- Retried the IRSA SIA2 capabilities request; it still returned HTTP 502, so no
  QR3 products could be verified or staged. Synthetic products remain labeled
  as demo data and are not represented as NASA observations.
- Added SIA2 product identifiers and release/collection provenance to ingested
  Zarr metadata and manifests, preserving the original archive URL separately
  from the cutout URL; the observation epoch and FITS flag extension remain
  attached to each product.

### Audit follow-up

- Expanded the judge pitch deck to seven slides, including a concise live-demo
  flow with explicit synthetic-data caveats and an accurate note about the
  hosted API's ephemeral free-tier storage.
- Fixed anomaly scan caching to separate Zarr roots, cap cache growth, and
  refresh scans within 60 seconds so newly staged products are not hidden for
  an hour. Reused Zarr groups, arrays, and WCS metadata for repeated spectrum
  queries and added a regression test for cross-root cache isolation. In a
  local 1,020-product benchmark, warm extraction improved from about 6.6 s to
  about 0.7 s; hosted performance still needs a post-deploy check.
- Corrected deployment documentation: the current Render Blueprint is free
  tier and uses ephemeral `/tmp` storage, so accounts and demo products are
  not durable across instance replacement.

### Added

- Added a Render Docker Blueprint with a least-dependency API image, health
  checks, and a production environment variable checklist. Updated Vercel
  install configuration to use `npm ci`.
- Added an original orbit-and-star Chronospectra mark, cyan/night-red viewport
  cursors, and a Kanhi Chamoli copyright line in the sidebar footer.
- Added a print-to-PDF pitch deck covering the matrix, architecture,
  licensing, deployment, and the current synthetic/live-data boundary.
- Improved empty-query and Enter-key search behavior so an empty search never
  jumps to the Sun and Enter selects the first catalog or anomaly match.
- Avoided redundant WWT overlay state updates when projected positions have
  not visibly changed and paused overlay polling while the page is hidden.
- Recorded that the final IRSA SIA2 attempt on 2026-11-15 stopped at the
  capabilities endpoint with a proxy HTTP 502; no verified QR3 products were
  returned or downloaded.
- Added a responsive, clean-room sky-explorer layout with catalog/anomaly
  search, target detail cards, persistent viewport labels, live field-of-view
  readout, WWT grid/atmosphere/constellation toggles, ecliptic/meridian guides,
  location/time displays, fullscreen, and night mode.
- Added SQLite-backed account registration with consent, scrypt password
  hashes, secure HTTP-only session cookies, encrypted date-of-birth storage,
  and per-user observation create/read/update/delete endpoints. The current
  registration flow marks email verified immediately and has no CAPTCHA.
- Added a collapsible observation logbook, map-target save action, editable
  notes, email-verification page, prototype privacy/terms page, and data credits
  page with NASA, Gaia, SIMBAD, WWT, and Stellarium Web design acknowledgement.
- Added automated API tests for required registration consent, email
  verification, login, private sessions, and observation CRUD.
- Replaced the demo-only warning panel with a clearly labeled synthetic demo
  status (the local API currently reports 1,020 synthetic products, not a
  verified QR3 release) and direct links to the challenge-listed IRSA archive,
  SPHEREx notebooks, WiseView, Gaia DR3, and the complete NASA Space Apps
  resources.
- Monthly GitHub Actions polling for SPHEREx QR3 products, with a manual
  dispatch option and upload of processed products to a configured Cloudflare
  R2 bucket.
- Deterministic, explicitly synthetic 102-sample demo products for five
  challenge targets, enabling the spectrum and anomaly interfaces to be
  exercised when IRSA has no matching QR3 products.
- A time-by-wavelength matrix that displays observed epoch/sample cells and
  lets users select or drag across measurements.
- Shareable RA/Dec URL coordinates, WWT AllWISE and 2MASS image overlays, and
  a client-side, variance-based plain-English spectrum summary.

### Fixed

- Clarified API connection failures with the configured API origin and
  startup guidance.
- Bound wavelength selection to the selected epoch and made anomaly scans use
  the currently selected epoch pair.
- Mapped HiPS `jpeg` tile metadata to the `.jpg` tile paths used by the
  configured IRSA surveys.

### Operational notes

- The current account flow does not enforce CAPTCHA or email verification;
  its only production safeguard for encrypted DOB storage is a configured
  `CHRONOSPECTRA_PII_ENCRYPTION_KEY`. Review/restore abuse controls before
  allowing public registration. Render's free `/tmp` paths are ephemeral;
  use durable private storage for real accounts and back up the encryption key.
  Cross-site production deployments require HTTPS, credentialed CORS, and
  `SameSite=None; Secure` cookies.
- The Privacy Policy & Terms page is a prototype notice and must be reviewed
  for the deploying operator and jurisdiction before collecting real user data.
- The GitHub workflow requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` Actions secrets.
- The ingestion command queries IRSA on each run; the schedule polls monthly
  but does not guarantee that new QR3 products have been published or returned.
- Current QR3 ingestion stores science Zarr products and a HiPS reference
  manifest. It does not generate or mirror a complete HiPS tile tree.
- Generated demo values are not SPHEREx observations and must not be used as
  scientific evidence.
- The image seeds the synthetic demo only if the Zarr directory is empty. It
  does not merge synthetic and real datasets; back up and intentionally replace
  the data tree when switching to verified products.
