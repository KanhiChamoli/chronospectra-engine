# chronospectra-engine
Chronospectra: A high-performance web observatory featuring an advanced Dual-Axis Temporal-Spectral Matrix, automated cosmic anomaly radar, and interactive SED analysis tools engineered to explore multi-epoch NASA SPHEREx infrared sky surveys with cinematic telemetry, zero-egress cloud tiles, and absolute scientific precision.

# 🌌 Chronospectra
> *Advanced Multi-Epoch Infrared Spectrometry & Temporal Sky Observatory*  
> **NASA Space Apps Challenge 2026 — Planet X & SPHEREx Mission**

---

## 🔭 Overview
**Chronospectra** is a public-facing web observatory built to unlock the full potential of the **SPHEREx** mission. Unlike standard astronomical image viewers that limit users to a flat 1D timeline slider, Chronospectra introduces a **Dual-Axis Temporal-Spectral Matrix**—allowing researchers and space enthusiasts alike to slice through time (6-month survey epochs) and wavelength (96 infrared color bands from $0.75\ \mu\text{m}$ to $5.0\ \mu\text{m}$) simultaneously.

Designed with a professional aerospace telemetry aesthetic, Chronospectra bridges deep backend astrophysics data pipelines with a fluid, high-performance web interface.

---

## The Winning Edge: Core Features

- **The Dual-Axis Temporal-Spectral Matrix:** A professional 2D matrix controller (DaVinci Resolve / audio-console inspired). The X-axis handles 6-month survey epochs, while the Y-axis lets users drag vertically through SPHEREx's 96 infrared channels to instantly contrast starlight against molecular ice absorption features.
- **Automated "Cosmic Anomaly Radar":** A backend differential algorithm running across epochs to detect statistically significant flux shifts (variable stars, moving asteroids, supernovae) and auto-place glowing telemetry reticles directly on the sky map.
- **Plain-English "Cosmic Storyteller" AI Overlay:** Client-side spectral parsing that translates complex multi-wavelength shifts into clear, public-friendly narrative alerts.
- **Interactive SED Curves & Spectral Extraction:** Click any pixel on the map to query the backend Zarr/FITS store and render a live Spectral Energy Distribution curve comparing epoch chemistry side-by-side.

---

##  High-Efficiency Technical Stack

| Component | Technology Choice | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js + TypeScript + Tailwind CSS | Lightning-free rendering, responsive modular workspace panels, and custom Y2K observatory UI styling. |
| **Sky Rendering Engine** | WorldWide Telescope (WWT) Web SDK | Unmatched 60 FPS spherical panning, custom visual layers, and programmatic camera flight paths. |
| **Backend API** | FastAPI (Python) | High-performance asynchronous REST endpoints for spatial queries and pipeline triggers. |
| **Data Processing** | Astropy, Astroquery, Healpy, NumPy | Ingestion of NASA IRSA FITS files, HEALPix coordinate mapping, and HiPS/Zarr tile conversion. |
| **Storage & Hosting** | Cloudflare R2 + Vercel | Zero-egress cloud storage for heavy HiPS tiles paired with instant global edge deployment. |

---

##  Quick Start / Development Setup

```bash
# Clone the repository
git clone [https://github.com/your-username/chronospectra.git](https://github.com/your-username/chronospectra.git)
cd chronospectra

# Setup Backend (FastAPI)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Setup Frontend (Next.js)
cd ../frontend
npm install
npm run dev
