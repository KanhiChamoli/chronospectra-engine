"""FastAPI entry point for Chronospectra spectral extraction and anomaly screening."""

import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.src.auth import initialize_auth_db, router as auth_router
from backend.src.spectroscopy import (
    NoSpectralDataError,
    extract_spectrum,
    find_anomalies,
    get_data_status,
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    initialize_auth_db()
    yield


app = FastAPI(
    title="Chronospectra API",
    description="API foundation for SPHEREx data products.",
    version="0.1.0",
    lifespan=lifespan,
)

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


@app.get("/health")
def health() -> dict[str, str]:
    """Return a lightweight liveness response."""
    return {"status": "ok"}


@app.get("/api/v1/layers")
def layers() -> dict[str, object]:
    """Describe the official WWT HiPS layer used by the initial data pipeline."""
    return {
        "hips_url": "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube",
        "release": "DR1",
        "spectral_channels": 102,
        "display_only": True,
    }


@app.get("/api/v1/data-status")
def data_status() -> dict[str, object]:
    """Report whether local QR3 Zarr products are ready for extraction."""
    return get_data_status()


@app.get("/api/v1/spectra")
def spectra(
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
def anomalies(
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
