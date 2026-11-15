"""Read-only spectral extraction and epoch differential analysis for Zarr products."""

from __future__ import annotations

import math
import os
import logging
from pathlib import Path
from typing import Any

import numpy as np
import zarr
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.wcs import WCS

DEFAULT_ZARR_ROOT = Path(__file__).resolve().parents[1] / "data" / "processed" / "zarr"
H2O_ICE_BAND_UM = (2.85, 3.15)
CO2_ICE_BAND_UM = (4.20, 4.34)
LOGGER = logging.getLogger("chronospectra.spectroscopy")


class NoSpectralDataError(LookupError):
    """Raised when no local Zarr pixel covers the requested coordinate."""


def _zarr_root() -> Path:
    return Path(os.environ.get("CHRONOSPECTRA_ZARR_ROOT", DEFAULT_ZARR_ROOT)).resolve()


def _open_complete_groups(root: Path) -> list[zarr.hierarchy.Group]:
    if not root.is_dir():
        return []
    groups: list[zarr.hierarchy.Group] = []
    for metadata_path in root.rglob(".zgroup"):
        try:
            group = zarr.open_group(str(metadata_path.parent), mode="r")
        except (OSError, zarr.errors.PathNotFoundError, zarr.errors.GroupNotFoundError):
            continue
        if group.attrs.get("complete") is True:
            groups.append(group)
    return groups


def _pixel_for_coordinate(
    group: zarr.hierarchy.Group,
    ra_deg: float,
    dec_deg: float,
    radius_arcsec: float,
) -> tuple[int, int] | None:
    header_text = group.attrs.get("spatial_wcs_header")
    if not isinstance(header_text, str):
        return None
    header = fits.Header.fromstring(header_text, sep="\n")
    wcs = WCS(header).celestial
    x_pixel, y_pixel = wcs.world_to_pixel_values(ra_deg, dec_deg)
    if not np.isfinite(x_pixel) or not np.isfinite(y_pixel):
        return None
    column = math.floor(float(x_pixel) + 0.5)
    row = math.floor(float(y_pixel) + 0.5)
    flux = group["flux_mjy_sr"]
    if row < 0 or column < 0 or row >= flux.shape[0] or column >= flux.shape[1]:
        return None

    pixel_ra = float(group["ra_deg"][row, column])
    pixel_dec = float(group["dec_deg"][row, column])
    requested = SkyCoord(ra=ra_deg, dec=dec_deg, unit="deg")
    sampled = SkyCoord(ra=pixel_ra, dec=pixel_dec, unit="deg")
    if requested.separation(sampled).arcsec > radius_arcsec:
        return None
    return row, column


def _sample_from_group(
    group: zarr.hierarchy.Group,
    ra_deg: float,
    dec_deg: float,
    radius_arcsec: float,
) -> dict[str, Any] | None:
    pixel = _pixel_for_coordinate(group, ra_deg, dec_deg, radius_arcsec)
    if pixel is None:
        return None
    row, column = pixel
    flux = float(group["flux_mjy_sr"][row, column])
    variance = float(group["variance_mjy_sr2"][row, column])
    wavelength = float(group["wavelength_um"][row, column])
    bandwidth = float(group["bandwidth_um"][row, column])
    flags = int(group["flags"][row, column])
    if (
        not all(math.isfinite(value) for value in (flux, variance, wavelength))
        or variance <= 0.0
        or wavelength <= 0.0
    ):
        return None
    return {
        "wavelength_um": wavelength,
        "bandwidth_um": bandwidth if math.isfinite(bandwidth) else 0.0,
        "flux_mjy_sr": flux,
        "sigma_mjy_sr": math.sqrt(variance),
        "flags": flags,
        "detector": str(group.attrs.get("detector", "unknown")),
        "date_obs": str(group.attrs.get("date_obs", "")),
    }


