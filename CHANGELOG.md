# Changelog

Notable Chronospectra changes are documented here. Dates use ISO 8601.

## Unreleased — 2026-11-15

### Added

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

- The GitHub workflow requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` Actions secrets.
- The ingestion command queries IRSA on each run; the schedule polls monthly
  but does not guarantee that new QR3 products have been published or returned.
- Current QR3 ingestion stores science Zarr products and a HiPS reference
  manifest. It does not generate or mirror a complete HiPS tile tree.
- Generated demo values are not SPHEREx observations and must not be used as
  scientific evidence.
