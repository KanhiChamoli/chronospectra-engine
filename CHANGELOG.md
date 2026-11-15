# Changelog

Notable Chronospectra changes are documented here. Dates use ISO 8601.

## Unreleased — 2026-11-15

### Added

- Added a responsive, clean-room sky-explorer layout with catalog/anomaly
  search, target detail cards, persistent viewport labels, live field-of-view
  readout, WWT grid/atmosphere/constellation toggles, ecliptic/meridian guides,
  location/time displays, fullscreen, and night mode.
- Added SQLite-backed account registration, Cloudflare Turnstile verification,
  expiring email-confirmation links, scrypt password hashes, secure HTTP-only
  session cookies, encrypted date-of-birth storage, and per-user observation
  create/read/update/delete endpoints.
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

- Public registration remains disabled until Turnstile keys, SMTP settings,
  and `CHRONOSPECTRA_PII_ENCRYPTION_KEY` are configured. Keep the SQLite
  account database on persistent private storage and back up the encryption
  key separately. Cross-site production deployments require HTTPS,
  credentialed CORS, and `SameSite=None; Secure` cookies.
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