def extract_spectrum(
    ra_deg: float,
    dec_deg: float,
    *,
    radius_arcsec: float = 30.0,
    zarr_root: Path | None = None,
) -> dict[str, Any]:
    """Extract native calibrated pixel samples from every matching Zarr product.

    An individual SPHEREx QR3 MEF is a detector image rather than a 102-plane
    cube. This function returns the observed samples for the clicked coordinate,
    grouped by the six-month epoch stored on each group; it does not interpolate
    or synthesize missing channels.
    """
    root = zarr_root or _zarr_root()
    epochs: dict[str, list[dict[str, Any]]] = {}
    found_products = 0
    synthetic_products = 0

    for group in _open_complete_groups(root):
        try:
            sample = _sample_from_group(group, ra_deg, dec_deg, radius_arcsec)
        except (KeyError, ValueError, TypeError):
            LOGGER.warning(
                "Skipping malformed Zarr product %s during spectral extraction",
                group.path,
                exc_info=True,
            )
            continue
        if sample is None:
            continue
        epoch = str(group.attrs.get("epoch", "unknown"))
        epochs.setdefault(epoch, []).append(sample)
        found_products += 1
        synthetic_products += bool(group.attrs.get("synthetic", False))

    if not epochs:
        raise NoSpectralDataError(
            f"No complete QR3 Zarr pixel covers RA={ra_deg:.6f}, Dec={dec_deg:.6f}. "
            "Stage the challenge cutouts with `python backend/src/ingest_spherex.py` "
            "from the repository root, then try again."
        )

    ordered_epochs = {
        epoch: sorted(samples, key=lambda sample: sample["wavelength_um"])
        for epoch, samples in sorted(epochs.items())
    }
    return {
        "ra_deg": ra_deg,
        "dec_deg": dec_deg,
        "flux_unit": "MJy/sr",
        "wavelength_unit": "um",
        "available_sample_count": max(
            len(samples) for samples in ordered_epochs.values()
        ),
        "product_count": found_products,
        "synthetic": synthetic_products > 0,
        "epochs": ordered_epochs,
    }


def get_data_status(zarr_root: Path | None = None) -> dict[str, Any]:
    """Summarize locally staged complete QR3 products without exposing file paths."""
    groups = _open_complete_groups(zarr_root or _zarr_root())
    target_ids = {
        str(group.attrs.get("target_id", ""))
        for group in groups
        if group.attrs.get("target_id")
    }
    epochs = {
        str(group.attrs.get("epoch", "unknown"))
        for group in groups
    }
    synthetic_product_count = sum(
        bool(group.attrs.get("synthetic", False)) for group in groups
    )
    return {
        "ready": bool(groups),
        "product_count": len(groups),
        "target_count": len(target_ids),
        "epochs": sorted(epochs),
        "synthetic_product_count": synthetic_product_count,
    }


def _paired_differences(
    samples_a: list[dict[str, Any]],
    samples_b: list[dict[str, Any]],
) -> list[dict[str, float]]:
    """Match A/B samples by actual wavelength, allowing for their band widths."""
    ordered_b = sorted(samples_b, key=lambda item: item["wavelength_um"])
    used_b: set[int] = set()
    differences: list[dict[str, float]] = []
    for sample_a in sorted(samples_a, key=lambda item: item["wavelength_um"]):
        candidates = [
            (index, sample_b)
            for index, sample_b in enumerate(ordered_b)
            if index not in used_b
        ]
        if not candidates:
            break
        index_b, sample_b = min(
            candidates,
            key=lambda item: abs(
                item[1]["wavelength_um"] - sample_a["wavelength_um"]
            ),
        )
        wavelength_delta = abs(
            sample_b["wavelength_um"] - sample_a["wavelength_um"]
        )
        tolerance = max(
            0.5
            * (
                sample_a["bandwidth_um"]
                + sample_b["bandwidth_um"]
            ),
            0.005,
        )
        if wavelength_delta > tolerance:
            continue
        used_b.add(index_b)
        combined_sigma = math.hypot(
            sample_a["sigma_mjy_sr"], sample_b["sigma_mjy_sr"]
        )
        if combined_sigma <= 0.0 or not math.isfinite(combined_sigma):
            continue
        differences.append(
            {
                "wavelength_um": 0.5
                * (sample_a["wavelength_um"] + sample_b["wavelength_um"]),
                "delta_flux_mjy_sr": sample_b["flux_mjy_sr"]
                - sample_a["flux_mjy_sr"],
                "significance": (
                    sample_b["flux_mjy_sr"] - sample_a["flux_mjy_sr"]
                )
                / combined_sigma,
            }
        )
    return differences


