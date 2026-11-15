"""FastAPI entry point for Chronospectra spectral extraction and anomaly screening."""

import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.src.auth import initialize_auth_db, router as auth_router
from backend.src.spectroscopy import (
    NoSpectralDataError,
    extract_spectrum,
    find_anomalies,
    get_data_status,
)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    initialize_auth_db()
    # Warm the anomaly cache at startup so the first visitor does not pay
    # the full scan cost on the free-tier instance.
    try:
        find_anomalies(min_significance=5.0)
    except Exception:  # pragma: no cover - warm-up must never block boot
        pass
    yield


app = FastAPI(
    title="Chronospectra API",
    description="API foundation for SPHEREx data products.",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CHRONOSPECTRA_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(auth_router)

# General API: 60 req/min per IP. Heavy scans: stricter budgets so one user
# cannot monopolize the free-tier CPU.
GENERAL_LIMIT = os.environ.get("CHRONOSPECTRA_RATE_LIMIT_GENERAL", "60/minute")
HEAVY_LIMIT = os.environ.get("CHRONOSPECTRA_RATE_LIMIT_HEAVY", "4/minute")


@app.get("/health")
def health() -> dict[str, str]:
    """Return a lightweight liveness response."""
    return {"status": "ok"}


@app.get("/api/v1/layers")
@limiter.limit(GENERAL_LIMIT)
def layers(request: Request) -> dict[str, object]:
    """Describe the official WWT HiPS layer used by the initial data pipeline."""
    return {
        "hips_url": "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube",
        "release": "DR1",
        "spectral_channels": 102,
        "display_only": True,
    }


@app.get("/api/v1/data-status")
@limiter.limit(GENERAL_LIMIT)
def data_status(request: Request) -> dict[str, object]:
    """Report whether local QR3 Zarr products are ready for extraction."""
    return get_data_status()


@app.get("/api/v1/spectra")
@limiter.limit(HEAVY_LIMIT)
def spectra(
    request: Request,
    ra_deg: float = Query(ge=0.0, lt=360.0),
    dec_deg: float = Query(ge=-90.0, le=90.0),
    radius_arcsec: float = Query(default=30.0, gt=0.0, le=3600.0),
) -> dict[str, object]:
    """Extract all available epoch samples at the nearest WCS pixel."""
    try:
        return extract_spectrum(
            ra_deg,
            dec_deg,
            radius_arcsec=radius_arcsec,
        )
    except NoSpectralDataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/v1/anomalies")
@limiter.limit(HEAVY_LIMIT)
def anomalies(
    request: Request,
    min_significance: float = Query(default=5.0, gt=0.0, le=100.0),
    epoch_a: str | None = Query(default=None, max_length=64),
    epoch_b: str | None = Query(default=None, max_length=64),
) -> dict[str, object]:
    """Return statistically significant per-target changes between epochs."""
    try:
        return find_anomalies(
            min_significance=min_significance,
            epoch_a=epoch_a,
            epoch_b=epoch_b,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# Prometheus metrics: request counts, error rates, and latency quantiles
# (P50/P90/P99 by default) for every route, scraped at /metrics.
Instrumentator(
    should_group_status_codes=False,
    excluded_handlers=["/metrics"],
).instrument(app, latency_highr_buckets=(0.05, 0.1, 0.5, 1, 2.5, 5, 10, 30, 60), latency_lowr_buckets=(0.01, 0.025, 0.05, 0.1)).expose(app, include_in_schema=False)
