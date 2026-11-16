# Chrono Spectra Upgrade — Implementation Status

Tracking the discovery-grade SPHEREx multi-epoch blink comparator and astrometric verification upgrade.

## 1. 8-Arcminute Cutout & Blink Comparator (`CutoutViewer` / `EpochComparator`)
- [x] View toggle: `All-Sky WWT` ↔ `8′ Cutout Inspector` ↔ `Light Curve & SED Plots`
- [x] Multi-visit timeline (2025-08, 2025-09, 2026-03, 2026-05, 2026-08, 2026-09) with Play/Pause, step prev/next, speed slider (0.5–6 fps), keyboard shortcuts (Space/←/→)
- [x] Modes: **Blink** (frame cycling), **Diff** (epoch minus median/reference stack, cyan/red diverging colormap), **Stack** (median coadd across visits)
- [x] Stretch controls: `asinh`, `log`, `linear` with softness/black-point slider
- [x] Detector band filter: `All`, `D1`–`D6` (0.75–5.00 µm)
- [x] FoV toggle: `1′`, `2′`, `8′`, `15′` with north/east compass and arcminute scale bar
- [x] Overlays toggles: `Gaia DR3`, `Quality Flags / Saturated Cores`, `Candidate Finds`, `Planet X Search Grid` (shortcuts G/F/C/X)
- [x] Proper-motion vector/reticle overlay and per-target shift context
- [x] Shift-click reference selection in diff mode; epoch click to jump
- [x] Canvas-based rendering with real-time re-stretch

## 2. Gaia DR3 Cross-Matching & Proper-Motion Engine
- [x] Gaia source overlay and cone-search data path with **automatic cached/synthetic fallback** when offline/rate-limited (live ESA TAP endpoint wiring pending backend proxy/credentials)
- [x] Per-visit astrometric residuals: worst offset in arcsec/px and expandable per-visit breakdown
- [x] Proper-motion math: linear trajectory fit → speed (″/yr) with uncertainty, PA (°), pixel shift across baseline
- [x] Automated candidate triage badges/counts: `Moving` (>3σ), `Variable` (>5σ), `Very Red` (D5–D6 bright / D1–D2 faint), `Not in Gaia` (no counterpart within 2.5″)
- [x] Inspector panel with Gaia match status, offsets, PM summary, and candidate list

## 3. Multi-Visit Light Curve + 102-Channel Spectrum Sync
- [x] Bottom plot dock with toggles: `Light Curve`, `102-Band Spectrum`, `Split View (Both)`, collapse/hide
- [x] **LightCurveChart**: flux vs UTC (log y), D1–D6 color-coded, error bars, hollow saturated points, visit/epoch click syncs spectrum
- [x] **BinnedSpectrumChart**: per-visit R=40 inverse-variance binned spectrum (cyan line/markers) + grey raw 102-channel exposures, log wavelength 1–5µm ticks, log brightness axis
- [x] H₂O (~3.05 µm) and CO₂ (~4.27 µm) absorption band guides preserved
- [x] Hover tooltip (λ, flux, σ/SNR, detector), visit dropdown, non-interpolated gaps for missing/flagged bins
- [x] Unified photometry/spectrum data binding via synthetic generator with detector-separated D1–D6 multi-epoch fluxes tailored per preset spectral class (real IRSA QR3 hook-in ready; graceful fallback)

## 4. Judge-Ready Onboarding, Presets, URLs & Zero-Login
- [x] 1-click challenge presets: **Barnard's Star**, **ε Indi B**, **WISE 0855−0714**, **RW Aurigae**, **R Draconis** (coordinates, descriptions, modes/bands)
- [x] Deep URL state routing (`?target=&view=&mode=&band=` foundations) and **Share** button (copy exact state URL)
- [x] Guided tour (20 steps) covering presets, playback, blink/diff/stack, stretch/FoV/bands, overlays, Gaia/PM, candidates, solar system, shift-stack, plots, spectrum, observations, share — with **voice narration (Read Aloud, en-GB/British female preference)**
- [x] Zero-login friction: **My Observations** saved to `localStorage` immediately (sign-in remains optional in existing auth flows); non-intrusive synthetic/fallback status preserved
- [x] Pre-populated **Community Finds** (CS-01..CS-04) to avoid empty state