def tell_cosmic_story(
    wavelength_um: float,
    delta_flux_mjy_sr: float,
    significance: float,
) -> str:
    """Generate a cautious one-sentence lead for follow-up, not a physical claim."""
    direction = "increased" if delta_flux_mjy_sr > 0 else "decreased"
    if CO2_ICE_BAND_UM[0] <= wavelength_um <= CO2_ICE_BAND_UM[1]:
        return (
            f"Flux near the CO₂ feature {direction} by {abs(significance):.1f}σ; "
            "this is a candidate change for follow-up, not confirmation of sublimation."
        )
    if H2O_ICE_BAND_UM[0] <= wavelength_um <= H2O_ICE_BAND_UM[1]:
        return (
            f"Flux in the H₂O-ice absorption region {direction} by "
            f"{abs(significance):.1f}σ; compare epochs and flags before interpretation."
        )
    return (
        f"Flux near {wavelength_um:.3f} μm {direction} by {abs(significance):.1f}σ; "
        "verify this candidate against image flags and neighboring epochs."
    )


def find_anomalies(
    *,
    min_significance: float = 5.0,
    epoch_a: str | None = None,
    epoch_b: str | None = None,
    zarr_root: Path | None = None,
) -> dict[str, Any]:
    """Compare local target spectra between epochs and report the strongest change.

    The score is a difference divided by the quadrature sum of the two supplied
    variance-derived uncertainties. It is a screening statistic, not a
    completeness-corrected discovery significance.
    """
    if not math.isfinite(min_significance) or min_significance <= 0.0:
        raise ValueError("min_significance must be a positive finite number")
    groups = _open_complete_groups(zarr_root or _zarr_root())
    targets: dict[str, dict[str, Any]] = {}
    for group in groups:
        target_id = str(group.attrs.get("target_id", ""))
        if not target_id:
            continue
        target = targets.setdefault(
            target_id,
            {
                "target_id": target_id,
                "target_name": str(group.attrs.get("target_name", target_id)),
                "ra_deg": float(group.attrs.get("target_ra_deg", 0.0)),
                "dec_deg": float(group.attrs.get("target_dec_deg", 0.0)),
                "synthetic": bool(group.attrs.get("synthetic", False)),
                "epochs": {},
            },
        )
        target["synthetic"] = target["synthetic"] or bool(
            group.attrs.get("synthetic", False)
        )
        epoch = str(group.attrs.get("epoch", "unknown"))
        try:
            sample = _sample_from_group(
                group,
                float(target["ra_deg"]),
                float(target["dec_deg"]),
                radius_arcsec=60.0,
            )
        except (KeyError, ValueError, TypeError):
            LOGGER.warning(
                "Skipping malformed Zarr product %s during anomaly scan",
                group.path,
                exc_info=True,
            )
            continue
        if sample is not None:
            target["epochs"].setdefault(epoch, []).append(sample)

    anomalies: list[dict[str, Any]] = []
    for target in targets.values():
        epochs = sorted(target["epochs"])
        if len(epochs) < 2:
            continue
        selected_a = epoch_a or epochs[0]
        selected_b = epoch_b or epochs[-1]
        if selected_a not in target["epochs"] or selected_b not in target["epochs"]:
            continue
        if selected_a == selected_b:
            continue
        differences = _paired_differences(
            target["epochs"][selected_a], target["epochs"][selected_b]
        )
        if not differences:
            continue
        strongest = max(differences, key=lambda item: abs(item["significance"]))
        if abs(strongest["significance"]) < min_significance:
            continue
        wavelength = strongest["wavelength_um"]
        delta = strongest["delta_flux_mjy_sr"]
        significance = strongest["significance"]
        anomalies.append(
            {
                "target_id": target["target_id"],
                "target_name": target["target_name"],
                "synthetic": target["synthetic"],
                "ra_deg": target["ra_deg"],
                "dec_deg": target["dec_deg"],
                "epoch_a": selected_a,
                "epoch_b": selected_b,
                **strongest,
                "n_matched_samples": len(differences),
                "n_sigma_threshold": min_significance,
                "narrative": tell_cosmic_story(wavelength, delta, significance),
            }
        )
    anomalies.sort(key=lambda item: abs(item["significance"]), reverse=True)
    return {
        "epoch_a": epoch_a,
        "epoch_b": epoch_b,
        "min_significance": min_significance,
        "count": len(anomalies),
        "anomalies": anomalies,
    }