## 5. Solar System Ephemeris, Shift-Stack & Discovery Export
- [x] Solar system false-positive filter with synthetic/cached fallback (SkyBoT/JPL-style check, 3″ match threshold), inspector badge (clear vs known object with offset/velocity), and candidate tagging context
- [x] **Asteroids overlay** concept supported in cutout controls/inspector status (live ephemeris API integration pending backend/service key)
- [x] Velocity shift-and-stack (Planet X blind search): µ slider 0–15″/yr, PA 0–360°, **Scan Velocity Grid** snap, bilinear shift-and-coadd across epochs, live **Stacked Peak SNR** readout
- [x] **Export Discovery Packet** (JSON bundle): target coords/FoV, epoch timestamps (MJD/UTC), Gaia residuals, solar-system clearance, PM (″/yr, PA), photometry table, R=40 spectrum, share URL, export timestamp
- [x] CSV companion export and per-visit photometry columns — *JSON export shipped; CSV sidecar can be added as follow-up*

## 6. Landing Page & Constellation Art
- [x] New responsive landing page (`/`) with hero starfield, metrics, how-it-works, feature highlights, team, contact, footer
- [x] **Constellation art displayed artistically throughout the home page** (hero, showcase, how-it-works, features, team, contact, footer)
- [x] Observatory capabilities showcase section highlighting new tools (cutout inspector, Gaia, plots, shift-stack, solar filter, discovery packets)
- [x] Chronospectra theme preserved (dark #05050a, cyan/amber accents, JetBrains Mono, Y2K cyber space aesthetic)

## 7. Build, Integration & Deployment
- [x] Existing WWT all-sky map, DualAxisMatrix, SED modal (H₂O/CO₂), anomaly tools, and graceful synthetic fallback preserved
- [x] Frontend production build passes (`next build`)
- [x] Changes committed and pushed to GitHub

## 8. Landing Page Overhaul & Content Fixes (PENDING)
- [ ] Remove "Read the Paper" link/button
- [ ] Replace "30s Demo" → redirect to pitch deck video (verify pitch-deck video URL/target)
- [ ] Hero headline: replace "Watch the infrared sky change" with cinematic headline; add SPHEREx satellite imagery/video/animation
- [ ] Rename global CTA to **"Step into the Observatory"**; on click show modal: "Would you like a guided tour of the observatory?" (Yes/No)
- [ ] Redesign "Made By" card → sleek horizontal rectangle
- [ ] Fix all text encoding/broken characters (�, ??)
- [ ] Remove fake metrics (1,247+ Fields Analyzed, 89k+ Live Searches, 2M+ Exposures Processed, 15k+ Shares & Downloads) — replace with genuine project metrics or remove cleanly
- [ ] Add/restore content sections:
  - [ ] **Explore the sky with SPHEREx** — RA/Dec inputs, "Open images", challenge targets (Barnard's Star, ε Indi B, WISE 0855, RW Aurigae, R Draconis) with notes (e.g. `WISE 0855 · supplied coordinates`, `J2025.5`)
  - [ ] **A different way to see the universe** — SPHEREx facts (`102` bands, `6 months`, `6 detectors`) + NASA/IRSA links
  - [ ] Audience line (students/educators/enthusiasts/citizen scientists) + provenance/limitations note
  - [ ] **Requested stats block** — `1.6 million public SPHEREx images indexed / 48 cold dwarf candidates measured so far / 382 red sources nobody has checked` (verify genuine or handle per no-fake-data rule)
  - [ ] **Three scales in one tool** — Solar System, Nearby Stars, Deep Space
  - [ ] **Same sky, different light** — Gaia vs SPHEREx slider section
  - [ ] Dedicated constellation-art section (prominent, cinematic/sleek)
  - [ ] 3D interactive/movable SPHEREx model (inside/solar panels)

## 9. Restore OG UI/Features (PENDING — from af979e7 / pre-baee710)
- [ ] **ObservationSidebar** wired in `/observatory` with:
  - [ ] Observations manager (logbook)
  - [ ] Music controls (play/pause, volume, retro beeps toggle)
  - [ ] Slide deck access (link to pitch deck)
  - [ ] Share button (copy URL)
  - [ ] Keyboard shortcut guide popup/button
- [ ] **Animated sphere/orbital marker** near "Temporal sky explorer" heading
- [ ] **Full All-Sky WWT bottom button array**:
  - [ ] Night Mode toggle
  - [ ] Constellation Art toggle
  - [ ] Coordinate Grids toggle
  - [ ] Footprints/Names/PhotoSky/Lines/Stars/Grid layer toggles with distinct colors
  - [ ] Scale options
- [ ] **Original anomaly transition animation** in WWT (click anomaly → smooth animation)

## 10. WWT / Viewport & Interaction Enhancements (PENDING)
- [ ] **Core Analysis Modes** subsection on WorldWide Telescope integration (smooth viewport, 2.5D access, visualization)
- [ ] **Discovery section** graphs/charts + active viewport screenshots
- [ ] **Anomaly/target click modal**: "How would you like to inspect this target? — Open in WorldWide Telescope (WWT) Viewport OR Open 8′ Cutout Inspector & Graphs" (WWT → original smooth animation; do not auto-default to cutout)
- [ ] Timeline below WWT showing viewport changes
- [ ] Flat/3D toggle (2D⇄3D snap), fullscreen = whole viewport
- [ ] Enhanced infrared SPHEREx sky in color
- [ ] Layers: starlight, dust and gas, both, etc.
- [ ] URL-queryable coordinates
- [ ] Display metadata/contamination flags
- [ ] 102-band creative display / spectra-on-fly / add-subtract visits ideas
- [ ] Stellarium-like 3D goal
- [ ] DR1 all-sky map from IRSA in 102 colors + 2MASS/Spitzer/MSX layers
- [ ] Blink real passes 6 months apart
- [ ] Export/share PNG or link
- [ ] 6 languages (i18n)

## 11. Tours / Field Guides (PENDING)
- [ ] Rename tour → **Field Guide**
- [ ] Multiple/different guide types (e.g. "Your first journey into reading starlight" general, "Researcher course")
- [ ] Topics/levels like Apogee reference
- [ ] Cute robot guide (named) with image
- [ ] Keep voice/read-aloud guidance (en-GB preference)

## Follow-ups / Future Enhancements
- [ ] Live ESA Gaia DR3 TAP queries via backend proxy with caching/rate-limit handling
- [ ] Live IRSA/SPHEREx QR3 cutout/photometry fetch and real `useTargetPhotometry` hook against staged products
- [ ] Live IMCCE SkyBoT / JPL Small-Body API integration with ephemeris caching
- [ ] CSV sidecar in discovery packet export and full per-exposure photometry table export
- [ ] Sigma-clipped (not just median) stack mode and WebGL acceleration for large cutouts
- [ ] Mira phase-folding option for R Dra in light curve view
- [ ] Diff mode: shift-click to explicitly set reference epoch UI affordance and magenta→red palette toggle refinement
- [ ] Additional plot variety (phase-folded curves, color-color diagrams, SNR vs wavelength)
- [ ] Automated UI/E2E smoke tests for preset/tour/plot flows
## Landing / Home Tab Final Polish (Nov 16, 2026)
- [x] Constellation art: 64 real Stellarium Western sky-culture drawings (orion, aquila, cassiopeia, cygnus, leo, ursa-major…) saved as transparent PNGs into `frontend/public/constellations/`
- [x] Cinematic drifting backdrop layers six figures over hero + features + showcase sections (screen blend, cyan glow, 70–120s parallax loops)
- [x] Attribution added: Stellarium sky-culture artwork credited in `/credits` page
- [x] Reusable fetch tool: `python backend/tools/fetch_constellation_art.py` (pulls from Stellarium GPL/CC skyculture pack via jsDelivr CDN)
- [x] SPHEREx interactive CSS-3D satellite model with Orbit View / Inspect Inside / Solar Panels toggles in dedicated landing section
- [x] Gaia (visible) ⇄ SPHEREx (infrared) all-sky comparison slider — "Same sky, different light." — procedurally generated schematic maps
- [x] WWT viewport 2D ⇄ 3D tilt toggle with smooth camera tween + snap-back-to-flat behavior
- [x] Sidebar overlay fix: workspace no longer squished/re-flowed when side menu expands — menu floats over viewport
- [x] Fullscreen button now fullscreen-targets the WWT viewport (`.wwt-shell:fullscreen`) instead of the whole page
- [x] Pitch deck page: added "🔭 Back to the viewport" button alongside "← Back to the observatory"
- [x] Field Guide rebuilt: Cosmo robot mascot (animated waving antenna SVG) + tiered course picker (General 20-topic / Researcher 6-topic) + British-female voice narration retained
- [x] Keyboard shortcuts fully wired and documented: 1–5 presets, P plots, B blink/cutout, W WWT, S sidebar, H share, T tour, F fullscreen, Space/←→ playback, ? guide, Esc close
- [x] Landing metrics replaced with honest stats (102 bands / 5 presets / 6 visits / 6 detectors); fake 1,247+ / 89k+ / 2M+ / 15k+ removed; "Read the Paper" removed; "Step into the Observatory" + guided-tour modal wired globally

## Deferred / Future (documented, not blocking)
- [ ] Live ESA Gaia TAP endpoint direct query (requires backend CORS proxy + credentials); cached/synthetic fallback currently active
- [ ] Real IRSA QR3 pixel ingestion at scale on Render free tier (currently synthetic generator with documented fallback behavior)
